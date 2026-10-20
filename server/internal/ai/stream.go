package ai

import (
	"bufio"
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

// streamClient 是流式请求专用的 http.Client。
//
// 与普通请求的关键区别：
//   - DisableCompression: true —— Go 默认 Transport 会协商 gzip，
//     若服务端返回压缩的 SSE，Transport 需解压才能交付数据，
//     于是数据被「攒住」，前端就看不到逐段输出（本地推理服务常返回 gzip）。
//   - 不设整体 Timeout（长文本生成可能远超 5 分钟），改用响应头超时兜底。
var streamClient = &http.Client{
	Transport: &http.Transport{
		DisableCompression:    true,
		MaxIdleConns:          10,
		IdleConnTimeout:       90 * time.Second,
		ResponseHeaderTimeout: 10 * time.Minute,
		ExpectContinueTimeout: 1 * time.Second,
	},
}

// DeltaFunc 接收流式增量文本；返回错误会中止本次流。
type DeltaFunc func(delta string) error

// ChatStream 以流式方式调用大模型，每收到一段增量文本就回调 onDelta。
//
// 兼容三类服务商的流式协议：
//   - OpenAI / 自定义 / Azure：SSE，形如 data: {...} 与 data: [DONE]
//   - Anthropic：SSE，形如 event: content_block_delta 与 data: {...}
//
// 未配置模型（cfg == nil）时返回明确错误，便于前端提示「需要配置大模型」。
func ChatStream(ctx context.Context, cfg *model.AIModel, req ChatRequest, onDelta DeltaFunc) error {
	if cfg == nil {
		return fmt.Errorf("尚未配置可用的大模型，请先在「模型配置」中添加并激活一个 LLM")
	}
	if req.MaxTokens <= 0 {
		req.MaxTokens = 8192
	}
	if req.Temperature <= 0 {
		req.Temperature = 0.6
	}
	switch cfg.Provider {
	case model.ProviderAnthropic:
		return streamAnthropic(ctx, cfg, req, onDelta)
	case model.ProviderAzure:
		return streamAzure(ctx, cfg, req, onDelta)
	default:
		return streamWithThinkingDisabled(ctx, cfg, req, onDelta)
	}
}

// thinkingDisableCandidates 返回「关闭思考」的候选请求体参数，按可能生效的顺序排列。
//
// 不同后端的写法完全不同（由 DeepSeek 官方 API 文档确认）：
//   - DeepSeek 官方（deepseek-flash / deepseek-reasoner 等）：顶层 "thinking": {"type": "disabled"}
//   - vLLM / SGLang 部署的 Qwen3 / GLM 等：chat_template_kwargs.enable_thinking = false
//
// 依据 BaseURL 与模型名把更可能生效的排在前面，逐个尝试。
func thinkingDisableCandidates(cfg *model.AIModel) []map[string]any {
	deepseekStyle := map[string]any{"thinking": map[string]any{"type": "disabled"}}
	vllmStyle := map[string]any{"chat_template_kwargs": map[string]any{"enable_thinking": false}}
	lowerBase := strings.ToLower(cfg.BaseURL)
	lowerName := strings.ToLower(cfg.ModelName)
	if strings.Contains(lowerBase, "deepseek") || strings.Contains(lowerName, "deepseek") {
		return []map[string]any{deepseekStyle, vllmStyle}
	}
	return []map[string]any{vllmStyle, deepseekStyle}
}

// streamWithThinkingDisabled 依次尝试「关闭思考」的各种参数写法。
//
// 推理模型会把「最大 Token」大量花在思维链上，导致正文被挤空或被截断。
// 服务商不认某种写法会返回 400，那就换下一种；全部不被接受时退回不带参数，
// 保证任何情况下都不会因为多带参数而彻底失败（降级过程不会重复生成内容）。
func streamWithThinkingDisabled(ctx context.Context, cfg *model.AIModel, req ChatRequest, onDelta DeltaFunc) error {
	for _, extras := range thinkingDisableCandidates(cfg) {
		err := streamOpenAICompatible(ctx, cfg, req, extras, onDelta)
		if err == nil || !isUnsupportedParamErr(err) {
			return err
		}
	}
	return streamOpenAICompatible(ctx, cfg, req, nil, onDelta)
}

// isUnsupportedParamErr 判断错误是否属于「服务商不认扩展参数」。
func isUnsupportedParamErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if !strings.Contains(msg, "400") {
		return false
	}
	lower := strings.ToLower(msg)
	for _, kw := range []string{
		"chat_template_kwargs", "enable_thinking", "unknown", "unexpected",
		"invalid", "extra_forbidden", "not permitted",
	} {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	// 400 但未说明原因：去掉扩展参数再试一次的代价很小（只重试一次）。
	return true
}

// streamOpenAICompatible 处理 OpenAI 风格的流式响应。
func streamOpenAICompatible(ctx context.Context, cfg *model.AIModel, req ChatRequest, extras map[string]any, onDelta DeltaFunc) error {
	endpoint := strings.TrimRight(normalizeBase(cfg.BaseURL, "https://api.openai.com/v1"), "/") + "/chat/completions"
	headers := map[string]string{"Content-Type": "application/json"}
	if cfg.APIKey != "" {
		headers["Authorization"] = "Bearer " + cfg.APIKey
	}
	body := map[string]any{
		"model":  cfg.ModelName,
		"stream": true,
		"messages": []map[string]string{
			{"role": "system", "content": req.System},
			{"role": "user", "content": req.User},
		},
		"temperature": req.Temperature,
		"max_tokens":  req.MaxTokens,
	}
	// 可选的请求体扩展（如「关闭思考」）；服务商不认时会返回 400，由上层降级重试。
	for k, v := range extras {
		body[k] = v
	}
	var contentChars, reasoningChars int
	err := readSSE(ctx, endpoint, headers, body, func(event, data string) error {
		if data == "[DONE]" {
			return nil
		}
		// 服务商没按流式返回：整体是一个完整 JSON 响应，直接从里面取正文。
		if event == "raw" {
			text := extractNonStreamContent([]byte(data))
			if text == "" {
				return fmt.Errorf("大模型返回了非流式响应，但未解析到正文内容: %s", truncateLine(data, 300))
			}
			contentChars += len([]rune(text))
			return onDelta(text)
		}
		var parsed struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
					// 推理模型（DeepSeek-R1 / -reasoner 等）先流式输出的思维链。
					// 它绝不能混进正文（正文要当 JSON 解析），但必须计数 ——
					// 否则「只收到思维链」的情况会表现为莫名的空输出。
					ReasoningContent string `json:"reasoning_content"`
				} `json:"delta"`
			} `json:"choices"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &parsed); err != nil {
			return nil // 忽略无法解析的分片，避免中断整条流
		}
		if parsed.Error != nil && parsed.Error.Message != "" {
			return fmt.Errorf("%s", parsed.Error.Message)
		}
		if len(parsed.Choices) == 0 {
			return nil
		}
		delta := parsed.Choices[0].Delta
		if delta.ReasoningContent != "" {
			reasoningChars += len([]rune(delta.ReasoningContent))
		}
		if delta.Content != "" {
			contentChars += len([]rune(delta.Content))
			return onDelta(delta.Content)
		}
		return nil
	})
	if err != nil {
		return err
	}
	// 只收到思维链、正文一字未出：几乎一定是「最大 Token」被思考过程吃光了。
	// 直接给出可操作的错误，而不是让上层拿到空串去报 "unexpected end of JSON input"。
	if contentChars == 0 && reasoningChars > 0 {
		return fmt.Errorf(
			"模型只输出了思维链（%d 字）、没有输出正文：推理模型会优先把「最大 Token」用于思考。"+
				"请把「最大 Token」调大（如 16384）后重试，或改用非推理模型（如 deepseek-chat）",
			reasoningChars,
		)
	}
	return nil
}

// streamAzure 处理 Azure OpenAI 的流式响应（协议与 OpenAI 相同，端点不同）。
func streamAzure(ctx context.Context, cfg *model.AIModel, req ChatRequest, onDelta DeltaFunc) error {
	base := strings.TrimRight(normalizeBase(cfg.BaseURL, ""), "/")
	if base == "" {
		return fmt.Errorf("Azure OpenAI 需要配置 BaseURL，例如 https://<resource>.openai.azure.com")
	}
	deployment := cfg.ModelName
	if deployment == "" {
		return fmt.Errorf("Azure OpenAI 需要填写部署名（model_name）")
	}
	apiVersion := azureAPIVersion(cfg)
	endpoint := fmt.Sprintf("%s/openai/deployments/%s/chat/completions?api-version=%s", base, deployment, apiVersion)
	headers := map[string]string{"Content-Type": "application/json"}
	if cfg.APIKey != "" {
		headers["api-key"] = cfg.APIKey
	}
	body := map[string]any{
		"stream": true,
		"messages": []map[string]string{
			{"role": "system", "content": req.System},
			{"role": "user", "content": req.User},
		},
		"temperature": req.Temperature,
		"max_tokens":  req.MaxTokens,
	}
	return readSSE(ctx, endpoint, headers, body, func(event, data string) error {
		if data == "[DONE]" {
			return nil
		}
		var parsed struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &parsed); err != nil {
			return nil
		}
		if len(parsed.Choices) > 0 && parsed.Choices[0].Delta.Content != "" {
			return onDelta(parsed.Choices[0].Delta.Content)
		}
		return nil
	})
}

// streamAnthropic 处理 Anthropic Messages API 的流式响应。
func streamAnthropic(ctx context.Context, cfg *model.AIModel, req ChatRequest, onDelta DeltaFunc) error {
	endpoint := strings.TrimRight(normalizeBase(cfg.BaseURL, "https://api.anthropic.com"), "/") + "/v1/messages"
	headers := map[string]string{
		"Content-Type":      "application/json",
		"anthropic-version": "2023-06-01",
	}
	if cfg.APIKey != "" {
		headers["x-api-key"] = cfg.APIKey
	}
	body := map[string]any{
		"model":       cfg.ModelName,
		"stream":      true,
		"max_tokens":  req.MaxTokens,
		"temperature": req.Temperature,
		"system":      req.System,
		"messages": []map[string]string{
			{"role": "user", "content": req.User},
		},
	}
	return readSSE(ctx, endpoint, headers, body, func(event, data string) error {
		switch event {
		case "content_block_delta":
			var parsed struct {
				Delta struct {
					Text string `json:"text"`
				} `json:"delta"`
			}
			if err := json.Unmarshal([]byte(data), &parsed); err != nil {
				return nil
			}
			if parsed.Delta.Text != "" {
				return onDelta(parsed.Delta.Text)
			}
		case "error":
			var parsed struct {
				Error struct {
					Message string `json:"message"`
				} `json:"error"`
			}
			if err := json.Unmarshal([]byte(data), &parsed); err == nil && parsed.Error.Message != "" {
				return fmt.Errorf("%s", parsed.Error.Message)
			}
		}
		return nil
	})
}

// azureAPIVersion 从 ExtraConfig 读取 api_version，未配置时使用稳定版本。
func azureAPIVersion(cfg *model.AIModel) string {
	version := "2024-06-01"
	if cfg.ExtraConfig != "" {
		var extra map[string]any
		if json.Unmarshal([]byte(cfg.ExtraConfig), &extra) == nil {
			if v, ok := extra["api_version"].(string); ok && v != "" {
				version = v
			}
		}
	}
	return version
}

// readSSE 发送请求并按 SSE 协议逐行解析，把每个事件的 (event, data) 交给 handler。
// extractNonStreamContent 从「非流式」的完整响应体里取出正文。
//
// 服务商未按流式返回时，响应形如：
//
//	{"choices":[{"message":{"content":"...","reasoning_content":"..."}}]}
//
// 兼容三种位置：message.content、message.reasoning_content（部分中转把正文放这里）、
// 以及 text-completion 风格的 choices[].text。
func extractNonStreamContent(raw []byte) string {
	var parsed struct {
		Choices []struct {
			Message struct {
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"message"`
			Text string `json:"text"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return ""
	}
	for _, c := range parsed.Choices {
		if c.Message.Content != "" {
			return c.Message.Content
		}
		if c.Message.ReasoningContent != "" {
			return c.Message.ReasoningContent
		}
		if c.Text != "" {
			return c.Text
		}
	}
	return ""
}

func readSSE(ctx context.Context, endpoint string, headers map[string]string, payload any, handler func(event, data string) error) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("构造请求失败: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("构造请求失败: %w", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	// 请求头刻意保持与「已验证可用」的参考实现一致：
	//   Content-Type: application/json
	//   Authorization: Bearer <key>
	//   Accept: text/event-stream
	// 不再额外设置 Accept-Encoding: identity —— llama.cpp 用的是 cpp-httplib，
	// 它对该取值的处理路径与常规不同，可能触发异常行为。
	// 响应压缩由 streamClient 的 DisableCompression 处理即可（明文响应本就不压缩）。
	req.Header.Set("Accept", "text/event-stream")

	resp, err := streamClient.Do(req)
	if err != nil {
		return fmt.Errorf("请求大模型失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(resp.Body)
		return fmt.Errorf("大模型返回状态 %d: %s", resp.StatusCode, truncateLine(buf.String(), 300))
	}

	// 兼容「服务商忽略了 stream:true」的情况：部分商用 API / 中转代理会直接返回
	// 一个完整的 JSON（Content-Type: application/json），此时按 SSE 逐行解析
	// 一个 data: 都读不到，正文会被整段丢掉（上层只会看到空输出）。
	// 这里把整个 body 以 event="raw" 交给 handler，由各 provider 自己解析。
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		raw, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return fmt.Errorf("读取大模型响应失败: %w", readErr)
		}
		return handler("raw", string(raw))
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	var event string
	var dataLines []string
	flush := func() error {
		if len(dataLines) == 0 {
			event = ""
			return nil
		}
		data := strings.Join(dataLines, "\n")
		dataLines = nil
		ev := event
		event = ""
		return handler(ev, data)
	}

	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case line == "":
			if err := flush(); err != nil {
				return err
			}
		case strings.HasPrefix(line, ":"):
			// 注释行（部分服务商用于心跳），忽略
		case strings.HasPrefix(line, "event:"):
			event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("读取流失败: %w", err)
	}
	return flush()
}
