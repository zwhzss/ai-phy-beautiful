package handler

import (
	"net/http"
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/gin-gonic/gin"
)

type ProgressHandler struct {
	svc *service.ProgressService
}

func NewProgressHandler(svc *service.ProgressService) *ProgressHandler {
	return &ProgressHandler{svc: svc}
}

func (h *ProgressHandler) Get(c *gin.Context) {
	userID := getUserIDFromContext(c)
	expID, _ := strconv.ParseUint(c.Param("experiment_id"), 10, 32)

	progress, err := h.svc.Get(uint(userID), uint(expID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": progress})
}

func (h *ProgressHandler) Update(c *gin.Context) {
	userID := getUserIDFromContext(c)
	expID, _ := strconv.ParseUint(c.Param("experiment_id"), 10, 32)

	var req struct {
		LineIndex   int  `json:"line_index"`
		DurationSec int  `json:"duration_sec"`
		Completed   bool `json:"completed"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request"})
		return
	}

	progress, err := h.svc.Update(uint(userID), uint(expID), req.LineIndex, req.DurationSec, req.Completed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": progress})
}

func (h *ProgressHandler) ListByUser(c *gin.Context) {
	userID := getUserIDFromContext(c)

	progresses, err := h.svc.GetByUser(uint(userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": progresses})
}

// Touch 记录一次学习访问：前端打开实验详情页时调用，把该实验计入「已学习」。
// 幂等且不清除完成状态，可安全重复调用。
func (h *ProgressHandler) Touch(c *gin.Context) {
	userID := getUserIDFromContext(c)
	expID, _ := strconv.ParseUint(c.Param("experiment_id"), 10, 32)

	progress, err := h.svc.Touch(uint(userID), uint(expID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": progress})
}
