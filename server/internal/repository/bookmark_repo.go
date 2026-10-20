package repository

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

type BookmarkRepo struct {
	db *gorm.DB
}

func NewBookmarkRepo() *BookmarkRepo {
	return &BookmarkRepo{db: GetDB()}
}

func (r *BookmarkRepo) List(userID uint) ([]model.Bookmark, error) {
	var bookmarks []model.Bookmark
	// 预加载关联实验（含分类），供前端直接显示标题并跳转
	if err := r.db.Preload("Experiment.Category").Where("user_id = ?", userID).Order("created_at DESC").Find(&bookmarks).Error; err != nil {
		return nil, err
	}
	return bookmarks, nil
}

func (r *BookmarkRepo) Exists(userID, experimentID uint) (bool, error) {
	var count int64
	if err := r.db.Model(&model.Bookmark{}).Where("user_id = ? AND experiment_id = ?", userID, experimentID).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *BookmarkRepo) Add(userID, experimentID uint) (*model.Bookmark, error) {
	bm := &model.Bookmark{UserID: userID, ExperimentID: experimentID}
	if err := r.db.Create(bm).Error; err != nil {
		return nil, err
	}
	return bm, nil
}

func (r *BookmarkRepo) Delete(userID, experimentID uint) error {
	return r.db.Where("user_id = ? AND experiment_id = ?", userID, experimentID).Delete(&model.Bookmark{}).Error
}
