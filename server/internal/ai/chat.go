// Package ai 封装各类大模型服务商的调用（LLM / TTS / 连通性测试）。
//
// 设计目标：同一套接口适配 OpenAI 兼容协议（DeepSeek、通义千问、Ollama、vLLM 等）、
// Azure OpenAI、Anthropic Messages API 以及 Edge TTS / Azure 语音服务。
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// DefaultTimeout 是单次「非流式」大模型调用的超时。
//
// 本地部署的大模型（尤其是量化后的中大参数量模型）prefill 与解码都慢，
// 一次完整教学内容的生成可能远超 5 分钟，因此放宽到 30 分钟。
// 注意：流式调用走 streamClient，不设整体超时，不受此限制。
const DefaultTimeout = 30 * time.Minute

var httpClient = &http.Client{Timeout: DefaultTimeout}

// ChatRequest 是一次对话请求。
type ChatRequest struct {
	System      string
	User        string
	Temperature float64
	MaxTokens   int
	// JSONMode 要求服务端返回严格 JSON（不支持的厂商会自动降级）。
	JSONMode bool
}

// Chat 调用配置对应的大模型完成一次对话，返回文本内容。
func Chat(ctx context.Context, cfg *model.AIModel, req ChatRequest) (string, error) {
	if cfg == nil {
		return "", fmt.Errorf("未配置可用的大模型")
	}
	if req.MaxTokens <= 0 {
		req.MaxTokens = 4096
	}
	if req.Temperature <= 0 {
		req.Temperature = 0.7
	}

	switch cfg.Provider {
	case model.ProviderAnthropic:
		return chatAnthropic(ctx, cfg, req)
	case model.ProviderAzure:
		return chatAzure(ctx, cfg, req)
	default:
		return chatOpenAICompatible(ctx, cfg, req)
	}
}

// chatOpenAICompatible 适用于所有 /chat/completions 协议的服务商。
func chatOpenAICompatible(ctx context.Context, cfg *model.AIModel, req ChatRequest) (string, error) {
	endpoint := strings.TrimRight(normalizeBase(cfg.BaseURL, "https://api.openai.com/v1"), "/") + "/chat/completions"

	body := map[string]any{
		"model": cfg.ModelName,
		"messages": []map[string]string{
			{"role": "system", "content": req.System},
			{"role": "user", "content": req.User},
		},
		"temperature": req.Temperature,
		"max_tokens":  req.MaxTokens,
	}
	// 注意：这里刻意「不」注入 response_format: json_object。
	//
	// 原因：llama.cpp 收到 json_object 后会构建 JSON grammar 约束，
	// 需要额外的显存分配（语法解析结构 + logit 掩码）。在
	// "-fa on + --cache-type-k/v q4_0 + --n-cpu-moe" 这类显存已到极限的
	// 配置下，这一次额外分配会触发 CUDA illegal memory access，
	// 导致 GPU 上下文损毁、驱动挂起，整机卡死到只能强制关机。
	//
	// 参考同样跑本地模型的 study-math-high-offline 项目：它的请求体里
	// 没有 response_format，运行稳定。
	//
	// JSON 结构改由提示词约束（见 prompt.go 的格式要求），
	// 解析侧由 ParseContent + repairTruncatedJSON 兜底。
	_ = req.JSONMode

	headers := map[string]string{"Content-Type": "application/json"}
	if cfg.APIKey != "" {
		headers["Authorization"] = "Bearer " + cfg.APIKey
	}

	raw, err := doJSON(ctx, http.MethodPost, endpoint, headers, body)
	if err != nil {
		return "", err
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("解析大模型响应失败: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", fmt.Errorf("大模型返回错误: %s", parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("大模型未返回内容")
	}
	return parsed.Choices[0].Message.Content, nil
}

// chatAnthropic 适配 Anthropic Messages API。
func chatAnthropic(ctx context.Context, cfg *model.AIModel, req ChatRequest) (string, error) {
	endpoint := strings.TrimRight(normalizeBase(cfg.BaseURL, "https://api.anthropic.com"), "/") + "/v1/messages"

	body := map[string]any{
		"model":      cfg.ModelName,
		"max_tokens": req.MaxTokens,
		"system":     req.System,
		"messages": []map[string]string{
			{"role": "user", "content": req.User},
		},
	}
	headers := map[string]string{
		"Content-Type":      "application/json",
		"x-api-key":         cfg.APIKey,
		"anthropic-version": "2023-06-01",
	}

	raw, err := doJSON(ctx, http.MethodPost, endpoint, headers, body)
	if err != nil {
		return "", err
	}

	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("解析 Anthropic 响应失败: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", fmt.Errorf("Anthropic 返回错误: %s", parsed.Error.Message)
	}
	var sb strings.Builder
	for _, part := range parsed.Content {
		if part.Type == "text" {
			sb.WriteString(part.Text)
		}
	}
	if sb.Len() == 0 {
		return "", fmt.Errorf("Anthropic 未返回内容")
	}
	return sb.String(), nil
}

// chatAzure 适配 Azure OpenAI 的 deployment 路由。
func chatAzure(ctx context.Context, cfg *model.AIModel, req ChatRequest) (string, error) {
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		return "", fmt.Errorf("Azure 需要配置 BaseURL，例如 https://<resource>.openai.azure.com")
	}
	deployment := cfg.ModelName
	if deployment == "" {
		return "", fmt.Errorf("Azure 需要配置部署名（ModelName）")
	}
	apiVersion := "2024-02-15-preview"
	if cfg.ExtraConfig != "" {
		var extra map[string]any
		if json.Unmarshal([]byte(cfg.ExtraConfig), &extra) == nil {
			if v, ok := extra["api_version"].(string); ok && v != "" {
				apiVersion = v
			}
		}
	}
	endpoint := fmt.Sprintf("%s/openai/deployments/%s/chat/completions?api-version=%s", base, deployment, apiVersion)

	body := map[string]any{
		"messages": []map[string]string{
			{"role": "system", "content": req.System},
			{"role": "user", "content": req.User},
		},
		"temperature": req.Temperature,
		"max_tokens":  req.MaxTokens,
	}
	headers := map[string]string{
		"Content-Type": "application/json",
		"api-key":      cfg.APIKey,
	}

	raw, err := doJSON(ctx, http.MethodPost, endpoint, headers, body)
	if err != nil {
		return "", err
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("解析 Azure 响应失败: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("Azure 未返回内容")
	}
	return parsed.Choices[0].Message.Content, nil
}

// ListModels 通过 OpenAI 兼容的 /models 接口校验连通性与凭据。
func ListModels(ctx context.Context, cfg *model.AIModel) ([]string, error) {
	endpoint := strings.TrimRight(normalizeBase(cfg.BaseURL, "https://api.openai.com/v1"), "/") + "/models"
	headers := map[string]string{}
	if cfg.APIKey != "" {
		headers["Authorization"] = "Bearer " + cfg.APIKey
	}
	raw, err := doJSON(ctx, http.MethodGet, endpoint, headers, nil)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("解析模型列表失败: %w", err)
	}
	names := make([]string, 0, len(parsed.Data)+len(parsed.Models))
	for _, m := range parsed.Data {
		if m.ID != "" {
			names = append(names, m.ID)
		}
	}
	for _, m := range parsed.Models {
		if m.Name != "" {
			names = append(names, m.Name)
		}
	}
	if len(names) == 0 {
		return nil, fmt.Errorf("接口可达但未返回模型列表")
	}
	return names, nil
}

// doJSON 发送 HTTP 请求并返回响应体，同时把服务端错误转成可读信息。
func doJSON(ctx context.Context, method, endpoint string, headers map[string]string, payload any) ([]byte, error) {
	var reader io.Reader
	if payload != nil {
		buf, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 %s 失败: %w", endpoint, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(raw))
		if len(msg) > 400 {
			msg = msg[:400] + "..."
		}
		return nil, fmt.Errorf("接口返回 %d: %s", resp.StatusCode, msg)
	}
	return raw, nil
}

// normalizeBase 返回去掉尾部斜杠的 base url，为空时使用默认值。
func normalizeBase(base, fallback string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return fallback
	}
	return base
}
