package handler

import (
	"strings"

	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/ai-phy-beautiful/server/pkg/response"
	"github.com/gin-gonic/gin"
)

type NarrationHandler struct {
	svc *service.NarrationService
}

func NewNarrationHandler(svc *service.NarrationService) *NarrationHandler {
	return &NarrationHandler{svc: svc}
}

// ListByExperiment GET /api/v1/narrations/:experiment_id
func (h *NarrationHandler) ListByExperiment(c *gin.Context) {
	expID, err := parseUintParam(c, "experiment_id")
	if err != nil {
		response.BadRequest(c, "无效的实验 ID")
		return
	}
	narrations, listErr := h.svc.ListByExperiment(expID)
	if listErr != nil {
		response.InternalError(c, listErr.Error())
		return
	}
	response.Success(c, narrations)
}

// GetScript GET /api/v1/experiments/:slug/narrations
// 返回按段落组织的讲解稿件，供 PPT 式讲解覆盖层使用。
func (h *NarrationHandler) GetScript(c *gin.Context) {
	slug := c.Param("slug")
	script, err := h.svc.GetScriptBySlug(slug)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, absolutizeScript(c, script))
}

// GetAudio GET /api/v1/narrations/:experiment_id/:line_id/audio?voice=yunxi
func (h *NarrationHandler) GetAudio(c *gin.Context) {
	expID, err := parseUintParam(c, "experiment_id")
	if err != nil {
		response.BadRequest(c, "无效的实验 ID")
		return
	}
	lineID := c.Param("line_id")
	voice := c.DefaultQuery("voice", "yunxi")

	narration, getErr := h.svc.GetByExperimentAndLine(expID, lineID)
	if getErr != nil {
		response.NotFound(c, "讲解行不存在")
		return
	}

	audioPath := narration.AudioYunxi
	if voice == "xiaoxiao" {
		audioPath = narration.AudioXiaoxiao
	}

	response.Success(c, gin.H{
		"audio_path":  audioPath,
		"audio_url":   absoluteURL(c, audioPath),
		"text":        narration.Text,
		"duration_ms": narration.DurationMs,
		"voice":       voice,
	})
}

// absolutizeScript 把稿件中的相对音频路径补全为可直接访问的绝对地址。
func absolutizeScript(c *gin.Context, script *service.Script) *service.Script {
	for si := range script.Sections {
		for li := range script.Sections[si].Lines {
			line := &script.Sections[si].Lines[li]
			line.AudioYunxi = absoluteURL(c, line.AudioYunxi)
			line.AudioXiaoxiao = absoluteURL(c, line.AudioXiaoxiao)
		}
	}
	return script
}

// absoluteURL 用当前请求的 Host 拼接音频绝对地址；桌面端与开发环境都可直接播放。
func absoluteURL(c *gin.Context, path string) string {
	if path == "" {
		return ""
	}
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}
	scheme := "http"
	if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return scheme + "://" + c.Request.Host + path
}
