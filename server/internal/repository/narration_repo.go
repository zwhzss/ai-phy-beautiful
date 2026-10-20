package repository

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

type NarrationRepo struct {
	db *gorm.DB
}

func NewNarrationRepo() *NarrationRepo {
	return &NarrationRepo{db: GetDB()}
}

func (r *NarrationRepo) ListByExperiment(experimentID uint) ([]model.Narration, error) {
	var narrations []model.Narration
	if err := r.db.Where("experiment_id = ?", experimentID).Order("line_index ASC").Find(&narrations).Error; err != nil {
		return nil, err
	}
	return narrations, nil
}

func (r *NarrationRepo) GetByExperimentAndLine(experimentID uint, lineID string) (*model.Narration, error) {
	var narration model.Narration
	if err := r.db.Where("experiment_id = ? AND line_id = ?", experimentID, lineID).First(&narration).Error; err != nil {
		return nil, err
	}
	return &narration, nil
}

func (r *NarrationRepo) GetByID(id uint) (*model.Narration, error) {
	var narration model.Narration
	if err := r.db.First(&narration, id).Error; err != nil {
		return nil, err
	}
	return &narration, nil
}

// ReplaceForExperiment 用新的讲解稿件整体替换某实验的讲解行。
func (r *NarrationRepo) ReplaceForExperiment(experimentID uint, lines []model.Narration) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("experiment_id = ?", experimentID).Delete(&model.Narration{}).Error; err != nil {
			return err
		}
		if len(lines) == 0 {
			return nil
		}
		for i := range lines {
			lines[i].ID = 0
			lines[i].ExperimentID = experimentID
		}
		return tx.CreateInBatches(lines, 100).Error
	})
}

func (r *NarrationRepo) Save(narration *model.Narration) error {
	return r.db.Save(narration).Error
}

func (r *NarrationRepo) Delete(id uint) error {
	return r.db.Delete(&model.Narration{}, id).Error
}

// CountWithAudio 统计已合成音频的讲解行数（双音色都具备才算完整）。
func (r *NarrationRepo) CountWithAudio(voiceColumn string) (int64, error) {
	if voiceColumn != "audio_xiaoxiao" {
		voiceColumn = "audio_yunxi"
	}
	var count int64
	err := r.db.Model(&model.Narration{}).Where(voiceColumn + " <> ''").Count(&count).Error
	return count, err
}

// ExperimentIDsWithoutAudio 返回仍然缺少指定音色音频的实验 ID（去重）。
func (r *NarrationRepo) ExperimentIDsWithoutAudio(voiceColumn string, limit int) ([]uint, error) {
	if voiceColumn != "audio_xiaoxiao" {
		voiceColumn = "audio_yunxi"
	}
	var ids []uint
	q := r.db.Model(&model.Narration{}).
		Distinct("experiment_id").
		Where("text <> '' AND (" + voiceColumn + " IS NULL OR " + voiceColumn + " = '')")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if err := q.Pluck("experiment_id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}
