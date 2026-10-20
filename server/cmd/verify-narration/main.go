// verify-narration 在「真实安装库的副本」上验证种子版文稿回填：
// 复制一份现有 phy-beauty.db，跑一次 BackfillEmptySeedNarrations，
// 再逐实验比对「种子版存档文稿行数 == 库内 narrations 行数」。
//
// 只读原库、只写副本，不改动用户正在使用的那份数据。
//
// 用法：
//
//	go run ./cmd/verify-narration -db "%APPDATA%\phy-beauty\phy-beauty.db"
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/service"
	"gorm.io/gorm"
)

func main() {
	src := flag.String("db", "", "现有数据库路径（只读，会被复制）")
	flag.Parse()
	if *src == "" {
		fmt.Fprintln(os.Stderr, "必须用 -db 指定数据库路径")
		os.Exit(2)
	}
	if _, err := os.Stat(*src); err != nil {
		fmt.Fprintf(os.Stderr, "读取数据库失败: %v\n", err)
		os.Exit(2)
	}

	tmpDir, err := os.MkdirTemp("", "verify-narration")
	if err != nil {
		fmt.Fprintf(os.Stderr, "建临时目录失败: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(tmpDir)

	dst := filepath.Join(tmpDir, "phy-beauty.db")
	if err := copyFile(*src, dst); err != nil {
		fmt.Fprintf(os.Stderr, "复制数据库失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("已复制数据库副本: %s\n", dst)

	if err := repository.InitDB(&config.Config{Database: config.DatabaseConfig{Path: dst}}); err != nil {
		fmt.Fprintf(os.Stderr, "打开副本失败: %v\n", err)
		os.Exit(1)
	}
	db := repository.GetDB()

	before := snapshot(db)
	fmt.Printf("副本初始状态：种子版存档 %d 份，其中文稿为空 %d 份，文稿非空 %d 份\n",
		before.total, before.empty, before.nonEmpty)

	fixed, err := service.NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		fmt.Fprintf(os.Stderr, "回填失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("本次回填实验数: %d\n", fixed)

	after := snapshot(db)
	fmt.Printf("回填后：存档 %d 份，文稿为空 %d 份，文稿非空 %d 份\n", after.total, after.empty, after.nonEmpty)

	// 非空存档必须逐个字节不变（回填绝不覆盖已有文稿）
	changed := 0
	for id, want := range before.hashes {
		if got, ok := after.hashes[id]; !ok || got != want {
			changed++
			if changed <= 5 {
				fmt.Printf("  !! 已有文稿的存档被改动: experiment_id=%d\n", id)
			}
		}
	}
	fmt.Printf("回填前文稿非空的存档中被改动的: %d 份\n", changed)

	// 逐实验比对：存档有段落但库内无台词，或存档仍为空而库内有台词
	var stillEmpty, orphan []string
	for i := range after.rows {
		r := after.rows[i]
		if r.payloadLines == 0 && r.dbLines > 0 {
			stillEmpty = append(stillEmpty, fmt.Sprintf("%s %s payload=%d db=%d", r.number, r.slug, r.payloadLines, r.dbLines))
		}
		if r.payloadLines > 0 && r.dbLines == 0 {
			orphan = append(orphan, fmt.Sprintf("%s %s payload=%d db=%d", r.number, r.slug, r.payloadLines, r.dbLines))
		}
	}
	fmt.Printf("\n回填后「存档文稿为空但库里有台词」: %d 个\n", len(stillEmpty))
	for i, s := range stillEmpty {
		if i >= 10 {
			fmt.Printf("  ... 其余 %d 个省略\n", len(stillEmpty)-i)
			break
		}
		fmt.Println("  ", s)
	}
	fmt.Printf("回填后「存档有文稿但库里没有台词」: %d 个\n", len(orphan))
	for i, s := range orphan {
		if i >= 5 {
			break
		}
		fmt.Println("  ", s)
	}

	// 抽查用户报的那个展项
	var exp model.Experiment
	if err := db.Where("slug = ?", "lissajous-figures").First(&exp).Error; err == nil {
		var v model.ContentVersion
		_ = db.Where("experiment_id = ? AND source = ?", exp.ID, model.ContentSourceSeed).First(&v).Error
		var content model.ExperimentContent
		_ = json.Unmarshal([]byte(v.Payload), &content)
		fmt.Printf("\n抽查 %s %s：种子版存档 %d 段 / %d 行\n", exp.Number, exp.Title, len(content.Narration.Sections), countLines(content))
		for _, s := range content.Narration.Sections {
			for _, l := range s.Lines {
				fmt.Printf("   [%s] %s\n", l.ID, truncate(l.Text, 46))
			}
		}
	}

	// 幂等：再跑一次不应有改动
	second, err := service.NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		fmt.Fprintf(os.Stderr, "第二次回填失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("\n再跑一次回填（幂等检查）改动数: %d\n", second)

	if len(stillEmpty) > 0 || len(orphan) > 0 || changed > 0 || second != 0 {
		os.Exit(1)
	}
	fmt.Println("\n结论：所有有稿件的实验，其种子版存档文稿均已就位，且已有文稿未被改动。")
}

type row struct {
	number, slug string
	payloadLines int
	dbLines      int
}

type snap struct {
	total, empty, nonEmpty int
	hashes                 map[uint]string
	rows                   []row
}

// snapshot 记录当前种子版存档的完整状态（含非空存档的内容指纹）。
func snapshot(db *gorm.DB) snap {
	s := snap{hashes: map[uint]string{}}
	var vers []model.ContentVersion
	if err := db.Where("source = ?", model.ContentSourceSeed).Find(&vers).Error; err != nil {
		fmt.Fprintf(os.Stderr, "读取存档失败: %v\n", err)
		os.Exit(1)
	}
	expByID := map[uint]model.Experiment{}
	var exps []model.Experiment
	if err := db.Select("id", "number", "slug").Find(&exps).Error; err != nil {
		fmt.Fprintf(os.Stderr, "读取实验失败: %v\n", err)
		os.Exit(1)
	}
	for i := range exps {
		expByID[exps[i].ID] = exps[i]
	}
	s.total = len(vers)
	for i := range vers {
		v := &vers[i]
		var content model.ExperimentContent
		if err := json.Unmarshal([]byte(v.Payload), &content); err != nil {
			continue
		}
		lines := countLines(content)
		var n int64
		db.Model(&model.Narration{}).Where("experiment_id = ?", v.ExperimentID).Count(&n)
		exp := expByID[v.ExperimentID]
		s.rows = append(s.rows, row{exp.Number, exp.Slug, lines, int(n)})
		if lines == 0 {
			s.empty++
			continue
		}
		s.nonEmpty++
		sum := sha256.Sum256([]byte(v.Payload))
		s.hashes[v.ExperimentID] = hex.EncodeToString(sum[:])
	}
	sort.Slice(s.rows, func(i, j int) bool { return s.rows[i].number < s.rows[j].number })
	return s
}

func countLines(c model.ExperimentContent) int {
	n := 0
	for _, s := range c.Narration.Sections {
		n += len(s.Lines)
	}
	return n
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
