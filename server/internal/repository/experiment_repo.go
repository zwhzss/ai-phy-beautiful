package repository

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

type ExperimentRepo struct {
	db *gorm.DB
}

func NewExperimentRepo() *ExperimentRepo {
	return &ExperimentRepo{db: GetDB()}
}

func (r *ExperimentRepo) List(page, pageSize int, categoryID *uint, difficulty *string, themeSlug *string) ([]model.Experiment, int64, error) {
	var experiments []model.Experiment
	var total int64

	query := r.db.Model(&model.Experiment{})
	if categoryID != nil {
		query = query.Where("category_id = ?", *categoryID)
	}
	if difficulty != nil {
		query = query.Where("difficulty = ?", *difficulty)
	}
	if themeSlug != nil && *themeSlug != "" {
		query = query.Where("theme_id IN (SELECT id FROM themes WHERE slug = ?)", *themeSlug)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Preload("Category").Order("sort_index ASC, id ASC").Offset(offset).Limit(pageSize).Find(&experiments).Error; err != nil {
		return nil, 0, err
	}
	return experiments, total, nil
}

func (r *ExperimentRepo) GetBySlug(slug string) (*model.Experiment, error) {
	var exp model.Experiment
	if err := r.db.Preload("Category").Where("slug = ?", slug).First(&exp).Error; err != nil {
		return nil, err
	}
	return &exp, nil
}

func (r *ExperimentRepo) GetByID(id uint) (*model.Experiment, error) {
	var exp model.Experiment
	if err := r.db.Preload("Category").First(&exp, id).Error; err != nil {
		return nil, err
	}
	return &exp, nil
}

func (r *ExperimentRepo) Search(query string, page, pageSize int) ([]model.Experiment, int64, error) {
	var experiments []model.Experiment
	var total int64

	db := r.db.Model(&model.Experiment{})
	searchTerm := "%" + query + "%"
	db.Where("title LIKE ? OR description LIKE ? OR concept LIKE ?", searchTerm, searchTerm, searchTerm).Count(&total)

	offset := (page - 1) * pageSize
	if err := db.Preload("Category").Order("sort_index ASC, id ASC").Offset(offset).Limit(pageSize).Find(&experiments).Error; err != nil {
		return nil, 0, err
	}
	return experiments, total, nil
}

func (r *ExperimentRepo) GetByCategory(categorySlug string) ([]model.Experiment, error) {
	var experiments []model.Experiment
	if err := r.db.Preload("Category").Where("category_id IN (SELECT id FROM categories WHERE slug = ?)", categorySlug).
		Order("sort_index ASC, id ASC").Find(&experiments).Error; err != nil {
		return nil, err
	}
	return experiments, nil
}

func (r *ExperimentRepo) Save(exp *model.Experiment) error {
	return r.db.Save(exp).Error
}

// UpdateFields 更新实验的指定字段。
func (r *ExperimentRepo) UpdateFields(id uint, fields map[string]any) error {
	return r.db.Model(&model.Experiment{}).Where("id = ?", id).Updates(fields).Error
}

// ListByContentStatus 按内容生成状态筛选实验，用于批量生成。
func (r *ExperimentRepo) ListByContentStatus(status string, difficulty string, limit int) ([]model.Experiment, error) {
	var experiments []model.Experiment
	q := r.db.Model(&model.Experiment{})
	if status != "" {
		q = q.Where("content_status = ?", status)
	}
	if difficulty != "" {
		q = q.Where("difficulty = ?", difficulty)
	}
	q = q.Order("sort_index ASC, id ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if err := q.Find(&experiments).Error; err != nil {
		return nil, err
	}
	return experiments, nil
}

// ContentStats 统计各生成状态的数量。
func (r *ExperimentRepo) ContentStats() (map[string]int64, error) {
	type row struct {
		ContentStatus string
		Total         int64
	}
	var rows []row
	if err := r.db.Model(&model.Experiment{}).
		Select("content_status, COUNT(*) AS total").
		Group("content_status").Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, v := range rows {
		out[v.ContentStatus] = v.Total
	}
	return out, nil
}

// CountByDifficulty 统计各难度实验数量。
func (r *ExperimentRepo) CountByDifficulty() (map[string]int64, error) {
	type row struct {
		Difficulty string
		Total      int64
	}
	var rows []row
	if err := r.db.Model(&model.Experiment{}).
		Select("difficulty, COUNT(*) AS total").
		Group("difficulty").Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, v := range rows {
		out[v.Difficulty] = v.Total
	}
	return out, nil
}

// CategoryByName 按名称查分类（AI 生成时用于提示词上下文）。
func (r *ExperimentRepo) CategoryByName(name string) (*model.Category, error) {
	var cat model.Category
	if err := r.db.Where("name = ?", name).First(&cat).Error; err != nil {
		return nil, err
	}
	return &cat, nil
}

// ListCategories 返回全部分类，按 order_index 排序。
func (r *ExperimentRepo) ListCategories() ([]model.Category, error) {
	var categories []model.Category
	if err := r.db.Order("order_index ASC, id ASC").Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

// AllIDs 返回全部实验 ID（用于批量建立内容版本基线）。
func (r *ExperimentRepo) AllIDs(out *[]uint) error {
	return r.db.Model(&model.Experiment{}).Pluck("id", out).Error
}
