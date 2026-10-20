// Command seed 重新应用《架构设计.md》实验目录种子数据。
//
// 用法（在 server 目录下执行）：
//
//	go run ./cmd/seed                 # 幂等同步全部目录
//	go run ./cmd/seed -stats          # 只查看统计，不写库
//	go run ./cmd/seed -gen            # 先从架构文档重新生成 JSON，再同步
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/seed"
)

func main() {
	statsOnly := flag.Bool("stats", false, "只输出目录统计")
	flag.Parse()

	catalog, err := seed.Load()
	if err != nil {
		fail(err)
	}

	if *statsOnly {
		printStats(catalog)
		return
	}

	cfg, err := config.Load()
	if err != nil {
		fail(err)
	}
	if err := repository.InitDB(cfg); err != nil {
		fail(err)
	}

	db := repository.GetDB()
	res, err := seed.ApplyWithTx(db)
	if err != nil {
		fail(err)
	}

	fmt.Printf("目录同步完成：分类 %d 个，新建实验 %d 个，更新实验 %d 个，目录总量 %d 个\n",
		res.Categories, res.ExperimentsCreated, res.ExperimentsUpdated, res.Total)

	var total int64
	db.Model(&model.Experiment{}).Count(&total)
	fmt.Printf("数据库内实验总数：%d\n", total)
}

func printStats(catalog *seed.Catalog) {
	fmt.Printf("实验目录：分类 %d 个，实验 %d 个\n", len(catalog.Categories), len(catalog.Experiments))
	byDifficulty := map[string]int{}
	for _, e := range catalog.Experiments {
		byDifficulty[e.Difficulty]++
	}
	for _, d := range []string{"basic", "intro", "intermediate", "advanced", "professional"} {
		fmt.Printf("  %-14s %d\n", d, byDifficulty[d])
	}
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "执行失败: %v\n", err)
	os.Exit(1)
}
