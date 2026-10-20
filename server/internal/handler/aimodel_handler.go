package handler

import (
	"net/http"
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/ai-phy-beautiful/server/pkg/response"
	"github.com/gin-gonic/gin"
)

// AIModelHandler 提供大模型配置的增删改查与激活/测试接口（需求 5）。
type AIModelHandler struct {
	svc *service.AIModelService
}

func NewAIModelHandler(svc *service.AIModelService) *AIModelHandler {
	return &AIModelHandler{svc: svc}
}

// List GET /api/v1/admin/ai-models?type=llm
func (h *AIModelHandler) List(c *gin.Context) {
	items, err := h.svc.List(c.Query("type"))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, items)
}

// Create POST /api/v1/admin/ai-models
func (h *AIModelHandler) Create(c *gin.Context) {
	var req model.AIModel
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求体格式不正确")
		return
	}
	item, err := h.svc.Create(&req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessMsg(c, "大模型配置已创建", service.ToView(item))
}

// Update PUT /api/v1/admin/ai-models/:id
func (h *AIModelHandler) Update(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的配置 ID")
		return
	}
	var req model.AIModel
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求体格式不正确")
		return
	}
	item, err := h.svc.Update(id, &req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessMsg(c, "大模型配置已更新", service.ToView(item))
}

// Delete DELETE /api/v1/admin/ai-models/:id
func (h *AIModelHandler) Delete(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的配置 ID")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessMsg(c, "大模型配置已删除", nil)
}

// Activate POST /api/v1/admin/ai-models/:id/activate
// 相同类型只能激活一个，服务层会在事务中取消同类型其它配置的激活状态。
func (h *AIModelHandler) Activate(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的配置 ID")
		return
	}
	item, err := h.svc.Activate(id)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessMsg(c, "已激活", service.ToView(item))
}

// Test POST /api/v1/admin/ai-models/:id/test
func (h *AIModelHandler) Test(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的配置 ID")
		return
	}
	detail, testErr := h.svc.Test(c.Request.Context(), id)
	if testErr != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "message": "连接测试失败: " + testErr.Error(), "data": gin.H{"detail": detail}})
		return
	}
	response.SuccessMsg(c, "连接测试成功", gin.H{"detail": detail})
}

// Stats GET /api/v1/admin/ai-models/stats
func (h *AIModelHandler) Stats(c *gin.Context) {
	data, err := h.svc.Stats()
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, data)
}

// parseUintParam 解析路径中的无符号整数参数。
func parseUintParam(c *gin.Context, name string) (uint, error) {
	v, err := strconv.ParseUint(c.Param(name), 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(v), nil
}
