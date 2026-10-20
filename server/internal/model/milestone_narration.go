package model

import (
	"time"

	"gorm.io/gorm"
)

// MilestoneNarration 是里程碑讲解行（《架构设计》§4.4 "核心里程碑配双音色讲解"）。
//
// 独立成表而非复用 narrations：现有 narrations.experiment_id 为 NOT NULL，
// 改多态需 SQLite 重建表，风险高；里程碑讲解量级小（30-120 条），独立表更稳。
type MilestoneNarration struct {
	ID            uint           `gorm:"primarykey" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	MilestoneID   uint           `gorm:"index;not null" json:"milestone_id"`
	SectionID     string         `gorm:"size:50;not null" json:"section_id"`
	SectionTitle  string         `gorm:"size:100" json:"section_title"`
	LineIndex     int            `gorm:"not null" json:"line_index"`
	LineID        string         `gorm:"size:100;not null" json:"line_id"`
	Text          string         `gorm:"type:text;not null" json:"text"`
	AudioYunxi    string         `gorm:"size:500" json:"audio_yunxi"`
	AudioXiaoxiao string         `gorm:"size:500" json:"audio_xiaoxiao"`
	DurationMs    int            `gorm:"default:0" json:"duration_ms"`
}
