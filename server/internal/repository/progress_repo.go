package repository

import (
	"time"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

type ProgressRepo struct {
	db *gorm.DB
}

func NewProgressRepo() *ProgressRepo {
	return &ProgressRepo{db: GetDB()}
}

func (r *ProgressRepo) Get(userID, experimentID uint) (*model.UserProgress, error) {
	var progress model.UserProgress
	err := r.db.Where("user_id = ? AND experiment_id = ?", userID, experimentID).First(&progress).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &progress, err
}

func (r *ProgressRepo) Create(userID, experimentID uint) (*model.UserProgress, error) {
	progress := &model.UserProgress{
		UserID:       userID,
		ExperimentID: experimentID,
		Completed:    false,
		CurrentLine:  0,
		DurationSec:  0,
		LastAccess:   time.Now(),
	}
	if err := r.db.Create(progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func (r *ProgressRepo) Update(userID, experimentID uint, lineIndex, durationSec int, completed bool) (*model.UserProgress, error) {
	progress := &model.UserProgress{}
	if err := r.db.Where("user_id = ? AND experiment_id = ?", userID, experimentID).First(progress).Error; err != nil {
		// Create if not exists
		return r.Create(userID, experimentID)
	}
	progress.CurrentLine = lineIndex
	progress.DurationSec = durationSec
	// 完成状态只允许 false -> true：避免后续的进度更新把「已完成」打回「学习中」
	if completed {
		progress.Completed = true
	}
	progress.LastAccess = time.Now()
	if err := r.db.Save(progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

// Touch 记录一次学习访问：记录不存在时创建，已存在时只刷新 last_access。
//
// 与 Update 的区别：不会修改 completed 与 current_line，
// 因此「打开实验」只会把实验计入已学习，不会清除已有的完成状态。
func (r *ProgressRepo) Touch(userID, experimentID uint) (*model.UserProgress, error) {
	progress := &model.UserProgress{}
	if err := r.db.Where("user_id = ? AND experiment_id = ?", userID, experimentID).First(progress).Error; err != nil {
		return r.Create(userID, experimentID)
	}
	progress.LastAccess = time.Now()
	if err := r.db.Save(progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func (r *ProgressRepo) GetByUser(userID uint) ([]model.UserProgress, error) {
	var progresses []model.UserProgress
	// 预加载关联实验（含分类），供前端直接显示标题并跳转
	if err := r.db.Preload("Experiment.Category").Where("user_id = ?", userID).Order("last_access DESC").Find(&progresses).Error; err != nil {
		return nil, err
	}
	return progresses, nil
}
