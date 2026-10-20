package model

import (
	"time"

	"gorm.io/gorm"
)

// Theme 是《架构设计.md》定义的知识体系板块（themes → categories → experiments 三级）。
type Theme struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Slug        string         `gorm:"size:50;not null;uniqueIndex" json:"slug"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	Description string         `gorm:"size:500" json:"description"`
	OrderIndex  int            `gorm:"default:0" json:"order_index"`
}

// ScaleNode 是尺度轴锚点（长度/时间/速度轴），对应需求 FR-2。
type ScaleNode struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Axis        string         `gorm:"size:20;not null;default:'length';index" json:"axis"` // length | time | speed
	Slug        string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	ScaleValue  float64        `gorm:"not null" json:"scale_value"` // 米 / 秒（float64，展示时取 log10）
	Description string         `gorm:"size:500" json:"description"`
	Thumbnail   string         `gorm:"size:500" json:"thumbnail"`
	OrderIndex  int            `gorm:"default:0" json:"order_index"`
}

// Milestone 是"改变人类历史进程的物理定律 / 公式 / 发明 / 关键实验"里程碑（一等实体，FR-14）。
type Milestone struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Slug        string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Kind        string         `gorm:"size:20;not null;index" json:"kind"` // law | formula | invention | experiment
	Title       string         `gorm:"size:200;not null" json:"title"`
	Year        int            `gorm:"index" json:"year"` // 发表/发明年份，负数 = 公元前
	Statement   string         `gorm:"type:text;not null" json:"statement"`
	Latex       string         `gorm:"type:text" json:"latex"`
	Meaning     string         `gorm:"type:text" json:"meaning"`
	Conditions  string         `gorm:"type:text" json:"conditions"`
	Impact      string         `gorm:"type:text;not null" json:"impact"`
	SourceRef   string         `gorm:"size:500" json:"source_ref"`
	Certainty   string         `gorm:"size:30;not null;default:'theory-supported'" json:"certainty"`
	Difficulty  string         `gorm:"size:20;not null;default:'intermediate'" json:"difficulty"`
	Level       string         `gorm:"size:30" json:"level"`
	ScaleMinM   *float64       `json:"scale_min_m"`
	ScaleMaxM   *float64       `json:"scale_max_m"`
	ReviewStatus string        `gorm:"size:20;not null;default:'published'" json:"review_status"`
	ThemeID     uint           `gorm:"index" json:"theme_id"`
	OrderIndex  int            `gorm:"default:0" json:"order_index"`

	// 关联（many2many join 表由 AutoMigrate 自动创建）
	Figures     []Figure     `gorm:"many2many:milestone_figures" json:"figures,omitempty"`
	Experiments []Experiment `gorm:"many2many:milestone_experiments" json:"experiments,omitempty"`
}

// ContentReview 是审核留痕（experiment / milestone 二选一，见《架构设计》§7.1）。
type ContentReview struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	ExperimentID uint      `gorm:"index" json:"experiment_id"`
	MilestoneID  *uint     `gorm:"index" json:"milestone_id"`
	ReviewerID   uint      `json:"reviewer_id"`
	Action       string    `gorm:"size:20;not null" json:"action"` // submit | approve | reject | publish
	Comment      string    `gorm:"size:500" json:"comment"`
}

// Figure 是物理学家（FR-14 人物主线）。
type Figure struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Slug         string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Name         string         `gorm:"size:100;not null" json:"name"`
	NameEn       string         `gorm:"size:100" json:"name_en"`
	Born         int            `json:"born"` // 负数 = 公元前
	Died         int            `gorm:"default:0" json:"died"` // 0 = 在世
	Nationality  string         `gorm:"size:50" json:"nationality"`
	Contribution string         `gorm:"size:500;not null" json:"contribution"`
	Nobel        string         `gorm:"size:200" json:"nobel"`
	Bio          string         `gorm:"type:text" json:"bio"`
	Portrait     string         `gorm:"size:500" json:"portrait"` // 关联 assets.slug（预留）

	Milestones []Milestone `gorm:"many2many:milestone_figures" json:"milestones,omitempty"`
}
