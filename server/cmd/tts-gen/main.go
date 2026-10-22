// 命令 tts-gen 为内置讲解稿件批量生成语音（默认使用内置 Edge TTS，无需密钥）。
//
// 用途：构建期把数学史里程碑定理等讲解的音频一次性生成好，随安装包分发。
//
// 用法（务必先指向副本数据库与测试音频目录）：
//
//	DB_PATH=<副本库> AUDIO_DIR=<测试音频目录> \
//	  go run ./cmd/tts-gen -concurrency 6
//
// 常用参数：
//
//	-only      slug1,slug2  只处理指定实验
//	-voice     yunxi,xiaoxiao  指定音色（默认两个都生成）
//	-force     已存在的音频也重新生成
//	-dry-run   只统计待生成数量
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ai-phy-beautiful/server/internal/ai"
	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/service"
)

func main() {
	only := flag.String("only", "", "仅处理这些 slug（逗号分隔）")
	category := flag.String("category", "", "仅处理分类 slug（逗号分隔；空=所有分类）")
	voices := flag.String("voice", "yunxi,xiaoxiao", "音色列表")
	concurrency := flag.Int("concurrency", 4, "并发数")
	force := flag.Bool("force", false, "已存在的音频也重新生成")
	dryRun := flag.Bool("dry-run", false, "只统计，不生成")
	limit := flag.Int("limit", 0, "最多生成多少个音频文件（0 表示不限）")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}
	audioDir := cfg.AI.AudioDir

	// 初始化数据库（幂等：会补齐实验目录与讲解稿件）
	if err := service.InitDB(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "初始化数据库失败: %v\n", err)
		os.Exit(1)
	}
	db := repository.GetDB()

	onlySet := map[string]bool{}
	for _, s := range strings.Split(*only, ",") {
		if s = strings.TrimSpace(s); s != "" {
			onlySet[s] = true
		}
	}

	voiceList := []string{}
	for _, v := range strings.Split(*voices, ",") {
		if v = strings.TrimSpace(v); v != "" {
			voiceList = append(voiceList, v)
		}
	}

	// 待生成任务：experiment_id / slug / line_id / text
	type job struct {
		Kind   string // "e"=展项, "m"=里程碑
		ExpID  uint
		Slug   string
		LineID string
		Text   string
		Voice  string
		Out    string
	}
	var jobs []job

	type seedRow struct {
		ID     uint
		Slug   string
		LineID string
		Text   string
	}
	var list []seedRow
	// 默认处理库内全部有讲解的展项（可用 -category / -only 收窄）。
	//
	// 只取生效行：软删除的历史讲解（切版前的旧台词）会和生效行共用同一个 line_id，
	// 一起合成就会把 <line_id>.mp3 覆盖成旧文本的音频。
	from := `FROM narrations n
		JOIN experiments e ON e.id = n.experiment_id`
	where := []string{"n.deleted_at IS NULL"}
	args := []any{}
	if cats := strings.TrimSpace(*category); cats != "" {
		from += `
		JOIN categories c ON c.id = e.category_id`
		parts := []string{}
		for _, c := range strings.Split(cats, ",") {
			if c = strings.TrimSpace(c); c != "" {
				parts = append(parts, strings.ReplaceAll(c, "'", ""))
			}
		}
		where = append(where, "c.slug IN (?)")
		args = append(args, parts)
	}
	query := `SELECT e.id AS id, e.slug AS slug, n.line_id AS line_id, n.text AS text
		` + from + `
		WHERE ` + strings.Join(where, ` AND `) + `
		ORDER BY e.number, n.line_index`
	if err := db.Raw(query, args...).Scan(&list).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询讲解失败: %v\n", err)
		os.Exit(1)
	}

	for _, r := range list {
		if len(onlySet) > 0 && !onlySet[r.Slug] {
			continue
		}
		for _, v := range voiceList {
			out := filepath.Join(audioDir, strconv.FormatUint(uint64(r.ID), 10), v, r.LineID+".mp3")
			jobs = append(jobs, job{Kind: "e", ExpID: r.ID, Slug: r.Slug, LineID: r.LineID, Text: r.Text, Voice: v, Out: out})
		}
	}

	// 里程碑讲解（milestone_narrations，音频目录 ms<milestone_id>）
	type msRow struct {
		ID     uint
		Slug   string
		LineID string
		Text   string
	}
	var msList []msRow
	if err := db.Raw(`SELECT m.id AS id, m.slug AS slug, n.line_id AS line_id, n.text AS text
		FROM milestone_narrations n
		JOIN milestones m ON m.id = n.milestone_id
		WHERE n.deleted_at IS NULL
		ORDER BY m.year, n.line_index`).Scan(&msList).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询里程碑讲解失败: %v\n", err)
		os.Exit(1)
	}
	for _, r := range msList {
		if len(onlySet) > 0 && !onlySet[r.Slug] {
			continue
		}
		for _, v := range voiceList {
			out := filepath.Join(audioDir, "ms"+strconv.FormatUint(uint64(r.ID), 10), v, r.LineID+".mp3")
			jobs = append(jobs, job{Kind: "m", ExpID: r.ID, Slug: r.Slug, LineID: r.LineID, Text: r.Text, Voice: v, Out: out})
		}
	}

	// 过滤已存在
	pending := jobs[:0]
	skipped := 0
	for _, j := range jobs {
		if !*force {
			if info, err := os.Stat(j.Out); err == nil && info.Size() > 0 {
				skipped++
				continue
			}
		}
		pending = append(pending, j)
	}

	fmt.Printf("数据库: %s\n音频目录: %s\n待生成: %d 个音频（已存在 %d 个）\n音色: %s\n并发: %d\n\n",
		cfg.Database.Path, audioDir, len(pending), skipped, strings.Join(voiceList, ", "), *concurrency)

	if *dryRun {
		fmt.Println("（dry-run：未生成任何文件）")
		return
	}
	if *limit > 0 && len(pending) > *limit {
		pending = pending[:*limit]
	}

	ttsCfg := &model.AIModel{ModelType: "tts", Provider: "edge", Name: "builtin-edge"}

	type result struct {
		Job    job
		Ms     int
		Err    error
		Millis int64
	}

	work := make(chan job)
	results := make(chan result, len(pending))

	var wg sync.WaitGroup
	for i := 0; i < *concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range work {
				if err := os.MkdirAll(filepath.Dir(j.Out), 0o755); err != nil {
					results <- result{Job: j, Err: err}
					continue
				}
				start := time.Now()
				ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
				ms, err := ai.Synthesize(ctx, ttsCfg, j.Text, j.Voice, j.Out)
				cancel()
				results <- result{Job: j, Ms: ms, Err: err, Millis: time.Since(start).Milliseconds()}
			}
		}()
	}

	go func() {
		for _, j := range pending {
			work <- j
		}
		close(work)
	}()

	go func() {
		wg.Wait()
		close(results)
	}()

	ok, failed := 0, 0
	var failures []string
	startAll := time.Now()
	for r := range results {
		if r.Err != nil {
			failed++
			if len(failures) < 8 {
				failures = append(failures, fmt.Sprintf("%s/%s: %v", r.Job.Slug, r.Job.LineID, r.Err))
			}
			continue
		}
		ok++
		if ok%50 == 0 {
			fmt.Printf("  已生成 %d / %d\n", ok, len(pending))
		}
		// 回写时长（同一实验同一 line_id 的两个音色取先到的值即可）
		// 只写生效行，软删除的历史版本保持原样。
		if r.Ms > 0 {
			if r.Job.Kind == "m" {
				db.Exec(`UPDATE milestone_narrations SET duration_ms = ?
					WHERE milestone_id = ? AND line_id = ? AND duration_ms = 0 AND deleted_at IS NULL`,
					r.Ms, r.Job.ExpID, r.Job.LineID)
			} else {
				db.Exec(`UPDATE narrations SET duration_ms = ?
					WHERE experiment_id = ? AND line_id = ? AND duration_ms = 0 AND deleted_at IS NULL`,
					r.Ms, r.Job.ExpID, r.Job.LineID)
			}
		}
	}

	fmt.Printf("\n完成：成功 %d，失败 %d，耗时 %s\n", ok, failed, time.Since(startAll).Round(time.Second))
	if len(failures) > 0 {
		fmt.Println("失败样例：")
		sort.Strings(failures)
		for _, f := range failures {
			fmt.Println("  -", f)
		}
	}
	if failed > 0 {
		os.Exit(1)
	}
}
