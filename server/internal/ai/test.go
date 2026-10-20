package ai

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// TestConnection 按配置类型执行一次真实的连通性测试，返回可读的测试详情。
func TestConnection(ctx context.Context, cfg *model.AIModel) (string, error) {
	if cfg == nil {
		return "", fmt.Errorf("配置不存在")
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	switch cfg.ModelType {
	case model.ModelTypeLLM:
		return testLLM(ctx, cfg)
	case model.ModelTypeTTS:
		return testTTS(ctx, cfg)
	case model.ModelTypeASR:
		return testASR(ctx, cfg)
	case model.ModelTypeImage:
		return testImage(ctx, cfg)
	default:
		return "", fmt.Errorf("未知的大模型类型: %s", cfg.ModelType)
	}
}

// testLLM 用一次极短的对话验证模型可用。
func testLLM(ctx context.Context, cfg *model.AIModel) (string, error) {
	reply, err := Chat(ctx, cfg, ChatRequest{
		System:      "你是测试助手，只回复要求的内容。",
		User:        "请只回复两个字：可用",
		MaxTokens:   32,
		Temperature: 0.1,
	})
	if err != nil {
		return "", err
	}
	reply = strings.TrimSpace(reply)
	if len([]rune(reply)) > 120 {
		reply = string([]rune(reply)[:120]) + "..."
	}
	return fmt.Sprintf("对话测试成功，模型回复：%s", reply), nil
}

// testTTS 实际合成一小段语音并校验产物大小。
func testTTS(ctx context.Context, cfg *model.AIModel) (string, error) {
	tmpDir, err := os.MkdirTemp("", "tts-test-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	out := filepath.Join(tmpDir, "test.mp3")
	const sample = "物理之美语音合成测试。"
	ms, err := Synthesize(ctx, cfg, sample, VoiceYunxi, out)
	if err != nil {
		return "", err
	}
	size := AudioFileSize(out)
	if size == 0 {
		return "", fmt.Errorf("合成结果为空")
	}
	return fmt.Sprintf("合成成功：%d 字节，约 %.1f 秒", size, float64(ms)/1000), nil
}

// testASR 校验语音识别服务的模型列表接口可达。
func testASR(ctx context.Context, cfg *model.AIModel) (string, error) {
	if cfg.Provider == model.ProviderEdge {
		return "", fmt.Errorf("Edge 不提供语音识别服务")
	}
	models, err := ListModels(ctx, cfg)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("接口可达，共 %d 个模型；示例：%s", len(models), strings.Join(head(models, 3), ", ")), nil
}

// testImage 校验图像生成服务的模型列表接口可达。
func testImage(ctx context.Context, cfg *model.AIModel) (string, error) {
	if cfg.Provider == model.ProviderEdge {
		return "", fmt.Errorf("Edge 不提供图像生成服务")
	}
	models, err := ListModels(ctx, cfg)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("接口可达，共 %d 个模型；示例：%s", len(models), strings.Join(head(models, 3), ", ")), nil
}

// EdgeAvailable 报告本机是否安装了 edge-tts（用于 TTS 配置页提示）。
func EdgeAvailable() (bool, string) {
	candidates := [][]string{
		{"edge-tts"},
		{"python", "-m", "edge_tts"},
		{"python3", "-m", "edge_tts"},
		{"py", "-m", "edge_tts"},
	}
	for _, c := range candidates {
		if path, err := exec.LookPath(c[0]); err == nil {
			return true, strings.Join(append([]string{path}, c[1:]...), " ")
		}
	}
	return false, "未检测到 edge-tts，可执行：pip install edge-tts"
}

func head(list []string, n int) []string {
	if len(list) <= n {
		return list
	}
	return list[:n]
}
