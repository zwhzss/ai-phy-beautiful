package handler

import (
	"net/http"
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/gin-gonic/gin"
)

type ExperimentHandler struct {
	svc      *service.ExperimentService
	versions *service.ContentVersionService
}

func NewExperimentHandler(svc *service.ExperimentService) *ExperimentHandler {
	return &ExperimentHandler{svc: svc, versions: service.NewContentVersionService()}
}

func (h *ExperimentHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	var categoryID *uint
	if cid := c.Query("category_id"); cid != "" {
		v, err := strconv.ParseUint(cid, 10, 32)
		if err == nil {
			vu := uint(v)
			categoryID = &vu
		}
	}

	var difficulty *string
	if d := c.Query("difficulty"); d != "" {
		difficulty = &d
	}

	// 物理之美：按板块（theme slug）筛选
	var themeSlug *string
	if t := c.Query("theme"); t != "" {
		themeSlug = &t
	}

	experiments, total, err := h.svc.List(page, pageSize, categoryID, difficulty, themeSlug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"experiments": experiments,
			"total":       total,
			"page":        page,
			"pageSize":    pageSize,
		},
	})
}

func (h *ExperimentHandler) GetByID(c *gin.Context) {
	slug := c.Param("slug")
	exp, err := h.svc.GetBySlug(slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "experiment not found"})
		return
	}
	// 告诉前端「当前生效的是哪一版」：AI 版生效但内容里没有 graph 时，
	// 前端要提示「AI 版暂无图形数据」，而不是退回种子图形（否则声文图不一致）。
	if h.versions != nil {
		exp.ContentSource = h.versions.ActiveSource(exp.ID)
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": exp})
}

func (h *ExperimentHandler) Search(c *gin.Context) {
	q := c.Query("q")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	experiments, total, err := h.svc.Search(q, page, 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"experiments": experiments,
			"total":       total,
		},
	})
}

func (h *ExperimentHandler) GetByCategory(c *gin.Context) {
	categorySlug := c.Param("category_slug")
	experiments, err := h.svc.GetByCategory(categorySlug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": experiments})
}

// ListCategories GET /api/v1/categories
// 返回按 order_index 排序的全部分类（首页分组与筛选使用）。
func (h *ExperimentHandler) ListCategories(c *gin.Context) {
	categories, err := h.svc.ListCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": categories})
}
