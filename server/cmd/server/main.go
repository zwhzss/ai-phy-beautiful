package main

import (
	"log"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/router"
	"github.com/ai-phy-beautiful/server/internal/service"
	"go.uber.org/zap"
)

func main() {
	// 结构化日志
	var logger *zap.Logger
	var err error
	if cfgEnv := config.EnvOr("APP_ENV", "development"); cfgEnv == "production" {
		logger, err = zap.NewProduction()
	} else {
		logger, err = zap.NewDevelopment()
	}
	if err != nil {
		log.Fatalf("初始化日志失败: %v", err)
	}
	defer func() { _ = logger.Sync() }()
	zap.ReplaceGlobals(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("加载配置失败", zap.Error(err))
	}

	if err := service.InitDB(cfg); err != nil {
		logger.Fatal("初始化数据库失败", zap.Error(err))
	}

	logger.Info("物理之美服务启动中",
		zap.String("env", cfg.Server.Env),
		zap.String("port", cfg.Server.Port),
		zap.String("db", cfg.Database.Path),
		zap.String("audio_dir", cfg.AI.AudioDir),
	)

	if err := router.Start(cfg); err != nil {
		logger.Fatal("HTTP 服务启动失败", zap.Error(err))
	}
}
