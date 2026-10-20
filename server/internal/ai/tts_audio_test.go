package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// 合成结果必须是音频：BaseURL 填成网页地址时会拿到 200 + HTML，
// 旧实现只判"文件非空"，把 HTML 存成 .mp3 并提示合成成功 —— 播放时完全没声音。
func TestSynthesizeRejectsNonAudio(t *testing.T) {
	const htmlPage = "<!DOCTYPE html><html lang=\"zh\"><head><title>SiliconFlow</title></head><body>登录</body></html>"

	cases := []struct {
		name        string
		contentType string
		body        string
		wantErrWord string
	}{
		{
			name:        "网页 HTML（Content-Type 已暴露）",
			contentType: "text/html; charset=utf-8",
			body:        htmlPage,
			wantErrWord: "不是音频",
		},
		{
			name:        "网页 HTML（假装是音频，靠文件头兜底）",
			contentType: "audio/mpeg",
			body:        htmlPage,
			wantErrWord: "网页 HTML",
		},
		{
			name:        "错误 JSON",
			contentType: "application/json",
			body:        `{"code":401,"message":"Invalid token"}`,
			wantErrWord: "不是音频",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", tc.contentType)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()

			out := filepath.Join(t.TempDir(), "x.mp3")
			cfg := &model.AIModel{ModelType: model.ModelTypeTTS, Provider: model.ProviderOpenAI, BaseURL: srv.URL, APIKey: "k"}
			_, err := Synthesize(context.Background(), cfg, "测试台词", VoiceYunxi, out)
			if err == nil {
				t.Fatalf("期望报错，实际返回 nil")
			}
			if !strings.Contains(err.Error(), tc.wantErrWord) {
				t.Errorf("错误信息未点明原因：%v", err)
			}
			if !strings.Contains(err.Error(), "https://api.siliconflow.cn/v1") {
				t.Errorf("错误信息缺少可行动的配置提示：%v", err)
			}
			if _, statErr := os.Stat(out); !os.IsNotExist(statErr) {
				t.Errorf("非音频结果不应留在磁盘上（%s）", out)
			}
		})
	}
}

// 正常返回音频时必须照常成功。
func TestSynthesizeAcceptsAudio(t *testing.T) {
	mp3 := append([]byte("ID3\x03\x00\x00\x00\x00\x00\x00"), make([]byte, 2048)...)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write(mp3)
	}))
	defer srv.Close()

	out := filepath.Join(t.TempDir(), "ok.mp3")
	cfg := &model.AIModel{ModelType: model.ModelTypeTTS, Provider: model.ProviderOpenAI, BaseURL: srv.URL, APIKey: "k"}
	ms, err := Synthesize(context.Background(), cfg, "物理之美语音合成测试。", VoiceYunxi, out)
	if err != nil {
		t.Fatalf("音频响应不应报错：%v", err)
	}
	if ms <= 0 {
		t.Errorf("时长应为正数，得到 %d", ms)
	}
	if info, statErr := os.Stat(out); statErr != nil || info.Size() == 0 {
		t.Errorf("音频文件未正常写出：%v", statErr)
	}
}

func TestAudioKind(t *testing.T) {
	cases := []struct {
		name string
		head []byte
		want string
	}{
		{"mp3 带 ID3", []byte("ID3\x03\x00\x00\x00\x00\x00\x00"), "mp3"},
		{"mp3 帧同步", []byte{0xFF, 0xFB, 0x90, 0x00}, "mpeg"},
		{"wav", []byte("RIFF\x24\x08\x00\x00WAVEfmt "), "wav"},
		{"ogg", []byte("OggS\x00\x02\x00\x00"), "ogg"},
		{"m4a", []byte("\x00\x00\x00\x20ftypM4A "), "mp4"},
		{"flac", []byte("fLaC\x00\x00\x00\x22"), "flac"},
		{"网页", []byte("<!DOCTYPE html><html>"), ""},
		{"JSON", []byte(`{"error":"x"}`), ""},
		{"空", []byte{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := audioKind(tc.head); got != tc.want {
				t.Errorf("audioKind(%q) = %q，期望 %q", tc.head, got, tc.want)
			}
		})
	}
}

func TestIsAudioContentType(t *testing.T) {
	audio := []string{"audio/mpeg", "audio/wav; charset=binary", "application/octet-stream", ""}
	notAudio := []string{"text/html", "application/json", "text/plain"}
	for _, ct := range audio {
		if !isAudioContentType(ct) {
			t.Errorf("%q 应视为音频响应", ct)
		}
	}
	for _, ct := range notAudio {
		if isAudioContentType(ct) {
			t.Errorf("%q 不应视为音频响应", ct)
		}
	}
}
