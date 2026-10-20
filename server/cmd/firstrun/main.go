// 命令 firstrun 模拟桌面端首次启动的讲解内容初始化，用于安装前回归自检：
//
//	初始化数据库 → 导入内置讲解稿件 → 解压音频归档 → 逐条校验讲解记录的音频文件
//
// 用法（在 server 目录下执行）：
//
//	go run ./cmd/firstrun -data <空目录> -archive <narrations-audio.zip> [-force]
//
// 退出码：0 = 全部就位；4 = 有讲解记录找不到对应音频或抽查失败。
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/seed"
	"github.com/ai-phy-beautiful/server/internal/service"
	"gorm.io/gorm"
)

func main() {
	dataDir := flag.String("data", "", "模拟的数据目录（建议指向空目录）")
	archive := flag.String("archive", filepath.Join("..", "desktop", "assets", "narrations-audio.zip"), "音频归档路径")
	assetsArchive := flag.String("assets-archive", filepath.Join("..", "desktop", "assets", "phy-assets.zip"), "素材资产归档路径")
	force := flag.Bool("force", false, "忽略完成标记强制重新解压")
	assetsOnly := flag.Bool("assets-only", false,
		"只把素材归档补进 -data 的 assets 目录（修复未随包分发素材的既有安装；会写 .phy-assets.ok 标记）")
	flag.Parse()

	if *dataDir == "" {
		fmt.Fprintln(os.Stderr, "必须指定 -data")
		os.Exit(2)
	}

	if *assetsOnly {
		assetsDir := filepath.Join(*dataDir, "assets")
		n, err := seed.ExtractMaterialAssets(*assetsArchive, assetsDir, *force)
		if err != nil {
			fmt.Fprintf(os.Stderr, "素材解压失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("素材目录: %s\n归档    : %s\n写入    : %d 个文件\n", assetsDir, *assetsArchive, n)
		return
	}

	if err := os.MkdirAll(filepath.Join(*dataDir, "audio"), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "创建数据目录失败: %v\n", err)
		os.Exit(1)
	}

	// 与 desktop.StartBackend 使用同一套环境变量约定
	dbPath := filepath.Join(*dataDir, "phy-beauty.db")
	audioDir := filepath.Join(*dataDir, "audio")
	os.Setenv("APP_ENV", "production")
	os.Setenv("DB_PATH", dbPath)
	os.Setenv("AUDIO_DIR", audioDir)
	os.Setenv("ASSETS_DIR", filepath.Join(*dataDir, "assets"))
	os.Setenv("APP_CONFIG", filepath.Join(*dataDir, "config.yaml"))

	fmt.Printf("模拟数据目录: %s\n音频归档    : %s\n\n", *dataDir, *archive)

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	t0 := time.Now()
	if err := service.InitDB(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "初始化数据库失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[1] 建表 + 种子目录 + 讲解稿件: %v\n", time.Since(t0).Round(time.Millisecond))

	db := repository.GetDB()
	var expCount, msCount, expLines, msLines int64
	db.Model(&model.Experiment{}).Count(&expCount)
	db.Model(&model.Milestone{}).Count(&msCount)
	db.Model(&model.Narration{}).Count(&expLines)
	db.Model(&model.MilestoneNarration{}).Count(&msLines)
	fmt.Printf("    展项 %d 个 / %d 行台词；里程碑 %d 个 / %d 行台词\n", expCount, expLines, msCount, msLines)

	t1 := time.Now()
	written, err := seed.ExtractNarrationAudio(db, *archive, *dataDir, *force)
	if err != nil {
		fmt.Fprintf(os.Stderr, "解压音频失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[2] 解压音频归档: 写入 %d 个文件，耗时 %v\n", written, time.Since(t1).Round(time.Millisecond))

	t2 := time.Now()
	w2, err := seed.ExtractNarrationAudio(db, *archive, *dataDir, false)
	if err != nil {
		fmt.Fprintf(os.Stderr, "重复解压失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[3] 再次调用（幂等检查）: 写入 %d 个文件，耗时 %v\n", w2, time.Since(t2).Round(time.Millisecond))

	// 逐条校验：每条讲解记录指向的音频是否真的在磁盘上
	type narrationRow struct {
		Dir    string
		LineID string
		Yunxi  string
		Xiao   string
	}
	var rows []narrationRow
	if err := db.Raw(`SELECT CAST(e.id AS TEXT) AS dir, n.line_id AS line_id,
			n.audio_yunxi AS yunxi, n.audio_xiaoxiao AS xiao
		FROM narrations n JOIN experiments e ON e.id = n.experiment_id`).Scan(&rows).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询展项讲解失败: %v\n", err)
		os.Exit(1)
	}
	var msRows []narrationRow
	if err := db.Raw(`SELECT 'ms' || CAST(m.id AS TEXT) AS dir, n.line_id AS line_id,
			n.audio_yunxi AS yunxi, n.audio_xiaoxiao AS xiao
		FROM milestone_narrations n JOIN milestones m ON m.id = n.milestone_id`).Scan(&msRows).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询里程碑讲解失败: %v\n", err)
		os.Exit(1)
	}
	rows = append(rows, msRows...)

	missing := []string{}
	checked, zero := 0, 0
	for _, r := range rows {
		for _, p := range []string{r.Yunxi, r.Xiao} {
			rel := strings.TrimPrefix(p, "/audio/")
			if rel == "" || rel == p {
				missing = append(missing, fmt.Sprintf("%s/%s: 音频路径为空（%q）", r.Dir, r.LineID, p))
				continue
			}
			checked++
			abs := filepath.Join(audioDir, filepath.FromSlash(rel))
			info, statErr := os.Stat(abs)
			if statErr != nil {
				missing = append(missing, rel)
				continue
			}
			if info.Size() == 0 {
				zero++
				missing = append(missing, rel+"（0 字节）")
			}
		}
	}
	sort.Strings(missing)

	fmt.Printf("\n[4] 逐条校验讲解音频: 检查 %d 个文件\n", checked)
	if len(missing) == 0 {
		fmt.Printf("    结论: 全部就位（0 缺失、0 零字节）\n")
	} else {
		fmt.Printf("    结论: 缺失/异常 %d 个（其中零字节 %d 个）\n", len(missing), zero)
		for i, m := range missing {
			if i >= 20 {
				fmt.Printf("    ... 其余 %d 个\n", len(missing)-20)
				break
			}
			fmt.Printf("    缺失 %s\n", m)
		}
	}

	// 数据目录统计
	total, bytes := 0, int64(0)
	_ = filepath.Walk(audioDir, func(_ string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		total++
		bytes += info.Size()
		return nil
	})
	dirs := map[string]bool{}
	if entries, err := os.ReadDir(audioDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				dirs[e.Name()] = true
			}
		}
	}
	fmt.Printf("\n[5] 数据目录统计: %d 个目录 / %d 个音频 / %.1f MB\n", len(dirs), total, float64(bytes)/1024/1024)
	// 目录名必须全部是 <数字> 或 ms<数字>，不能出现 ms<id>.<line> 这类残留
	badDirs := 0
	for d := range dirs {
		if !validDirName(d) {
			fmt.Printf("    目录名异常: %q\n", d)
			badDirs++
		}
	}

	// 抽查同名 slug：展项与里程碑音频都要各自到位
	okCount, problems := spotCheckCollisions(db, audioDir)
	fmt.Printf("\n[6] 同名 slug（既是展项又是里程碑）抽查: 通过 %d 项\n", okCount)
	for _, p := range problems {
		fmt.Printf("    问题: %s\n", p)
	}

	// 素材资产：assets 表登记的每个 rel_path 都要有文件
	assetsDir := filepath.Join(*dataDir, "assets")
	t3 := time.Now()
	assetsWritten, aerr := seed.ExtractMaterialAssets(*assetsArchive, assetsDir, false)
	if aerr != nil {
		fmt.Printf("\n[7] 素材资产解压失败: %v\n", aerr)
		problems = append(problems, aerr.Error())
	} else if _, statErr := os.Stat(*assetsArchive); statErr != nil {
		fmt.Printf("\n[7] 素材资产归档未提供（%s），跳过\n", *assetsArchive)
	} else {
		fmt.Printf("\n[7] 素材资产解压: 写入 %d 个文件，耗时 %v\n", assetsWritten, time.Since(t3).Round(time.Millisecond))
		var assetPaths []string
		if err := db.Raw(`SELECT rel_path FROM assets`).Scan(&assetPaths).Error; err != nil {
			problems = append(problems, fmt.Sprintf("查询 assets 表失败: %v", err))
		}
		missingAssets := []string{}
		for _, rel := range assetPaths {
			rel = strings.TrimSpace(rel)
			if rel == "" {
				continue
			}
			p := filepath.Join(assetsDir, filepath.FromSlash(rel))
			if info, err := os.Stat(p); err != nil || info.Size() == 0 {
				missingAssets = append(missingAssets, rel)
			}
		}
		sort.Strings(missingAssets)
		fmt.Printf("    素材元数据 %d 条；缺失文件 %d 个\n", len(assetPaths), len(missingAssets))
		for i, m := range missingAssets {
			if i >= 20 {
				fmt.Printf("    ... 其余 %d 个\n", len(missingAssets)-20)
				break
			}
			fmt.Printf("    缺失 %s\n", m)
		}
		problems = append(problems, missingAssets...)
	}

	if sqlDB, err := db.DB(); err == nil {
		_ = sqlDB.Close() // Windows 上不关闭会锁住 db 文件
	}

	if len(missing) > 0 || len(problems) > 0 || badDirs > 0 {
		os.Exit(4)
	}
	fmt.Println("\n首启自检通过。")
}

func validDirName(d string) bool {
	if strings.HasPrefix(d, "ms") {
		d = d[2:]
	}
	if d == "" {
		return false
	}
	for _, r := range d {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// spotCheckCollisions 抽查同名 slug：里程碑音频必须在 ms<id> 目录、展项音频必须在 <id> 目录。
func spotCheckCollisions(db *gorm.DB, audioDir string) (int, []string) {
	var rows []struct {
		Slug  string
		ExpID uint
		MsID  uint
	}
	if err := db.Raw(`SELECT m.slug AS slug, e.id AS exp_id, m.id AS ms_id
		FROM milestones m JOIN experiments e ON e.slug = m.slug
		WHERE EXISTS (SELECT 1 FROM milestone_narrations mn WHERE mn.milestone_id = m.id)
		GROUP BY m.id ORDER BY m.slug`).Scan(&rows).Error; err != nil {
		return 0, []string{fmt.Sprintf("查询同名 slug 失败: %v", err)}
	}

	okCount := 0
	var problems []string
	for _, r := range rows {
		msDir := "ms" + strconv.FormatUint(uint64(r.MsID), 10)
		expDir := strconv.FormatUint(uint64(r.ExpID), 10)

		// 里程碑侧：登记过的每一句都必须有音频
		var msLines []string
		if err := db.Raw(`SELECT line_id FROM milestone_narrations WHERE milestone_id = ?`, r.MsID).Scan(&msLines).Error; err != nil {
			problems = append(problems, fmt.Sprintf("%s: 查询里程碑台词失败 %v", r.Slug, err))
			continue
		}
		for _, line := range msLines {
			p := filepath.Join(audioDir, msDir, "yunxi", line+".mp3")
			if info, err := os.Stat(p); err != nil || info.Size() == 0 {
				problems = append(problems, fmt.Sprintf("%s: 里程碑音频缺失 %s/%s", r.Slug, msDir, line+".mp3"))
			}
		}
		// 展项侧：登记过的每一句都必须有音频
		var expLines []string
		if err := db.Raw(`SELECT line_id FROM narrations WHERE experiment_id = ?`, r.ExpID).Scan(&expLines).Error; err != nil {
			problems = append(problems, fmt.Sprintf("%s: 查询展项台词失败 %v", r.Slug, err))
			continue
		}
		for _, line := range expLines {
			p := filepath.Join(audioDir, expDir, "yunxi", line+".mp3")
			if info, err := os.Stat(p); err != nil || info.Size() == 0 {
				problems = append(problems, fmt.Sprintf("%s: 展项音频缺失 %s/%s", r.Slug, expDir, line+".mp3"))
			}
		}
		// 展项与里程碑的音频目录必须不同
		if msDir == expDir {
			problems = append(problems, fmt.Sprintf("%s: 展项与里程碑目录相同（%s）", r.Slug, msDir))
		}
		okCount++
	}
	return okCount, problems
}
