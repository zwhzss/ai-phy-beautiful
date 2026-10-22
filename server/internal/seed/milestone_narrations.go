package seed

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

//go:embed data/narrations-ms.json
var narrationMilestoneRaw []byte

//go:embed data/narrations-ms-b.json
var narrationMilestoneBRaw []byte

//go:embed data/narrations-ms-c.json
var narrationMilestoneCRaw []byte

//go:embed data/narrations-ms-d.json
var narrationMilestoneDRaw []byte

// ImportMilestoneNarrations 幂等导入里程碑讲解（键 = milestone slug）。
//
// skipExisting 时跳过已有讲解的里程碑；音频路径约定：/audio/ms<milestone_id>/<voice>/<line_id>.mp3
// （ms 前缀避免与展项的纯数字目录冲突）。
func ImportMilestoneNarrations(db *gorm.DB, skipExisting bool) (milestones, lines int, err error) {
	scripts, err := milestoneNarrationScripts()
	if err != nil {
		return 0, 0, err
	}

	var msList []model.Milestone
	if err := db.Find(&msList).Error; err != nil {
		return 0, 0, err
	}
	idBySlug := map[string]uint{}
	for _, m := range msList {
		idBySlug[m.Slug] = m.ID
	}

	for slug, script := range scripts {
		msID, ok := idBySlug[slug]
		if !ok {
			continue // 里程碑不存在则跳过（可后续滚动补齐）
		}
		if skipExisting {
			var cnt int64
			if err := db.Model(&model.MilestoneNarration{}).Where("milestone_id = ?", msID).Count(&cnt).Error; err != nil {
				return 0, 0, err
			}
			if cnt > 0 {
				continue
			}
		} else {
			if err := db.Where("milestone_id = ?", msID).Delete(&model.MilestoneNarration{}).Error; err != nil {
				return 0, 0, err
			}
		}
		dir := fmt.Sprintf("ms%d", msID)
		records := make([]model.MilestoneNarration, 0, len(script.Lines))
		for _, l := range script.Lines {
			records = append(records, model.MilestoneNarration{
				MilestoneID:   msID,
				SectionID:     l.SectionID,
				SectionTitle:  l.SectionTitle,
				LineIndex:     l.LineIndex,
				LineID:        l.LineID,
				Text:          l.Text,
				DurationMs:    l.DurationMs,
				AudioYunxi:    fmt.Sprintf("/audio/%s/yunxi/%s.mp3", dir, l.LineID),
				AudioXiaoxiao: fmt.Sprintf("/audio/%s/xiaoxiao/%s.mp3", dir, l.LineID),
			})
		}
		if err := db.CreateInBatches(records, 100).Error; err != nil {
			return 0, 0, fmt.Errorf("导入里程碑 %s 讲解失败: %w", slug, err)
		}
		milestones++
		lines += len(records)
	}
	return milestones, lines, nil
}

var (
	milestoneNarrationOnce sync.Once
	milestoneNarrationData map[string]narrationScript
	milestoneNarrationErr  error
)

// milestoneNarrationScripts 合并加载里程碑稿件（四批共 120 个里程碑）。
func milestoneNarrationScripts() (map[string]narrationScript, error) {
	milestoneNarrationOnce.Do(func() {
		milestoneNarrationData = map[string]narrationScript{}
		for _, raw := range [][]byte{narrationMilestoneRaw, narrationMilestoneBRaw, narrationMilestoneCRaw, narrationMilestoneDRaw} {
			var batch map[string]narrationScript
			if err := json.Unmarshal(raw, &batch); err != nil {
				milestoneNarrationErr = fmt.Errorf("解析里程碑讲解稿件失败: %w", err)
				return
			}
			for slug, s := range batch {
				milestoneNarrationData[slug] = s
			}
		}
	})
	return milestoneNarrationData, milestoneNarrationErr
}

// SeedMilestoneNarrationLineIDs 返回内置里程碑稿件的 slug → line_id 集合，
// 用途同 [SeedNarrationLineIDs]。
func SeedMilestoneNarrationLineIDs() (map[string]map[string]bool, error) {
	return lineIDsBySlug(milestoneNarrationScripts())
}
