package handler

import (
	"net/http"
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/gin-gonic/gin"
)

// CatalogHandler 提供板块 / 尺度轴 / 里程碑 / 物理学家的公开查询接口。
type CatalogHandler struct {
	svc *service.CatalogService
}

func NewCatalogHandler() *CatalogHandler {
	return &CatalogHandler{svc: service.NewCatalogService()}
}

// Themes GET /api/v1/themes
func (h *CatalogHandler) Themes(c *gin.Context) {
	themes, err := h.svc.ListThemes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": themes})
}

// Scale GET /api/v1/scale?axis=length|time|speed
func (h *CatalogHandler) Scale(c *gin.Context) {
	nodes, err := h.svc.ListScaleNodes(c.Query("axis"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nodes})
}

// Milestones GET /api/v1/milestones?kind=&theme=&difficulty=&q=&page=&pageSize=
func (h *CatalogHandler) Milestones(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "100"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 100
	}
	list, total, err := h.svc.ListMilestones(service.MilestoneQuery{
		Kind:       c.Query("kind"),
		ThemeSlug:  c.Query("theme"),
		Difficulty: c.Query("difficulty"),
		Q:          c.Query("q"),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code": 0, "message": "success",
		"data": gin.H{"milestones": list, "total": total, "page": page, "pageSize": pageSize},
	})
}

// MilestoneNarrations GET /api/v1/milestones/:slug/narrations
// 返回里程碑讲解稿件（结构同展项 NarrationScript，音频为可直接播放的绝对地址）。
func (h *CatalogHandler) MilestoneNarrations(c *gin.Context) {
	script, err := h.svc.GetMilestoneScript(c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "milestone not found"})
		return
	}
	for si := range script.Sections {
		for li := range script.Sections[si].Lines {
			line := &script.Sections[si].Lines[li]
			line.AudioYunxi = absoluteURL(c, line.AudioYunxi)
			line.AudioXiaoxiao = absoluteURL(c, line.AudioXiaoxiao)
		}
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": script})
}

// MilestoneDetail GET /api/v1/milestones/:slug
func (h *CatalogHandler) MilestoneDetail(c *gin.Context) {
	m, err := h.svc.GetMilestone(c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "milestone not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": m})
}

// Assets GET /api/v1/assets?kind=&q=
func (h *CatalogHandler) Assets(c *gin.Context) {
	list, err := h.svc.ListAssets(c.Query("kind"), c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": list})
}

// AssetDetail GET /api/v1/assets/:slug
func (h *CatalogHandler) AssetDetail(c *gin.Context) {
	a, err := h.svc.GetAsset(c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "asset not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": a})
}

// Figures GET /api/v1/figures?q=
func (h *CatalogHandler) Figures(c *gin.Context) {
	list, err := h.svc.ListFigures(c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": list})
}

// FigureDetail GET /api/v1/figures/:slug
func (h *CatalogHandler) FigureDetail(c *gin.Context) {
	f, err := h.svc.GetFigure(c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "figure not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": f})
}
