package desktop

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

// 回归（安装版实测）：桌面端 InitDB 里的「种子版基线快照」早于 EnsureNarrationScripts，
// 于是 P399~P600 等 202 个展项的种子版存档被固化成空文稿，前端「📄 文稿（种子版）」
// 显示"该实验还没有种子版讲解稿"（尽管库里有台词）。
// 这里覆盖 RepairSeedNarrations 在真实启动顺序下能把它们补回来。
func TestRepairSeedNarrationsBackfillsEmptySnapshot(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "desktop.db")
	if err := repository.InitDB(&config.Config{Database: config.DatabaseConfig{Path: dbPath}}); err != nil {
		t.Fatalf("初始化测试数据库失败: %v", err)
	}
	db := repository.GetDB()
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	exp := model.Experiment{Slug: "lissajous-figures", Number: "P468", Title: "振动合成与李萨如图形", Description: "两个垂直简谐振动的合成"}
	if err := db.Create(&exp).Error; err != nil {
		t.Fatalf("写入实验失败: %v", err)
	}

	// 1) 快照先落地（此时库中还没有稿件）→ 空文稿存档
	empty, err := json.Marshal(model.ExperimentContent{Description: exp.Description})
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}
	if err := db.Create(&model.ContentVersion{
		ExperimentID: exp.ID, Source: model.ContentSourceSeed, Payload: string(empty), IsActive: true,
	}).Error; err != nil {
		t.Fatalf("写入空存档失败: %v", err)
	}

	// 2) 稿件随后入库
	for i, text := range []string{"开场白", "核心陈述"} {
		row := model.Narration{
			ExperimentID: exp.ID, SectionID: "intro", SectionTitle: "开场",
			LineIndex: i, LineID: "intro-" + string(rune('1'+i)), Text: text,
		}
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("写入讲解失败: %v", err)
		}
	}

	fixed, err := RepairSeedNarrations()
	if err != nil {
		t.Fatalf("自愈失败: %v", err)
	}
	if fixed != 1 {
		t.Fatalf("自愈条数 = %d，期望 1", fixed)
	}

	var ver model.ContentVersion
	if err := db.Where("experiment_id = ? AND source = ?", exp.ID, model.ContentSourceSeed).First(&ver).Error; err != nil {
		t.Fatalf("读取存档失败: %v", err)
	}
	var content model.ExperimentContent
	if err := json.Unmarshal([]byte(ver.Payload), &content); err != nil {
		t.Fatalf("解析存档失败: %v", err)
	}
	if len(content.Narration.Sections) != 1 || len(content.Narration.Sections[0].Lines) != 2 {
		t.Fatalf("自愈后文稿 = %+v，期望 1 段 2 行", content.Narration.Sections)
	}

	// 幂等：再跑一次无改动
	again, err := RepairSeedNarrations()
	if err != nil {
		t.Fatalf("第二次自愈失败: %v", err)
	}
	if again != 0 {
		t.Fatalf("第二次自愈条数 = %d，期望 0", again)
	}
}
