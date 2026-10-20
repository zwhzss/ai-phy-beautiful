package model

import "time"

// 内容版本来源。
const (
	ContentSourceSeed = "seed" // 种子数据初始化的固定内容
	ContentSourceAI   = "ai"   // AI 大模型生成的内容
)

// ContentVersion 存档一个实验的某个版本的教学内容，实现「种子版与 AI 版两版共存」。
//
// 设计要点：
//   - Payload 存放完整教学内容的 JSON（ExperimentContent 结构，含讲解稿件），
//     因此新增字段无需改表结构；
//   - (experiment_id, source) 唯一：每个实验、每种来源只保留一条版本，重复生成即覆盖该来源的版本；
//   - IsActive 标记当前生效版本；experiments 与 narrations 表始终承载生效版本，
//     从而渲染、音频与播放链路完全无需改动。
type ContentVersion struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	ExperimentID uint      `gorm:"not null;uniqueIndex:idx_content_version_exp_source,priority:1" json:"experiment_id"`
	Source       string    `gorm:"size:20;not null;uniqueIndex:idx_content_version_exp_source,priority:2" json:"source"`
	IsActive     bool      `gorm:"default:false;index" json:"is_active"`
	ModelName    string    `gorm:"size:200" json:"model_name"`
	Payload      string    `gorm:"type:text" json:"payload"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
