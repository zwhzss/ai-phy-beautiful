package repository

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

// AIModelRepo 负责大模型配置的持久化。
type AIModelRepo struct {
	db *gorm.DB
}

func NewAIModelRepo() *AIModelRepo {
	return &AIModelRepo{db: GetDB()}
}

// List 返回大模型配置，modelType 为空时返回全部，isActive 为 nil 时不过滤激活状态。
func (r *AIModelRepo) List(modelType string, isActive *bool) ([]model.AIModel, error) {
	var items []model.AIModel
	q := r.db.Model(&model.AIModel{})
	if modelType != "" {
		q = q.Where("model_type = ?", modelType)
	}
	if isActive != nil {
		q = q.Where("is_active = ?", *isActive)
	}
	if err := q.Order("model_type ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *AIModelRepo) Get(id uint) (*model.AIModel, error) {
	var item model.AIModel
	if err := r.db.First(&item, id).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// GetActive 返回指定类型当前激活的配置；不存在时返回 (nil, nil)。
func (r *AIModelRepo) GetActive(modelType string) (*model.AIModel, error) {
	var item model.AIModel
	err := r.db.Where("model_type = ? AND is_active = ?", modelType, true).First(&item).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *AIModelRepo) Create(item *model.AIModel) error {
	return r.db.Create(item).Error
}

func (r *AIModelRepo) Save(item *model.AIModel) error {
	return r.db.Save(item).Error
}

func (r *AIModelRepo) Delete(id uint) error {
	return r.db.Delete(&model.AIModel{}, id).Error
}

// Activate 在事务中激活指定配置，并把同类型的其它配置全部取消激活
// （需求 5：相同的大模型类型只能激活一个）。
func (r *AIModelRepo) Activate(id uint, modelType string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.AIModel{}).
			Where("model_type = ? AND id <> ?", modelType, id).
			Update("is_active", false).Error; err != nil {
			return err
		}
		return tx.Model(&model.AIModel{}).
			Where("id = ?", id).
			Update("is_active", true).Error
	})
}

// CountByType 统计各类型配置数量，用于管理后台概览。
func (r *AIModelRepo) CountByType() (map[string]int64, error) {
	type row struct {
		ModelType string
		Total     int64
	}
	var rows []row
	if err := r.db.Model(&model.AIModel{}).
		Select("model_type, COUNT(*) AS total").
		Group("model_type").Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, v := range rows {
		out[v.ModelType] = v.Total
	}
	return out, nil
}
