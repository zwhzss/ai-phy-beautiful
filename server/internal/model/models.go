package model

import (
	"time"

	"gorm.io/gorm"
)

// Category represents a math topic category
type Category struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Name        string         `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Slug        string         `gorm:"size:50;not null;uniqueIndex" json:"slug"`
	OrderIndex  int            `gorm:"default:0" json:"order_index"`
	Description string         `gorm:"size:500" json:"description"`
	Level       string         `gorm:"size:20;not null" json:"level"` // basic, intro, intermediate, advanced, professional
	ThemeID     uint           `gorm:"index" json:"theme_id"`
	Theme       *Theme         `gorm:"foreignKey:ThemeID" json:"theme,omitempty"`
}

// Experiment represents a physics visualization exhibit（物理展项，原"实验"）
type Experiment struct {
	ID                 uint           `gorm:"primarykey" json:"id"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
	Slug               string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Title              string         `gorm:"size:200;not null" json:"title"`
	CategoryID         uint           `gorm:"index" json:"category_id"`
	Category           *Category      `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	ThemeID            uint           `gorm:"index" json:"theme_id"`
	Theme              *Theme         `gorm:"foreignKey:ThemeID" json:"theme,omitempty"`
	CategorySlug       string         `gorm:"-" json:"category_slug,omitempty"`         // 仅导入时使用，不落库
	Number             string         `gorm:"size:10;index" json:"number"`              // 架构文档编号，如 B01/M19/A52/P75
	Concept            string         `gorm:"size:300" json:"concept"`                  // 核心数学概念（目录种子）
	Difficulty         string         `gorm:"size:20;not null;index" json:"difficulty"` // basic, intro, intermediate, advanced, professional
	Level              string         `gorm:"size:30;not null" json:"level"`            // 小学, 初中, 高中, 大学, 研究生
	Description        string         `gorm:"type:text" json:"description"`
	Thumbnail          string         `gorm:"size:500" json:"thumbnail"`
	ParamsSchema       string         `gorm:"type:text;default:'{}'" json:"params_schema"`
	// Graph 为 AI 生成的图形描述（JSON 字符串），供前端通用渲染器绘制。
	Graph string `gorm:"type:text" json:"graph"`
	VizComponent       string         `gorm:"size:100;not null" json:"viz_component"`
	Formulas           string         `gorm:"type:text;default:'[]'" json:"formulas"`
	HistoryInfo        string         `gorm:"type:text;default:'{}'" json:"history_info"`
	AppHooks           string         `gorm:"type:text;default:'[]'" json:"app_hooks"`
	Prerequisites      string         `gorm:"type:text;default:'[]'" json:"prerequisites"`
	RelatedExperiments string         `gorm:"type:text;default:'[]'" json:"related_experiments"`
	// ContentStatus 标记 AI 教学内容生成状态：pending/generating/ready/failed
	ContentStatus string     `gorm:"size:20;default:'pending';index" json:"content_status"`
	ContentError  string     `gorm:"size:500" json:"content_error"`
	GeneratedAt   *time.Time `json:"generated_at"`
	SortIndex     int        `gorm:"default:0" json:"sort_index"`
	// 物理之美新增（《架构设计》§7.2）
	Certainty    string `gorm:"size:30;default:'observed';index" json:"certainty"` // 五级确定性标签
	ReviewStatus string `gorm:"size:20;default:'draft';index" json:"review_status"`
	// ContentSource 是当前生效的内容版本来源（seed / ai），仅在响应里返回、不落库。
	// 前端据此判断该画种子图形还是 AI 图形（AI 版没有 graph 时应提示，而不是画种子图）。
	ContentSource string `gorm:"-" json:"content_source,omitempty"`
}

// Narration represents a narration line for an experiment
type Narration struct {
	ID            uint           `gorm:"primarykey" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	ExperimentID  uint           `gorm:"index;not null" json:"experiment_id"`
	SectionID     string         `gorm:"size:50;not null" json:"section_id"`
	SectionTitle  string         `gorm:"size:100" json:"section_title"`
	LineIndex     int            `gorm:"not null" json:"line_index"`
	LineID        string         `gorm:"size:100;not null" json:"line_id"`
	Text          string         `gorm:"type:text;not null" json:"text"`
	AudioYunxi    string         `gorm:"size:500" json:"audio_yunxi"`
	AudioXiaoxiao string         `gorm:"size:500" json:"audio_xiaoxiao"`
	DurationMs    int            `gorm:"default:0" json:"duration_ms"`
	AnimationCfg  string         `gorm:"type:text;default:'{}'" json:"animation_cfg"`
}

// User represents an application user
type User struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Username     string         `gorm:"size:50;not null;uniqueIndex" json:"username"`
	Email        string         `gorm:"size:100;not null;uniqueIndex" json:"email"`
	PasswordHash string         `gorm:"size:255;not null" json:"-"`
	Role         string         `gorm:"size:20;default:'user'" json:"role"` // user, admin
}

// UserProgress tracks a user's progress on an experiment
type UserProgress struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	UserID       uint           `gorm:"index;not null" json:"user_id"`
	ExperimentID uint           `gorm:"index;not null" json:"experiment_id"`
	Completed    bool           `gorm:"default:false" json:"completed"`
	CurrentLine  int            `gorm:"default:0" json:"current_line"`
	DurationSec  int            `gorm:"default:0" json:"duration_sec"`
	LastAccess   time.Time      `gorm:"not null" json:"last_access"`

	// Experiment 为关联实验（非数据库列），列表接口 Preload 后供前端显示标题与跳转。
	Experiment *Experiment `gorm:"foreignKey:ExperimentID" json:"experiment,omitempty"`
}

// Bookmark represents a user's bookmarked experiment
type Bookmark struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	UserID       uint           `gorm:"index;not null" json:"user_id"`
	ExperimentID uint           `gorm:"index;not null" json:"experiment_id"`

	// Experiment 为关联实验（非数据库列），列表接口 Preload 后供前端显示标题与跳转。
	Experiment *Experiment `gorm:"foreignKey:ExperimentID" json:"experiment,omitempty"`
}

// API Response wrapper
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
