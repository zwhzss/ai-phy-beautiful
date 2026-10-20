package service

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"gorm.io/gorm"
)

// newVersionTestDB 建一个隔离的 sqlite 库并挂到 repository 全局 DB 上
// （ContentVersionService 与各 repo 都通过 repository.GetDB() 取库）。
// 走正式 InitDB 路径，顺带覆盖建表迁移。
func newVersionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "ver.db")
	if err := repository.InitDB(&config.Config{Database: config.DatabaseConfig{Path: dbPath}}); err != nil {
		t.Fatalf("初始化测试数据库失败: %v", err)
	}
	db := repository.GetDB()
	if db == nil {
		t.Fatal("测试数据库未挂载到 repository")
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func seedTestExperiment(t *testing.T, db *gorm.DB, slug, desc string) model.Experiment {
	t.Helper()
	exp := model.Experiment{Slug: slug, Title: "测试展项 " + slug, Number: "P999", Description: desc}
	if err := db.Create(&exp).Error; err != nil {
		t.Fatalf("写入测试实验失败: %v", err)
	}
	return exp
}

func seedTestNarrations(t *testing.T, db *gorm.DB, expID uint, texts ...string) {
	t.Helper()
	for i, text := range texts {
		row := model.Narration{
			ExperimentID: expID,
			SectionID:    "intro",
			SectionTitle: "开场",
			LineIndex:    i,
			LineID:       "intro-" + string(rune('1'+i)),
			Text:         text,
		}
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("写入测试讲解失败: %v", err)
		}
	}
}

// writeEmptySeedVersion 模拟「快照时稿件还没进种子」留下的空文稿存档。
func writeEmptySeedVersion(t *testing.T, db *gorm.DB, expID uint) {
	t.Helper()
	payload, err := json.Marshal(model.ExperimentContent{Description: "快照时的简介"})
	if err != nil {
		t.Fatalf("序列化空存档失败: %v", err)
	}
	ver := model.ContentVersion{
		ExperimentID: expID,
		Source:       model.ContentSourceSeed,
		Payload:      string(payload),
		IsActive:     true,
	}
	if err := db.Create(&ver).Error; err != nil {
		t.Fatalf("写入空存档失败: %v", err)
	}
}

func loadSeedPayload(t *testing.T, db *gorm.DB, expID uint) model.ExperimentContent {
	t.Helper()
	var ver model.ContentVersion
	if err := db.Where("experiment_id = ? AND source = ?", expID, model.ContentSourceSeed).First(&ver).Error; err != nil {
		t.Fatalf("读取种子版存档失败: %v", err)
	}
	var content model.ExperimentContent
	if err := json.Unmarshal([]byte(ver.Payload), &content); err != nil {
		t.Fatalf("解析种子版存档失败: %v", err)
	}
	return content
}

// TestBackfillEmptySeedNarrationsFillsEmptySnapshot 覆盖真实缺陷：
// 种子版快照早于稿件导入 → 存档文稿为空；稿件补齐后必须能自愈回填，
// 否则前端「📄 文稿（种子版）」永远显示不出来。
func TestBackfillEmptySeedNarrationsFillsEmptySnapshot(t *testing.T) {
	db := newVersionTestDB(t)
	exp := seedTestExperiment(t, db, "lissajous-figures", "两个垂直简谐振动的合成")
	writeEmptySeedVersion(t, db, exp.ID) // 先有「空文稿」快照
	seedTestNarrations(t, db, exp.ID, "开场白", "核心陈述一", "核心陈述二")

	if got := loadSeedPayload(t, db, exp.ID); len(got.Narration.Sections) != 0 {
		t.Fatalf("前置条件不成立：快照本应是空文稿，实际 %d 段", len(got.Narration.Sections))
	}

	fixed, err := NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		t.Fatalf("回填失败: %v", err)
	}
	if fixed != 1 {
		t.Fatalf("回填条数 = %d，期望 1", fixed)
	}

	got := loadSeedPayload(t, db, exp.ID)
	if len(got.Narration.Sections) != 1 {
		t.Fatalf("回填后段落数 = %d，期望 1", len(got.Narration.Sections))
	}
	if lines := got.Narration.Sections[0].Lines; len(lines) != 3 {
		t.Fatalf("回填后台词行数 = %d，期望 3", len(lines))
	} else if lines[0].Text != "开场白" {
		t.Fatalf("回填后台词内容 = %q，期望「开场白」", lines[0].Text)
	}

	// 幂等：再跑一次不应有任何改动
	again, err := NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		t.Fatalf("第二次回填失败: %v", err)
	}
	if again != 0 {
		t.Fatalf("第二次回填条数 = %d，期望 0（幂等）", again)
	}
}

// TestBackfillKeepsNonEmptySeedNarrations 已有文稿的种子版存档（含人工/AI 修改过的）
// 一律不能被回填覆盖。
func TestBackfillKeepsNonEmptySeedNarrations(t *testing.T) {
	db := newVersionTestDB(t)
	exp := seedTestExperiment(t, db, "kept", "简介")
	content := model.ExperimentContent{
		Description: "存档里的简介",
		Narration: model.NarrationScript{Sections: []model.NarrationSection{{
			ID:    "intro",
			Title: "开场",
			Lines: []model.NarrationLine{{ID: "intro-1", Text: "存档里原有的台词"}},
		}}},
	}
	payload, err := json.Marshal(content)
	if err != nil {
		t.Fatalf("序列化存档失败: %v", err)
	}
	if err := db.Create(&model.ContentVersion{
		ExperimentID: exp.ID, Source: model.ContentSourceSeed, Payload: string(payload), IsActive: true,
	}).Error; err != nil {
		t.Fatalf("写入存档失败: %v", err)
	}
	// 库里的台词与存档不同（模拟后续被改动过）
	seedTestNarrations(t, db, exp.ID, "库里的新台词")

	fixed, err := NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		t.Fatalf("回填失败: %v", err)
	}
	if fixed != 0 {
		t.Fatalf("回填条数 = %d，期望 0（已有文稿不得覆盖）", fixed)
	}
	got := loadSeedPayload(t, db, exp.ID)
	if txt := got.Narration.Sections[0].Lines[0].Text; txt != "存档里原有的台词" {
		t.Fatalf("存档被覆盖：台词 = %q", txt)
	}
}

// TestBackfillSkipsExperimentsWithoutNarrations 库中没有台词时保持原样，
// 避免把空存档改成另一种空存档。
func TestBackfillSkipsExperimentsWithoutNarrations(t *testing.T) {
	db := newVersionTestDB(t)
	exp := seedTestExperiment(t, db, "no-script", "简介")
	writeEmptySeedVersion(t, db, exp.ID)

	fixed, err := NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		t.Fatalf("回填失败: %v", err)
	}
	if fixed != 0 {
		t.Fatalf("回填条数 = %d，期望 0（无台词可回填）", fixed)
	}
	var count int64
	if err := db.Model(&model.ContentVersion{}).Where("experiment_id = ?", exp.ID).Count(&count).Error; err != nil {
		t.Fatalf("统计存档失败: %v", err)
	}
	if count != 1 {
		t.Fatalf("存档条数 = %d，期望 1（不应新建）", count)
	}
}

// TestBackfillIsIdempotentForFreshInstall 全新安装（基线建立时稿件已在库中）
// 不会产生任何回填，说明修复对正常流程零影响。
func TestBackfillIsIdempotentForFreshInstall(t *testing.T) {
	db := newVersionTestDB(t)
	exp := seedTestExperiment(t, db, "fresh", "全新安装的简介")
	seedTestNarrations(t, db, exp.ID, "台词一", "台词二")

	svc := NewContentVersionService()
	if err := svc.EnsureSeedVersion(exp.ID); err != nil {
		t.Fatalf("建立基线失败: %v", err)
	}
	if got := loadSeedPayload(t, db, exp.ID); len(got.Narration.Sections[0].Lines) != 2 {
		t.Fatalf("基线台词行数 = %d，期望 2", len(got.Narration.Sections[0].Lines))
	}

	fixed, err := svc.BackfillEmptySeedNarrations()
	if err != nil {
		t.Fatalf("回填失败: %v", err)
	}
	if fixed != 0 {
		t.Fatalf("回填条数 = %d，期望 0（基线本就完整）", fixed)
	}
}
