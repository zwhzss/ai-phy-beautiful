// 命令 audioaudit 审计讲解音频的完整性（数据库讲解 vs 磁盘音频文件）。
//
// 用途：生成/回归检查时快速回答“还差多少音频需要合成”。
//
// 用法：
//
//	go run ./cmd/audioaudit -db <sqlite 文件> -audio <音频目录> [-json <输出>]
//
// 约定（与 cmd/tts-gen / seed 保持一致）：
//
//	展项讲解   /audio/<experiment_id>/<voice>/<line_id>.mp3
//	里程碑讲解 /audio/ms<milestone_id>/<voice>/<line_id>.mp3
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type row struct {
	ID     uint
	Slug   string
	LineID string
	Voice  string
	Dir    string
	Kind   string
}

type missingItem struct {
	Kind  string `json:"kind"`
	ID    uint   `json:"id"`
	Slug  string `json:"slug"`
	Voice string `json:"voice"`
	File  string `json:"file"`
}

func main() {
	dbPath := flag.String("db", "", "SQLite 数据库路径")
	audioDir := flag.String("audio", "", "音频根目录（audio 目录）")
	jsonOut := flag.String("json", "", "把结果写入该 JSON 文件")
	voicesFlag := flag.String("voice", "yunxi,xiaoxiao", "音色列表")
	listLimit := flag.Int("list", 20, "缺失明细打印条数上限")
	bySlug := flag.Bool("by-slug", false, "按 slug 汇总缺失（实验数而非文件数）")
	flag.Parse()

	if *dbPath == "" || *audioDir == "" {
		fmt.Fprintln(os.Stderr, "必须同时指定 -db 与 -audio")
		os.Exit(2)
	}

	voices := splitCSV(*voicesFlag)

	db, err := gorm.Open(sqlite.Open(*dbPath+"?mode=ro"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "打开数据库失败: %v\n", err)
		os.Exit(1)
	}

	var expRows []struct {
		ID     uint
		Slug   string
		LineID string
	}
	if err := db.Raw(`SELECT e.id AS id, e.slug AS slug, n.line_id AS line_id
		FROM narrations n JOIN experiments e ON e.id = n.experiment_id
		ORDER BY e.number, n.line_index`).Scan(&expRows).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询展项讲解失败: %v\n", err)
		os.Exit(1)
	}

	var msRows []struct {
		ID     uint
		Slug   string
		LineID string
	}
	if err := db.Raw(`SELECT m.id AS id, m.slug AS slug, n.line_id AS line_id
		FROM milestone_narrations n JOIN milestones m ON m.id = n.milestone_id
		ORDER BY m.year, n.line_index`).Scan(&msRows).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询里程碑讲解失败: %v\n", err)
		os.Exit(1)
	}

	var wants []row
	for _, r := range expRows {
		for _, v := range voices {
			wants = append(wants, row{ID: r.ID, Slug: r.Slug, LineID: r.LineID, Voice: v,
				Dir: strconv.FormatUint(uint64(r.ID), 10), Kind: "experiment"})
		}
	}
	for _, r := range msRows {
		for _, v := range voices {
			wants = append(wants, row{ID: r.ID, Slug: r.Slug, LineID: r.LineID, Voice: v,
				Dir: "ms" + strconv.FormatUint(uint64(r.ID), 10), Kind: "milestone"})
		}
	}

	var missing []missingItem
	missingBytes := int64(0)
	present, empty := 0, 0
	for _, w := range wants {
		p := filepath.Join(*audioDir, w.Dir, w.Voice, w.LineID+".mp3")
		info, err := os.Stat(p)
		switch {
		case err != nil:
			missing = append(missing, missingItem{Kind: w.Kind, ID: w.ID, Slug: w.Slug, Voice: w.Voice,
				File: filepath.ToSlash(filepath.Join(w.Dir, w.Voice, w.LineID+".mp3"))})
		case info.Size() == 0:
			empty++
			missing = append(missing, missingItem{Kind: w.Kind, ID: w.ID, Slug: w.Slug, Voice: w.Voice,
				File: filepath.ToSlash(filepath.Join(w.Dir, w.Voice, w.LineID+".mp3"))})
		default:
			present++
			missingBytes += info.Size()
		}
	}

	// 磁盘上无法对应到任何数据库讲解的“孤儿”音频目录
	known := map[string]bool{}
	for _, w := range wants {
		known[w.Dir] = true
	}
	orphanDirs := []string{}
	if entries, err := os.ReadDir(*audioDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			if !known[e.Name()] {
				orphanDirs = append(orphanDirs, e.Name())
			}
		}
	}
	sort.Strings(orphanDirs)

	missingSlugs := map[string]bool{}
	missingFilesBySlug := map[string]int{}
	for _, m := range missing {
		missingSlugs[m.Slug] = true
		missingFilesBySlug[m.Slug]++
	}
	expSlugs := map[string]bool{}
	for _, r := range expRows {
		expSlugs[r.Slug] = true
	}
	msSlugs := map[string]bool{}
	for _, r := range msRows {
		msSlugs[r.Slug] = true
	}

	fmt.Printf("数据库: %s\n音频目录: %s\n\n", *dbPath, *audioDir)
	fmt.Printf("展项讲解: %d 个实验 / %d 行台词\n", len(expSlugs), len(expRows))
	fmt.Printf("里程碑讲解: %d 个里程碑 / %d 行台词\n", len(msSlugs), len(msRows))
	fmt.Printf("期望音频文件: %d（音色 %v）\n", len(wants), voices)
	fmt.Printf("已存在: %d（%d 个零字节）  缺失: %d\n", present, empty, len(missing))
	fmt.Printf("已存在音频体积: %.1f MB\n", float64(missingBytes)/1024/1024)
	fmt.Printf("待合成实验/里程碑: %d 个 slug（缺失文件 %d 个）\n", len(missingSlugs), len(missing))
	if len(orphanDirs) > 0 {
		fmt.Printf("孤儿音频目录（库中无对应讲解）: %d 个\n", len(orphanDirs))
	}

	if *bySlug {
		type slugStat struct {
			Slug   string
			Files  int
			Kind   string
			Voices []string
		}
		stats := map[string]*slugStat{}
		for _, m := range missing {
			s := stats[m.Slug]
			if s == nil {
				s = &slugStat{Slug: m.Slug, Kind: m.Kind}
				stats[m.Slug] = s
			}
			s.Files++
		}
		keys := make([]string, 0, len(stats))
		for k := range stats {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool {
			if stats[keys[i]].Files != stats[keys[j]].Files {
				return stats[keys[i]].Files > stats[keys[j]].Files
			}
			return keys[i] < keys[j]
		})
		fmt.Println("\n缺失 slug（按缺失文件数倒序）：")
		for i, k := range keys {
			if i >= *listLimit {
				fmt.Printf("  ... 其余 %d 个\n", len(keys)-*listLimit)
				break
			}
			fmt.Printf("  %-40s %d 个文件  [%s]\n", k, stats[k].Files, stats[k].Kind)
		}
	} else {
		fmt.Println("\n缺失明细（前若干条）：")
		for i, m := range missing {
			if i >= *listLimit {
				fmt.Printf("  ... 其余 %d 条\n", len(missing)-*listLimit)
				break
			}
			fmt.Printf("  %s\n", m.File)
		}
	}

	if *jsonOut != "" {
		payload := map[string]any{
			"db":                     *dbPath,
			"audio_dir":              *audioDir,
			"experiments":            len(expSlugs),
			"experiment_lines":       len(expRows),
			"milestones":             len(msSlugs),
			"milestone_lines":        len(msRows),
			"expected_files":         len(wants),
			"present_files":          present,
			"zero_byte_files":        empty,
			"missing_files":          len(missing),
			"missing_slugs":          len(missingSlugs),
			"missing_files_by_slug":  missingFilesBySlug,
			"orphan_dirs":            orphanDirs,
			"missing_sample":         sampleMissing(missing, 200),
		}
		buf, _ := json.MarshalIndent(payload, "", "  ")
		if err := os.WriteFile(*jsonOut, buf, 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "写入 JSON 失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("\n报告 -> %s\n", *jsonOut)
	}

	if len(missing) > 0 {
		os.Exit(3)
	}
}

func splitCSV(s string) []string {
	out := []string{}
	cur := ""
	for _, r := range s {
		if r == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
			continue
		}
		if r == ' ' || r == '\t' {
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func sampleMissing(items []missingItem, n int) []missingItem {
	if len(items) <= n {
		return items
	}
	return items[:n]
}
