package router

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/handler"
	"github.com/ai-phy-beautiful/server/internal/middleware"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/gin-gonic/gin"
)

// Start 初始化路由并启动 HTTP 服务（监听 cfg.Server.Port）。
func Start(cfg *config.Config) error {
	r, err := buildRouter(cfg)
	if err != nil {
		return err
	}
	return r.Run(":" + cfg.Server.Port)
}

// StartWithListener 复用调用方已建立的 listener 启动服务。
// 桌面端用它消除"释放端口再监听"的竞态：端口从申请到服务全程不离手，
// 避免空闲窗口期被其他进程抢走导致后端静默失败。
func StartWithListener(cfg *config.Config, ln net.Listener) error {
	r, err := buildRouter(cfg)
	if err != nil {
		return err
	}
	return r.RunListener(ln)
}

// buildRouter 构建完整路由（Start 与 StartWithListener 共用）。
func buildRouter(cfg *config.Config) (*gin.Engine, error) {
	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(middleware.CORS())

	// 注入 AI 调用超时（生成教学内容可能耗时较久）
	handler.SetAITimeout(cfg.RequestTimeoutDuration())

	// 服务与仓储
	expSvc := service.NewExperimentService()
	narrSvc := service.NewNarrationService()
	progressSvc := service.NewProgressService()
	bookmarkSvc := service.NewBookmarkService()
	userSvc := service.NewUserService(cfg)
	aiSvc := service.NewAIModelService()
	contentSvc := service.NewContentService(aiSvc, cfg.AI.AudioDir)
	dbRepo := repository.NewDatabaseRepo()

	// 处理器
	expHandler := handler.NewExperimentHandler(expSvc)
	narrHandler := handler.NewNarrationHandler(narrSvc)
	progressHandler := handler.NewProgressHandler(progressSvc)
	bookmarkHandler := handler.NewBookmarkHandler(bookmarkSvc)
	authHandler := handler.NewAuthHandler(userSvc)
	adminHandler := handler.NewAdminHandler(dbRepo, expSvc)
	aiHandler := handler.NewAIModelHandler(aiSvc)
	contentHandler := handler.NewContentHandler(contentSvc)
	catalogHandler := handler.NewCatalogHandler()
	reviewHandler := handler.NewReviewHandler()

	api := r.Group("/api/v1")
	{
		// 认证
		api.POST("/auth/register", authHandler.Register)
		api.POST("/auth/login", authHandler.Login)

		// 物理之美：板块 / 尺度轴 / 里程碑 / 物理学家（公开）
		api.GET("/themes", catalogHandler.Themes)
		api.GET("/scale", catalogHandler.Scale)
		api.GET("/milestones", catalogHandler.Milestones)
		api.GET("/milestones/:slug", catalogHandler.MilestoneDetail)
		api.GET("/milestones/:slug/narrations", catalogHandler.MilestoneNarrations)
		api.GET("/figures", catalogHandler.Figures)
		api.GET("/figures/:slug", catalogHandler.FigureDetail)
		api.GET("/assets", catalogHandler.Assets)
		api.GET("/assets/:slug", catalogHandler.AssetDetail)

		// 实验（公开）
		api.GET("/experiments", expHandler.List)
		api.GET("/experiments/search", expHandler.Search)
		api.GET("/experiments/:slug", expHandler.GetByID)
		api.GET("/experiments/:slug/narrations", narrHandler.GetScript)
		api.GET("/categories", expHandler.ListCategories)
		api.GET("/categories/:category_slug/experiments", expHandler.GetByCategory)

		// 讲解（公开）
		api.GET("/narrations/:experiment_id", narrHandler.ListByExperiment)
		api.GET("/narrations/:experiment_id/:line_id/audio", narrHandler.GetAudio)
	}

	// 需要登录
	protected := api.Group("")
	protected.Use(middleware.AuthRequired())
	{
		protected.GET("/auth/me", authHandler.Me)

		protected.GET("/progress", progressHandler.ListByUser)
		protected.GET("/progress/:experiment_id", progressHandler.Get)
		protected.PUT("/progress/:experiment_id", progressHandler.Update)
		// 记录一次学习访问（进入实验即计入「已学习」，幂等）
		protected.POST("/progress/:experiment_id/touch", progressHandler.Touch)

		protected.GET("/bookmarks", bookmarkHandler.List)
		protected.POST("/bookmarks/:experiment_id", bookmarkHandler.Add)
		protected.DELETE("/bookmarks/:experiment_id", bookmarkHandler.Delete)
		protected.GET("/bookmarks/:experiment_id/exists", bookmarkHandler.Exists)
	}

	// 管理后台（需要管理员）
	admin := api.Group("/admin")
	admin.Use(middleware.AuthRequired(), middleware.AdminRequired())
	{
		// 概览
		admin.GET("/stats", adminHandler.GetStats)
		admin.GET("/content/overview", contentHandler.Overview)
		admin.GET("/content/estimate", contentHandler.Estimate)

		// 实验管理
		admin.GET("/experiments", adminHandler.GetExperiments)
		admin.POST("/experiments", adminHandler.CreateExperiment)
		admin.POST("/experiments/bulk-import", adminHandler.BulkImportExperiments)
		admin.PUT("/experiments/:id", adminHandler.UpdateExperiment)
		admin.DELETE("/experiments/:id", adminHandler.DeleteExperiment)
		admin.GET("/categories", adminHandler.GetCategories)
		admin.POST("/seed-experiments", adminHandler.SeedExperiments)

		// 内容审核工作流（《架构设计》§9：submit/approve/reject/publish + 留痕）
		admin.POST("/experiments/:id/review", reviewHandler.Review)
		admin.GET("/experiments/:id/reviews", reviewHandler.ListReviews)

		// AI 教学内容生成与语音合成
		admin.POST("/experiments/generate-batch", contentHandler.GenerateBatch)
		admin.POST("/experiments/:id/generate", contentHandler.Generate)
		// 流式生成教学内容（SSE，供前端「AI 教学」tab 使用）
		admin.POST("/experiments/:id/generate-stream", contentHandler.GenerateStream)
		admin.GET("/experiments/:id/narrations", contentHandler.NarrationList)
		admin.POST("/experiments/:id/narrations", contentHandler.NarrationImport)
		admin.POST("/experiments/:id/narrations/synthesize", contentHandler.Synthesize)
		// 内容版本（种子版 / AI 版共存）
		admin.GET("/experiments/:id/versions", contentHandler.VersionList)
		admin.GET("/experiments/:id/versions/:source/content", contentHandler.VersionContent)
		admin.POST("/experiments/:id/versions/:source/activate", contentHandler.VersionActivate)
		admin.POST("/narrations/synthesize-batch", contentHandler.SynthesizeBatch)
		admin.PUT("/narrations/:line_id", contentHandler.NarrationUpdate)
		admin.DELETE("/narrations/:line_id", contentHandler.NarrationDelete)

		// 大模型配置（需求 5：激活/测试/删除/编辑，同类型只能激活一个）
		admin.GET("/ai-models", aiHandler.List)
		admin.POST("/ai-models", aiHandler.Create)
		admin.GET("/ai-models/stats", aiHandler.Stats)
		admin.PUT("/ai-models/:id", aiHandler.Update)
		admin.DELETE("/ai-models/:id", aiHandler.Delete)
		admin.POST("/ai-models/:id/activate", aiHandler.Activate)
		admin.POST("/ai-models/:id/test", aiHandler.Test)
	}

	// 静态资源：讲解音频
	audioDir := cfg.AI.AudioDir
	if audioDir == "" {
		audioDir = filepath.Join("data", "audio")
	}
	if err := os.MkdirAll(audioDir, 0o755); err != nil {
		// 降级而非中止：音频目录不可写只影响音频播放，注册/内容等 API 不该陪葬。
		fmt.Fprintf(os.Stderr, "音频目录创建失败（音频将不可用）: %v\n", err)
	}
	r.Static("/audio", audioDir)

	// 素材资产静态服务（图片/数据集，元数据见 /api/v1/assets）。
	// 路径用 /phy-assets：/assets 是 SPA 资源目录，/media 是 Angular 构建的哈希字体输出目录（均会路由冲突）。
	assetsDir := os.Getenv("ASSETS_DIR")
	if assetsDir == "" {
		assetsDir = filepath.Join("data", "assets")
	}
	if err := os.MkdirAll(assetsDir, 0o755); err != nil {
		// 降级而非中止：素材目录不可写只影响配图展示，API 服务不该陪葬
		//（安装版工作目录不可写曾使整个后端起不来）。
		fmt.Fprintf(os.Stderr, "素材目录创建失败（配图将不可用）: %v\n", err)
	}
	r.Static("/phy-assets", assetsDir)

	// 可选：托管前端构建产物（Wails 桌面端与生产单进程部署使用）
	if cfg.Server.StaticDir != "" {
		mountSPA(r, cfg.Server.StaticDir)
	}

	return r, nil
}

// mountSPA 托管静态前端，并对非 /api、/audio 的未知路径回退到 index.html。
func mountSPA(r *gin.Engine, dir string) {
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		return
	}
	assetsDir := filepath.Join(dir, "assets")
	if info, err := os.Stat(assetsDir); err == nil && info.IsDir() {
		r.Static("/assets", assetsDir)
	}

	indexPath := filepath.Join(dir, "index.html")
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/audio") || strings.HasPrefix(path, "/phy-assets") {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}
		if path != "/" {
			candidate := filepath.Join(dir, filepath.Clean(path))
			if file, err := os.Stat(candidate); err == nil && !file.IsDir() {
				c.File(candidate)
				return
			}
		}
		c.File(indexPath)
	})
}
