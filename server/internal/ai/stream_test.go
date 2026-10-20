package ai

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// 服务商忽略 stream:true、直接返回完整 JSON 时，也要能取到正文。
func TestExtractNonStreamContent(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{"message.content", `{"choices":[{"message":{"content":"正文"}}]}`, "正文"},
		{"只有思维链时兜底", `{"choices":[{"message":{"reasoning_content":"思考"}}]}`, "思考"},
		{"text 补全风格", `{"choices":[{"text":"补全"}]}`, "补全"},
		{"非法 JSON", `not json`, ""},
		{"空 choices", `{"choices":[]}`, ""},
	}
	for _, c := range cases {
		if got := extractNonStreamContent([]byte(c.raw)); got != c.want {
			t.Errorf("%s: got %q want %q", c.name, got, c.want)
		}
	}
}

// streamFixture 起一个返回 SSE 的假服务商。
func streamFixture(t *testing.T, chunks []string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		for _, s := range chunks {
			if _, err := w.Write([]byte("data: " + s + "\n\n")); err != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	t.Cleanup(srv.Close)
	return srv
}

// 只收到思维链（正文被「最大 Token」挤空）时必须报出可操作的错误，
// 而不是静默返回空正文，让上层去报 "unexpected end of JSON input"。
func TestStreamOnlyReasoningReportsError(t *testing.T) {
	srv := streamFixture(t, []string{
		`{"choices":[{"delta":{"reasoning_content":"让我想想"}}]}`,
		`{"choices":[{"delta":{"reasoning_content":"这道题应该…"}}]}`,
	})
	cfg := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "deepseek-reasoner", APIKey: "k"}

	var got strings.Builder
	err := streamOpenAICompatible(context.Background(), cfg, ChatRequest{}, nil, func(d string) error {
		got.WriteString(d)
		return nil
	})
	if err == nil {
		t.Fatalf("应报「只输出思维链」错误，实际 err=nil，正文=%q", got.String())
	}
	if !strings.Contains(err.Error(), "思维链") {
		t.Fatalf("错误信息应指出只收到思维链，实际: %v", err)
	}
	if got.Len() != 0 {
		t.Fatalf("思维链不能混进正文，实际正文=%q", got.String())
	}
}

// 正常的流式正文要逐段回调，且与思维链互不干扰。
func TestStreamContentDeltasSkipReasoning(t *testing.T) {
	srv := streamFixture(t, []string{
		`{"choices":[{"delta":{"reasoning_content":"想一下"}}]}`,
		`{"choices":[{"delta":{"content":"{\"title\""}}]}`,
		`{"choices":[{"delta":{"content":":\"x\"}"}}]}`,
	})
	cfg := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "deepseek-chat", APIKey: "k"}

	var got strings.Builder
	if err := streamOpenAICompatible(context.Background(), cfg, ChatRequest{}, nil, func(d string) error {
		got.WriteString(d)
		return nil
	}); err != nil {
		t.Fatalf("不应报错: %v", err)
	}
	if got.String() != `{"title":"x"}` {
		t.Fatalf("正文拼接错误: %q", got.String())
	}
}

// 服务商忽略 stream:true（直接返回 application/json）时，正文不能丢。
func TestStreamNonStreamFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"title\":\"x\"}"}}]}`))
	}))
	t.Cleanup(srv.Close)
	cfg := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "deepseek-chat", APIKey: "k"}

	var got strings.Builder
	if err := streamOpenAICompatible(context.Background(), cfg, ChatRequest{}, nil, func(d string) error {
		got.WriteString(d)
		return nil
	}); err != nil {
		t.Fatalf("不应报错: %v", err)
	}
	if got.String() != `{"title":"x"}` {
		t.Fatalf("非流式正文未取到: %q", got.String())
	}
}

// 返回错误对象的 SSE 要冒泡成错误，而不是被当成空输出。
func TestStreamErrorPayload(t *testing.T) {
	srv := streamFixture(t, []string{`{"error":{"message":"invalid api key"}}`})
	cfg := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "deepseek-chat", APIKey: "bad"}

	err := streamOpenAICompatible(context.Background(), cfg, ChatRequest{}, nil, func(string) error { return nil })
	if err == nil || !strings.Contains(err.Error(), "invalid api key") {
		t.Fatalf("应冒泡服务端错误，实际: %v", err)
	}
}

// DeepSeek 官方模型必须收到 thinking.type=disabled（而不是 vLLM 的写法），
// 否则思考过程会吃光「最大 Token」，正文被截断或挤空。
func TestDeepSeekGetsThinkingDisabledParam(t *testing.T) {
	var gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		gotBody = string(raw)
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	t.Cleanup(srv.Close)
	// 模型名含 deepseek → 走 DeepSeek 官方写法（BaseURL 指向假服务器即可）
	cfg := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "deepseek-flash", APIKey: "k"}

	var got strings.Builder
	if err := ChatStream(context.Background(), cfg, ChatRequest{}, func(d string) error {
		got.WriteString(d)
		return nil
	}); err != nil {
		t.Fatalf("不应报错: %v", err)
	}
	if got.String() != "ok" {
		t.Fatalf("正文错误: %q", got.String())
	}
	if !strings.Contains(gotBody, `"thinking"`) || !strings.Contains(gotBody, `"disabled"`) {
		t.Fatalf("请求体应带 thinking.type=disabled，实际: %s", gotBody)
	}
	if strings.Contains(gotBody, "chat_template_kwargs") {
		t.Fatalf("DeepSeek 请求不该带 vLLM 的 chat_template_kwargs，实际: %s", gotBody)
	}
}

// 两种「关闭思考」写法都被拒时，要退回不带参数，保证不彻底失败。
func TestChatStreamFallsBackThroughThinkingCandidates(t *testing.T) {
	var sawDeepSeek, sawVLLM, sawPlain bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		body := string(raw)
		switch {
		case strings.Contains(body, `"thinking"`):
			sawDeepSeek = true
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"message":"unknown field thinking"}}`))
		case strings.Contains(body, "chat_template_kwargs"):
			sawVLLM = true
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"message":"unknown field chat_template_kwargs"}}`))
		default:
			sawPlain = true
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n"))
			_, _ = w.Write([]byte("data: [DONE]\n\n"))
		}
	}))
	t.Cleanup(srv.Close)
	cfg := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "deepseek-flash", APIKey: "k"}

	var got strings.Builder
	if err := ChatStream(context.Background(), cfg, ChatRequest{}, func(d string) error {
		got.WriteString(d)
		return nil
	}); err != nil {
		t.Fatalf("全部降级后应成功，实际: %v", err)
	}
	if !sawDeepSeek || !sawVLLM || !sawPlain {
		t.Fatalf("应按 deepseek → vllm → 无参数 依次尝试，实际 deepseek=%v vllm=%v plain=%v",
			sawDeepSeek, sawVLLM, sawPlain)
	}
	if got.String() != "ok" {
		t.Fatalf("正文错误: %q", got.String())
	}
}
