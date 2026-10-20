package service

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

type ExperimentService struct {
	repo *repository.ExperimentRepo
}

func NewExperimentService() *ExperimentService {
	return &ExperimentService{repo: repository.NewExperimentRepo()}
}

func (s *ExperimentService) List(page, pageSize int, categoryID *uint, difficulty *string, themeSlug *string) ([]model.Experiment, int64, error) {
	return s.repo.List(page, pageSize, categoryID, difficulty, themeSlug)
}

func (s *ExperimentService) GetBySlug(slug string) (*model.Experiment, error) {
	return s.repo.GetBySlug(slug)
}

func (s *ExperimentService) Search(query string, page, pageSize int) ([]model.Experiment, int64, error) {
	return s.repo.Search(query, page, pageSize)
}

func (s *ExperimentService) GetByCategory(categorySlug string) ([]model.Experiment, error) {
	return s.repo.GetByCategory(categorySlug)
}

// GetByID 按主键获取实验。
func (s *ExperimentService) GetByID(id uint) (*model.Experiment, error) {
	return s.repo.GetByID(id)
}

// UpdateFields 更新实验的指定字段（管理后台编辑使用）。
func (s *ExperimentService) UpdateFields(id uint, fields map[string]any) error {
	return s.repo.UpdateFields(id, fields)
}

// ListByContentStatus 按内容生成状态筛选实验（供批量 AI 生成使用）。
func (s *ExperimentService) ListByContentStatus(status, difficulty string, limit int) ([]model.Experiment, error) {
	return s.repo.ListByContentStatus(status, difficulty, limit)
}

// ContentStats 返回各内容生成状态的实验数量。
func (s *ExperimentService) ContentStats() (map[string]int64, error) {
	return s.repo.ContentStats()
}

// CountByDifficulty 返回各难度实验数量。
func (s *ExperimentService) CountByDifficulty() (map[string]int64, error) {
	return s.repo.CountByDifficulty()
}

// ListCategories 返回全部分类（按 order_index 排序）。
func (s *ExperimentService) ListCategories() ([]model.Category, error) {
	return s.repo.ListCategories()
}
