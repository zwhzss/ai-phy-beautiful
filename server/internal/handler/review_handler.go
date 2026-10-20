package handler

import (
	"fmt"
	"net/http"

	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ReviewHandler 实现内容审核工作流（《架构设计.md》§9）：
//   submit   draft → advisor-review（提交顾问审核）
//   approve  advisor-review → asset-ready（顾问通过）
//   reject   → draft（退回并记录意见）
//   publish  asset-ready/render-ready → published（发布，校验确定性标签 QA-1）
//
// 每一步写入 content_reviews 留痕。
type ReviewHandler struct {
	db *gorm.DB
}

func NewReviewHandler() *ReviewHandler {
	return &ReviewHandler{db: repository.GetDB()}
}

type reviewBody struct {
	Action  string `json:"action"`
	Comment string `json:"comment"`
}

// Review POST /api/v1/admin/experiments/:id/review
func (h *ReviewHandler) Review(c *gin.Context) {
	id := c.Param("id")
	var exp model.Experiment
	if err := h.db.First(&exp, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "experiment not found"})
		return
	}
	var body reviewBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid body"})
		return
	}

	next := exp.ReviewStatus
	switch body.Action {
	case "submit":
		next = "advisor-review"
	case "approve":
		next = "asset-ready"
	case "reject":
		next = "draft"
	case "publish":
		// QA-1：确定性标签必填才可发布
		if exp.Certainty == "" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"code": 422, "message": "缺少确定性标签（certainty），不可发布"})
			return
		}
		next = "published"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "action must be submit|approve|reject|publish"})
		return
	}

	if err := h.db.Model(&model.Experiment{}).Where("id = ?", exp.ID).
		Update("review_status", next).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	reviewerID := uint(0)
	if uid, ok := c.Get("user_id"); ok {
		if v, ok2 := uid.(uint); ok2 {
			reviewerID = v
		}
	}
	rec := model.ContentReview{
		ExperimentID: exp.ID, MilestoneID: nil, ReviewerID: reviewerID,
		Action: body.Action, Comment: fmt.Sprintf("%s%s", statusLabel(body.Action), commentSuffix(body.Comment)),
	}
	if err := h.db.Create(&rec).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"id": exp.ID, "review_status": next}})
}

// ListReviews GET /api/v1/admin/experiments/:id/reviews
func (h *ReviewHandler) ListReviews(c *gin.Context) {
	id := c.Param("id")
	var exp model.Experiment
	if err := h.db.First(&exp, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "experiment not found"})
		return
	}
	var rows []model.ContentReview
	if err := h.db.Where("experiment_id = ?", exp.ID).Order("id DESC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rows})}

func statusLabel(action string) string {
	switch action {
	case "submit":
		return "提交审核"
	case "approve":
		return "顾问通过"
	case "reject":
		return "退回修改"
	case "publish":
		return "发布"
	}
	return action
}

func commentSuffix(comment string) string {
	if comment == "" {
		return ""
	}
	return "：" + comment
}
