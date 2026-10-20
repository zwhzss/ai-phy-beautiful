package service

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

type BookmarkService struct {
	repo *repository.BookmarkRepo
}

func NewBookmarkService() *BookmarkService {
	return &BookmarkService{repo: repository.NewBookmarkRepo()}
}

func (s *BookmarkService) List(userID uint) ([]model.Bookmark, error) {
	return s.repo.List(userID)
}

func (s *BookmarkService) Exists(userID, experimentID uint) (bool, error) {
	return s.repo.Exists(userID, experimentID)
}

func (s *BookmarkService) Add(userID, experimentID uint) (*model.Bookmark, error) {
	return s.repo.Add(userID, experimentID)
}

func (s *BookmarkService) Delete(userID, experimentID uint) error {
	return s.repo.Delete(userID, experimentID)
}
