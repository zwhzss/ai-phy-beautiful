package handler

import (
	"net/http"
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/gin-gonic/gin"
)

type BookmarkHandler struct {
	svc *service.BookmarkService
}

func NewBookmarkHandler(svc *service.BookmarkService) *BookmarkHandler {
	return &BookmarkHandler{svc: svc}
}

func (h *BookmarkHandler) List(c *gin.Context) {
	userID := getUserIDFromContext(c)

	bookmarks, err := h.svc.List(uint(userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": bookmarks})
}

func (h *BookmarkHandler) Add(c *gin.Context) {
	userID := getUserIDFromContext(c)
	expID, _ := strconv.ParseUint(c.Param("experiment_id"), 10, 32)

	bm, err := h.svc.Add(uint(userID), uint(expID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": bm})
}

func (h *BookmarkHandler) Delete(c *gin.Context) {
	userID := getUserIDFromContext(c)
	expID, _ := strconv.ParseUint(c.Param("experiment_id"), 10, 32)

	if err := h.svc.Delete(uint(userID), uint(expID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "deleted"})
}

func (h *BookmarkHandler) Exists(c *gin.Context) {
	userID := getUserIDFromContext(c)
	expID, _ := strconv.ParseUint(c.Param("experiment_id"), 10, 32)

	exists, err := h.svc.Exists(uint(userID), uint(expID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"exists": exists}})
}
