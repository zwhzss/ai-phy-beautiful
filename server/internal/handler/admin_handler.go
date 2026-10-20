package handler

import (
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/seed"
	"github.com/ai-phy-beautiful/server/pkg/response"
	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	db     *repository.DatabaseRepo
	expSvc experimentAdminService
}

// experimentAdminService 只暴露管理后台需要的实验读写能力。
type experimentAdminService interface {
	UpdateFields(id uint, fields map[string]any) error
}

func NewAdminHandler(db *repository.DatabaseRepo, svc experimentAdminService) *AdminHandler {
	return &AdminHandler{db: db, expSvc: svc}
}

// getCategoryID finds a category by slug and returns its ID
func (h *AdminHandler) getCategoryID(slug string) (uint, error) {
	var cat model.Category
	if err := h.db.Where("slug = ?", slug).First(&cat).Error; err != nil {
		return 0, err
	}
	return cat.ID, nil
}

// GetStats 返回系统统计数据（含内容生成进度与音频覆盖）。
func (h *AdminHandler) GetStats(c *gin.Context) {
	var expCount, catCount, userCount, narrCount, aiModelCount int64

	h.db.Model(&model.Experiment{}).Count(&expCount)
	h.db.Model(&model.Category{}).Count(&catCount)
	h.db.Model(&model.User{}).Count(&userCount)
	h.db.Model(&model.Narration{}).Count(&narrCount)
	h.db.Model(&model.AIModel{}).Count(&aiModelCount)

	type statusRow struct {
		ContentStatus string
		Total         int64
	}
	var statusRows []statusRow
	h.db.Model(&model.Experiment{}).
		Select("content_status, COUNT(*) AS total").
		Group("content_status").Scan(&statusRows)
	contentStatus := map[string]int64{}
	for _, r := range statusRows {
		contentStatus[r.ContentStatus] = r.Total
	}

	type diffRow struct {
		Difficulty string
		Total      int64
	}
	var diffRows []diffRow
	h.db.Model(&model.Experiment{}).
		Select("difficulty, COUNT(*) AS total").
		Group("difficulty").Scan(&diffRows)
	byDifficulty := map[string]int64{}
	for _, r := range diffRows {
		byDifficulty[r.Difficulty] = r.Total
	}

	var withYunxi, withXiaoxiao int64
	h.db.Model(&model.Narration{}).Where("audio_yunxi <> ''").Count(&withYunxi)
	h.db.Model(&model.Narration{}).Where("audio_xiaoxiao <> ''").Count(&withXiaoxiao)

	response.Success(c, gin.H{
		"experiments":          expCount,
		"categories":           catCount,
		"users":                userCount,
		"narrations":           narrCount,
		"ai_models":            aiModelCount,
		"content_status":       contentStatus,
		"by_difficulty":        byDifficulty,
		"audio_lines_yunxi":    withYunxi,
		"audio_lines_xiaoxiao": withXiaoxiao,
	})
}

// CreateExperiment creates a new experiment
func (h *AdminHandler) CreateExperiment(c *gin.Context) {
	var req model.Experiment
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body")
		return
	}

	if req.CategorySlug != "" {
		if id, err := h.getCategoryID(req.CategorySlug); err == nil {
			req.CategoryID = id
		}
		req.CategorySlug = ""
	}
	defaults(&req)

	if err := h.db.Create(&req).Error; err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessMsg(c, "experiment created", req)
}

// UpdateExperiment updates an experiment
func (h *AdminHandler) UpdateExperiment(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var exp model.Experiment
	if err := h.db.First(&exp, id).Error; err != nil {
		response.NotFound(c, "experiment not found")
		return
	}

	var req model.Experiment
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body")
		return
	}

	fields := map[string]any{
		"title":               req.Title,
		"category_id":         req.CategoryID,
		"difficulty":          req.Difficulty,
		"level":               req.Level,
		"description":         req.Description,
		"thumbnail":           req.Thumbnail,
		"params_schema":       req.ParamsSchema,
		"viz_component":       req.VizComponent,
		"formulas":            req.Formulas,
		"history_info":        req.HistoryInfo,
		"app_hooks":           req.AppHooks,
		"prerequisites":       req.Prerequisites,
		"related_experiments": req.RelatedExperiments,
	}
	if err := h.expSvc.UpdateFields(exp.ID, fields); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.SuccessMsg(c, "experiment updated", exp)
}

// DeleteExperiment deletes an experiment
func (h *AdminHandler) DeleteExperiment(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	// 关联删除讲解稿件，避免留下孤立数据。
	h.db.Where("experiment_id = ?", id).Delete(&model.Narration{})
	if err := h.db.Delete(&model.Experiment{}, id).Error; err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessMsg(c, "experiment deleted", nil)
}

// BulkImportExperiments imports experiments from JSON
func (h *AdminHandler) BulkImportExperiments(c *gin.Context) {
	var req struct {
		Experiments []model.Experiment `json:"experiments" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body")
		return
	}

	created := 0
	for i := range req.Experiments {
		exp := &req.Experiments[i]
		if exp.CategorySlug != "" {
			if id, err := h.getCategoryID(exp.CategorySlug); err == nil {
				exp.CategoryID = id
			}
			exp.CategorySlug = ""
		}
		defaults(exp)
		if err := h.db.Create(exp).Error; err != nil {
			response.InternalError(c, "failed to import experiment "+exp.Slug+": "+err.Error())
			return
		}
		created++
	}

	response.SuccessMsg(c, "imported "+strconv.Itoa(created)+" experiments", nil)
}

// GetExperiments returns all experiments with category preloaded (for admin management)
func (h *AdminHandler) GetExperiments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 500 {
		pageSize = 50
	}

	query := h.db.Model(&model.Experiment{})
	if d := c.Query("difficulty"); d != "" {
		query = query.Where("difficulty = ?", d)
	}
	if s := c.Query("content_status"); s != "" {
		query = query.Where("content_status = ?", s)
	}
	if cid := c.Query("category_id"); cid != "" {
		query = query.Where("category_id = ?", cid)
	}
	if kw := c.Query("q"); kw != "" {
		like := "%" + kw + "%"
		query = query.Where("title LIKE ? OR slug LIKE ? OR concept LIKE ?", like, like, like)
	}

	var total int64
	query.Count(&total)

	var experiments []model.Experiment
	if err := query.Preload("Category").
		Order("sort_index ASC, id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&experiments).Error; err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"experiments": experiments,
		"total":       total,
		"page":        page,
		"pageSize":    pageSize,
	})
}

// SeedExperiments 重新应用《架构设计.md》的实验目录（幂等，不会覆盖已生成的 AI 内容）。
func (h *AdminHandler) SeedExperiments(c *gin.Context) {
	res, err := seed.ApplyWithTx(h.db.DB())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessMsg(c, "实验目录已同步", res)
}

// GetCategories 返回全部分类（管理后台筛选与分组展示使用）。
func (h *AdminHandler) GetCategories(c *gin.Context) {
	var categories []model.Category
	if err := h.db.Model(&model.Category{}).Order("order_index ASC, id ASC").Find(&categories).Error; err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, categories)
}

// defaults 为缺省字段补默认值，避免写入空 JSON 导致前端解析失败。
func defaults(exp *model.Experiment) {
	if exp.ParamsSchema == "" {
		exp.ParamsSchema = "{}"
	}
	if exp.Formulas == "" {
		exp.Formulas = "[]"
	}
	if exp.HistoryInfo == "" {
		exp.HistoryInfo = "{}"
	}
	if exp.AppHooks == "" {
		exp.AppHooks = "[]"
	}
	if exp.Prerequisites == "" {
		exp.Prerequisites = "[]"
	}
	if exp.RelatedExperiments == "" {
		exp.RelatedExperiments = "[]"
	}
	if exp.ContentStatus == "" {
		exp.ContentStatus = "pending"
	}
	if exp.VizComponent == "" {
		exp.VizComponent = "DefaultViz"
	}
}
