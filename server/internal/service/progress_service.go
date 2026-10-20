package service

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

type ProgressService struct {
	repo *repository.ProgressRepo
}

func NewProgressService() *ProgressService {
	return &ProgressService{repo: repository.NewProgressRepo()}
}

func (s *ProgressService) Get(userID, experimentID uint) (*model.UserProgress, error) {
	return s.repo.Get(userID, experimentID)
}

func (s *ProgressService) Update(userID, experimentID uint, lineIndex, durationSec int, completed bool) (*model.UserProgress, error) {
	return s.repo.Update(userID, experimentID, lineIndex, durationSec, completed)
}

// Touch 记录一次学习访问：进入实验即计入「已学习」，不清除既有完成状态。
func (s *ProgressService) Touch(userID, experimentID uint) (*model.UserProgress, error) {
	return s.repo.Touch(userID, experimentID)
}

func (s *ProgressService) GetByUser(userID uint) ([]model.UserProgress, error) {
	return s.repo.GetByUser(userID)
}
