package model

import (
	"time"

	"gorm.io/gorm"
)

// Asset 是素材资产（《架构设计.md》§7.1）：文件不入 DB，只存元数据与相对路径。
// kind: image | video | audio | dataset
type Asset struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Slug        string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Kind        string         `gorm:"size:20;not null;index" json:"kind"`
	Title       string         `gorm:"size:200;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	RelPath     string         `gorm:"size:500;not null" json:"rel_path"`
	SourceOrg   string         `gorm:"size:100;not null" json:"source_org"`
	SourceURL   string         `gorm:"size:500" json:"source_url"`
	License     string         `gorm:"size:100;not null" json:"license"`
	Credit      string         `gorm:"size:200" json:"credit"`
	Year        int            `json:"year"`
	Certainty   string         `gorm:"size:30;not null;default:'observed'" json:"certainty"`
	ScaleValue  *float64       `json:"scale_value"`
	Checksum    string         `gorm:"size:64" json:"checksum"`
	SizeBytes   int64          `json:"size_bytes"`
}
