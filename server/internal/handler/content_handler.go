package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/ai-phy-beautiful/server/internal/ai"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/service"
	"github.com/ai-phy-beautiful/server/pkg/response"
	"github.com/gin-gonic/gin"
)

// ContentHandler 提供 AI 教学内容生成与语音合成接口（需求 4、6）。
type ContentHandler struct {
	svc *service.ContentService
}

func NewContentHandler(svc *service.ContentService) *ContentHandler {
	return &ContentHandler{svc: svc}
}

// Generate POST /api/v1/admin/experiments/:id/generate
// 为单个实验生成图文、公式、历史背景、应用场景与讲解稿件。
func (h *ContentHandler) Generate(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的实验 ID")
		return
	}
	ctx, cancel := contextWithAITimeout(c)
	defer cancel()

	result, genErr := h.svc.GenerateForExperiment(ctx, id)
	if genErr != nil {
		response.Error(c, http.StatusBadGateway, genErr.Error())
		return
	}
	response.SuccessMsg(c, "教学内容生成完成", result)
}

// GenerateBatch POST /api/v1/admin/experiments/generate-batch
func (h *ContentHandler) GenerateBatch(c *gin.Context) {
	var req struct {
		Difficulty   string `json:"difficulty"`
		Limit        int    `json:"limit"`
		IncludeReady bool   `json:"include_ready"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Limit = 5
	}
	if req.Limit <= 0 || req.Limit > 50 {
		req.Limit = 5
	}
	ctx, cancel := contextWithAITimeout(c)
	defer cancel()

	summary, batchErr := h.svc.GenerateBatch(ctx, req.Difficulty, req.Limit, req.IncludeReady)
	if batchErr != nil && summary == nil {
		response.Error(c, http.StatusBadGateway, batchErr.Error())
		return
	}
	response.SuccessMsg(c, "批量生成完成", summary)
}

// Synthesize POST /api/v1/admin/experiments/:id/narrations/synthesize
// 为讲解稿件合成语音（默认云希+晓晓双版本）。
func (h *ContentHandler) Synthesize(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的实验 ID")
		return
	}
	var req struct {
		Voices []string `json:"voices"`
		Force  bool     `json:"force"`
	}
	_ = c.ShouldBindJSON(&req)
	if len(req.Voices) == 0 {
		req.Voices = ai.Voices()
	}

	ctx, cancel := contextWithAITimeout(c)
	defer cancel()

	results, synthErr := h.svc.SynthesizeForExperiment(ctx, id, req.Voices, req.Force)
	if synthErr != nil {
		response.Error(c, http.StatusBadGateway, synthErr.Error())
		return
	}
	response.SuccessMsg(c, "语音合成完成", results)
}

// SynthesizeBatch POST /api/v1/admin/narrations/synthesize-batch
func (h *ContentHandler) SynthesizeBatch(c *gin.Context) {
	var req struct {
		Voice string `json:"voice"`
		Limit int    `json:"limit"`
		Force bool   `json:"force"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Limit <= 0 || req.Limit > 50 {
		req.Limit = 5
	}

	ctx, cancel := contextWithAITimeout(c)
	defer cancel()

	results, err := h.svc.SynthesizeBatch(ctx, req.Voice, req.Limit, req.Force)
	if err != nil && results == nil {
		response.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	response.SuccessMsg(c, "批量语音合成完成", results)
}

// Overview GET /api/v1/admin/content/overview
// 返回内容生产进度（各状态实验数、音频行数、Edge TTS 可用性）。
func (h *ContentHandler) Overview(c *gin.Context) {
	data, err := h.svc.ContentOverview()
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, data)
}

// Estimate GET /api/v1/admin/content/estimate?text=
// 在未安装 TTS 时给出时长估算，方便前端预览字幕节奏。
func (h *ContentHandler) Estimate(c *gin.Context) {
	text := c.Query("text")
	chars := len([]rune(text))
	response.Success(c, gin.H{
		"chars":       chars,
		"duration_ms": ai.EstimateDurationMs(text),
		"seconds":     float64(ai.EstimateDurationMs(text)) / 1000,
	})
}

// NarrationList GET /api/v1/admin/experiments/:id/narrations
func (h *ContentHandler) NarrationList(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的实验 ID")
		return
	}
	narrations, listErr := h.svc.ListNarrations(id)
	if listErr != nil {
		response.InternalError(c, listErr.Error())
		return
	}
	response.Success(c, narrations)
}

// NarrationImport POST /api/v1/admin/experiments/:id/narrations
// 批量导入/追加讲解台词（手工编写讲解稿件）。
func (h *ContentHandler) NarrationImport(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的实验 ID")
		return
	}
	var req struct {
		Replace bool                     `json:"replace"`
		Lines   []service.NarrationInput `json:"lines"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求体格式不正确")
		return
	}
	count, importErr := h.svc.ImportNarrations(id, req.Lines, req.Replace)
	if importErr != nil {
		response.BadRequest(c, importErr.Error())
		return
	}
	response.SuccessMsg(c, "讲解稿件已保存", gin.H{"lines": count})
}

// NarrationUpdate PUT /api/v1/admin/narrations/:line_id
// 允许人工润色 AI 生成的台词。
func (h *ContentHandler) NarrationUpdate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("line_id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的讲解行 ID")
		return
	}
	var req struct {
		Text    string `json:"text"`
		Section string `json:"section_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求体格式不正确")
		return
	}
	item, updateErr := h.svc.UpdateNarration(uint(id), req.Text, req.Section)
	if updateErr != nil {
		response.BadRequest(c, updateErr.Error())
		return
	}
	response.SuccessMsg(c, "讲解台词已更新", item)
}

// NarrationDelete DELETE /api/v1/admin/narrations/:line_id
func (h *ContentHandler) NarrationDelete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("line_id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的讲解行 ID")
		return
	}
	if delErr := h.svc.DeleteNarration(uint(id)); delErr != nil {
		response.BadRequest(c, delErr.Error())
		return
	}
	response.SuccessMsg(c, "讲解台词已删除", nil)
}

// GenerateStream 以 SSE 流式返回 AI 生成的教学内容。
//
// 事件类型：
//   - delta     {text}      增量文本（前端实时追加显示）
//   - done      {生成结果}   生成完成并已落库
//   - cancelled {message}   用户取消
//   - error     {message}   出错（含未配置大模型的提示）
func (h *ContentHandler) GenerateStream(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的实验 ID"})
		return
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "当前服务不支持流式输出"})
		return
	}
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)
	// 先发一个 SSE 注释行作为握手并立即 flush：
	// 若只 WriteHeader 而不写内容，部分代理/客户端会认为响应尚未开始，
	// 从而把后续数据一并缓冲，导致前端看不到逐段输出。
	_, _ = c.Writer.WriteString(": connected\n\n")
	flusher.Flush()

	send := func(event string, payload any) error {
		data, _ := json.Marshal(payload)
		if _, werr := fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, data); werr != nil {
			return werr
		}
		flusher.Flush()
		return nil
	}

	// 允许前端传入 max_tokens；未设置（0）时由服务端使用默认值。
	var req struct {
		MaxTokens int `json:"max_tokens"`
	}
	_ = c.ShouldBindJSON(&req)

	ctx := c.Request.Context()
	result, genErr := h.svc.GenerateStreamForExperiment(ctx, uint(id), req.MaxTokens, func(delta string) error {
		return send("delta", gin.H{"text": delta})
	})
	if genErr != nil {
		if errors.Is(genErr, context.Canceled) {
			_ = send("cancelled", gin.H{"message": "已取消生成"})
			return
		}
		_ = send("error", gin.H{"message": genErr.Error()})
		return
	}
	_ = send("done", result)
}

// VersionList 返回某实验的全部内容版本（种子版 / AI 版）。
func (h *ContentHandler) VersionList(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的实验 ID"})
		return
	}
	versions, verr := h.svc.ListContentVersions(uint(id))
	if verr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": verr.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": versions})
}

// VersionContent 返回某个版本的文稿内容（种子版 / AI 版各自的稿子），供面板按版本预览。
//
// 与 /experiments/:id/narrations 的区别：后者返回「当前生效版本」的文稿，
// 这里始终按 source 取对应版本的存档，因此「谁的文稿」永远是明确的。
func (h *ContentHandler) VersionContent(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的实验 ID"})
		return
	}
	source := c.Param("source")
	if source != model.ContentSourceSeed && source != model.ContentSourceAI {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "版本来源必须是 seed 或 ai"})
		return
	}
	content, cerr := h.svc.LoadVersionContent(uint(id), source)
	if cerr != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": cerr.Error()})
		return
	}
	label := "种子版"
	if source == model.ContentSourceAI {
		label = "AI 版"
	}
	sections := content.Narration.Sections
	if sections == nil {
		sections = []model.NarrationSection{}
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{
		"source":   source,
		"label":    label,
		"sections": sections,
	}})
}

// VersionActivate 切换某实验生效的内容版本（source = seed | ai）。
//
// 切换会把该版本的 payload 重新写回 experiments 与 narrations，
// 因此渲染、音频与讲解播放会自动反映新版本。
func (h *ContentHandler) VersionActivate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的实验 ID"})
		return
	}
	source := c.Param("source")
	if source != "seed" && source != "ai" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "版本来源必须是 seed 或 ai"})
		return
	}
	if aerr := h.svc.ActivateContentVersion(uint(id), source); aerr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": aerr.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "已切换生效版本"})
}
