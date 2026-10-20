package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// 配置里的「默认音色」必须真的生效。
//
// 此前 resolveVoice 把 `table[voice]` 排在最前，而调用方传进来的 voice 永远是内部标识
// yunxi/xiaoxiao，于是配置音色永远被忽略 —— 商用服务商填了音色名也没用，
// 测试连接直接报 400 Invalid voice。
func TestSynthesizeSendsConfiguredVoice(t *testing.T) {
	var gotVoice, gotModel string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)
		gotVoice, _ = payload["voice"].(string)
		gotModel, _ = payload["model"].(string)
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write([]byte("ID3\x03\x00\x00\x00\x00\x00\x00"))
	}))
	defer srv.Close()

	cfg := &model.AIModel{
		ModelType: model.ModelTypeTTS, Provider: model.ProviderOpenAI,
		BaseURL: srv.URL, ModelName: "tts-1", Voice: "my-custom-voice",
	}
	if _, err := Synthesize(context.Background(), cfg, "测试", VoiceYunxi, filepath.Join(t.TempDir(), "a.mp3")); err != nil {
		t.Fatalf("合成失败：%v", err)
	}
	if gotVoice != "my-custom-voice" {
		t.Errorf("请求体里的 voice = %q，期望配置里的 my-custom-voice", gotVoice)
	}
	if gotModel != "tts-1" {
		t.Errorf("请求体里的 model = %q，期望 tts-1", gotModel)
	}
}

// 音色解析：配置优先 → 服务商表 → 内部标识回退。
func TestResolveVoice(t *testing.T) {
	silicon := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: "https://api.siliconflow.cn/v1", ModelName: "FunAudioLLM/CosyVoice2-0.5B"}
	openai := &model.AIModel{Provider: model.ProviderOpenAI, BaseURL: "https://api.openai.com/v1"}

	cases := []struct {
		name  string
		cfg   *model.AIModel
		voice string
		want  string
	}{
		{"硅基流动·男声默认", silicon, VoiceYunxi, "FunAudioLLM/CosyVoice2-0.5B:alex"},
		{"硅基流动·女声默认", silicon, VoiceXiaoxiao, "FunAudioLLM/CosyVoice2-0.5B:anna"},
		{"硅基流动·换模型前缀跟着变", &model.AIModel{BaseURL: "https://api.siliconflow.cn/v1", ModelName: "fishaudio/fish-speech-1.5"}, VoiceYunxi, "fishaudio/fish-speech-1.5:alex"},
		{"硅基流动·模型名为空时用默认模型", &model.AIModel{BaseURL: "https://api.siliconflow.cn/v1"}, VoiceYunxi, "FunAudioLLM/CosyVoice2-0.5B:alex"},
		{"OpenAI 保持原映射", openai, VoiceYunxi, "onyx"},
		{"配置音色优先", &model.AIModel{BaseURL: "https://api.siliconflow.cn/v1", ModelName: "FunAudioLLM/CosyVoice2-0.5B", Voice: "FunAudioLLM/CosyVoice2-0.5B:bella"}, VoiceYunxi, "FunAudioLLM/CosyVoice2-0.5B:bella"},
		{"配置里写内部标识时仍走映射", &model.AIModel{BaseURL: "https://api.siliconflow.cn/v1", ModelName: "FunAudioLLM/CosyVoice2-0.5B", Voice: "yunxi"}, VoiceXiaoxiao, "FunAudioLLM/CosyVoice2-0.5B:anna"},
		{"运行时直接传厂商音色名", openai, "zh-CN-YunxiNeural", "zh-CN-YunxiNeural"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			table := voiceTableFor(tc.cfg, openAIVoices)
			if got := resolveVoice(tc.cfg, tc.voice, table); got != tc.want {
				t.Errorf("resolveVoice() = %q，期望 %q", got, tc.want)
			}
		})
	}
}

// 用户只写了音色 ID（如 alex）时，硅基流动需要 `<模型名>:<音色ID>`，应自动补前缀。
func TestNormalizeVoiceName(t *testing.T) {
	silicon := &model.AIModel{BaseURL: "https://api.siliconflow.cn/v1", ModelName: "FunAudioLLM/CosyVoice2-0.5B"}
	openai := &model.AIModel{BaseURL: "https://api.openai.com/v1", ModelName: "tts-1"}

	cases := []struct {
		name string
		cfg  *model.AIModel
		in   string
		want string
	}{
		{"只写音色 ID 自动补前缀", silicon, "bella", "FunAudioLLM/CosyVoice2-0.5B:bella"},
		{"已带前缀则不动", silicon, "FunAudioLLM/CosyVoice2-0.5B:bella", "FunAudioLLM/CosyVoice2-0.5B:bella"},
		{"OpenAI 音色名不受影响", openai, "onyx", "onyx"},
		{"空值原样返回", silicon, "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeVoiceName(tc.cfg, tc.in); got != tc.want {
				t.Errorf("normalizeVoiceName() = %q，期望 %q", got, tc.want)
			}
		})
	}
}

// 4xx 里提到音色时要给出可行动的提示（商用服务要求「模型名:音色ID」）。
func TestSynthesizeVoiceErrorHint(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"code":20047,"message":"Invalid voice.","data":null}`))
	}))
	defer srv.Close()

	cfg := &model.AIModel{ModelType: model.ModelTypeTTS, Provider: model.ProviderOpenAI, BaseURL: srv.URL, ModelName: "FunAudioLLM/CosyVoice2-0.5B"}
	_, err := Synthesize(context.Background(), cfg, "测试", VoiceYunxi, filepath.Join(t.TempDir(), "b.mp3"))
	if err == nil {
		t.Fatal("期望报错")
	}
	if !strings.Contains(err.Error(), "Invalid voice") || !strings.Contains(err.Error(), "FunAudioLLM/CosyVoice2-0.5B:alex") {
		t.Errorf("错误信息应包含原始响应与音色写法提示，实际：%v", err)
	}
}
