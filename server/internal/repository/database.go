package repository

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var db *gorm.DB

// InitDB initializes the SQLite database and runs migrations
func InitDB(cfg *config.Config) error {
	// Ensure data directory exists
	dbDir := filepath.Dir(cfg.Database.Path)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	var err error
	db, err = gorm.Open(sqlite.Open(cfg.Database.Path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Run auto migration
	if err := db.AutoMigrate(
		&model.Category{},
		&model.Experiment{},
		&model.Narration{},
		&model.User{},
		&model.UserProgress{},
		&model.Bookmark{},
		&model.AIModel{},
		&model.ContentVersion{},
		// 物理之美新增（《架构设计.md》§7.1）
		&model.Theme{},
		&model.ScaleNode{},
		&model.Milestone{},
		&model.Figure{},
		&model.Asset{},
		&model.ContentReview{},
		&model.MilestoneNarration{},
	); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	zap.L().Info("Database initialized successfully", zap.String("path", cfg.Database.Path))
	return nil
}

// GetDB returns the global database instance
func GetDB() *gorm.DB {
	return db
}

// SeedData seeds the database with initial categories and experiments
func SeedData() error {
	var count int64
	db.Model(&model.Category{}).Count(&count)
	if count > 0 {
		return nil // Already seeded
	}

	zap.L().Info("Seeding initial data...")

	// Seed categories
	categories := []model.Category{
		{Name: "算术与数论", Slug: "arithmetic-number-theory", Level: "basic", OrderIndex: 1},
		{Name: "几何与空间", Slug: "geometry-space", Level: "basic", OrderIndex: 2},
		{Name: "代数与方程", Slug: "algebra-equations", Level: "intro", OrderIndex: 3},
		{Name: "函数与图像", Slug: "functions-graphs", Level: "intro", OrderIndex: 4},
		{Name: "概率统计", Slug: "probability-statistics", Level: "intro", OrderIndex: 5},
		{Name: "算法与数据结构", Slug: "algorithms-data-structures", Level: "intro", OrderIndex: 6},
		{Name: "三角学与复数", Slug: "trigonometry-complex", Level: "intermediate", OrderIndex: 7},
		{Name: "微积分", Slug: "calculus", Level: "intermediate", OrderIndex: 8},
		{Name: "线性代数", Slug: "linear-algebra", Level: "intermediate", OrderIndex: 9},
		{Name: "微分方程与动力系统", Slug: "ode-dynamics", Level: "advanced", OrderIndex: 10},
		{Name: "数值计算与优化", Slug: "numerical-optimization", Level: "advanced", OrderIndex: 11},
		{Name: "信号与傅里叶分析", Slug: "signal-fourier", Level: "advanced", OrderIndex: 12},
		{Name: "机器学习数学", Slug: "ml-math", Level: "advanced", OrderIndex: 13},
		{Name: "密码学", Slug: "cryptography", Level: "advanced", OrderIndex: 14},
		{Name: "微分几何与拓扑", Slug: "diff-geometry-topology", Level: "professional", OrderIndex: 15},
		{Name: "混沌与分形", Slug: "chaos-fractals", Level: "professional", OrderIndex: 16},
		{Name: "随机过程", Slug: "stochastic-processes", Level: "professional", OrderIndex: 17},
		{Name: "信息论与编码", Slug: "information-theory", Level: "professional", OrderIndex: 18},
		{Name: "物理应用", Slug: "physics-applications", Level: "professional", OrderIndex: 19},
	}

	for _, cat := range categories {
		db.Create(&cat)
	}

	zap.L().Info("Categories seeded", zap.Int("count", len(categories)))
	return nil
}
