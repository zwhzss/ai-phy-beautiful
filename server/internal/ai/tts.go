package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// 讲解音色标识（需求 6：云希男声 + 晓晓女声双版本）。
const (
	VoiceYunxi    = "yunxi"
	VoiceXiaoxiao = "xiaoxiao"
)

// Voices 返回全部支持的双语音色标识。
func Voices() []string { return []string{VoiceYunxi, VoiceXiaoxiao} }

// edgeVoices 是 Edge TTS / Azure 语音服务的中文音色名。
var edgeVoices = map[string]string{
	VoiceYunxi:    "zh-CN-YunxiNeural",
	VoiceXiaoxiao: "zh-CN-XiaoxiaoNeural",
}

// openAIVoices 把本项目的音色标识映射到 OpenAI 兼容 TTS 的音色名。
var openAIVoices = map[string]string{
	VoiceYunxi:    "onyx",
	VoiceXiaoxiao: "nova",
}

// Synthesize 按配置合成语音到 outPath（mp3），返回音频时长（毫秒）。
//
// text 是库里的台词原文（含 LaTeX 公式标记）；真正送进 TTS 的是 SpeakableText
// 处理过的"读法版"，否则 TTS 会把 $ 与反斜杠命令当源码念出来。
func Synthesize(ctx context.Context, cfg *model.AIModel, text, voice, outPath string) (int, error) {
	if cfg == nil {
		return 0, fmt.Errorf("未配置可用的 TTS 大模型")
	}
	raw := strings.TrimSpace(text)
	if raw == "" {
		return 0, fmt.Errorf("待合成文本为空")
	}
	text = SpeakableText(raw)
	if text == "" {
		// 整句都是符号（转换后什么都不剩）时退回原文，避免合成出一段空音频
		text = raw
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return 0, fmt.Errorf("创建音频目录失败: %w", err)
	}

	switch cfg.Provider {
	case model.ProviderEdge, "":
		if err := synthEdge(ctx, cfg, text, voice, outPath); err != nil {
			return 0, err
		}
	case model.ProviderAzure:
		if err := synthAzure(ctx, cfg, text, voice, outPath); err != nil {
			return 0, err
		}
	default:
		if err := synthOpenAICompatible(ctx, cfg, text, voice, outPath); err != nil {
			return 0, err
		}
	}

	info, err := os.Stat(outPath)
	if err != nil || info.Size() == 0 {
		return 0, fmt.Errorf("合成未产生音频文件")
	}
	// 落盘内容必须是真正的音频：商用 TTS 的 BaseURL 填错（例如把硅基流动写成网页域名）时，
	// 接口会返回 200 + 网页 HTML，旧实现只判"文件非空"，于是把 HTML 存成 .mp3、界面还提示
	// "合成完成"，学生播放时完全没有声音。这里统一校验文件头，不是音频就删掉并报错。
	if err := ensureAudioFile(outPath); err != nil {
		return 0, err
	}
	if ms := mp3DurationMs(outPath); ms > 0 {
		return ms, nil
	}
	return EstimateDurationMs(text), nil
}

// edgeCandidate 描述一种调用 edge-tts 的方式。
type edgeCandidate struct {
	bin  string
	args []string
}

// edgeCandidates 按优先级返回调用方式。
//
// EDGE_TTS_BIN 用来锁定"带 Sec-MS-GEC v2 令牌的 edge-tts"：微软从 2026-10 起把
// Sec-MS-GEC 升级到 v2（令牌形如 <CS64>-<64 位 hex>，且版本号前缀必须是 2-），
// 7.2.x 及更早的版本仍发 v1 令牌 + 1- 前缀，握手阶段就被拒（HTTP 403、空响应体），
// 一条音频都合成不出来。值可以是 venv 里的 python.exe（按 -m edge_tts 调用），
// 也可以直接是 edge-tts 可执行文件。
func edgeCandidates() ([]edgeCandidate, error) {
	candidates := []edgeCandidate{}
	if bin := strings.TrimSpace(os.Getenv("EDGE_TTS_BIN")); bin != "" {
		if _, err := os.Stat(bin); err != nil {
			return nil, fmt.Errorf("EDGE_TTS_BIN 指向的文件不存在: %s", bin)
		}
		if isPythonBin(bin) {
			candidates = append(candidates, edgeCandidate{bin: bin, args: []string{"-m", "edge_tts"}})
		} else {
			candidates = append(candidates, edgeCandidate{bin: bin})
		}
	}
	return append(candidates,
		edgeCandidate{bin: "edge-tts"},
		edgeCandidate{bin: "python", args: []string{"-m", "edge_tts"}},
		edgeCandidate{bin: "python3", args: []string{"-m", "edge_tts"}},
		edgeCandidate{bin: "py", args: []string{"-m", "edge_tts"}},
	), nil
}

// isPythonBin 判断路径是解释器还是 edge-tts 入口：venv 里两者都可能被填进来。
func isPythonBin(path string) bool {
	base := strings.ToLower(filepath.Base(path))
	base = strings.TrimSuffix(base, ".exe")
	return base == "py" || strings.HasPrefix(base, "python")
}

// synthEdge 调用本地 edge-tts 命令（免费，需要 pip install edge-tts）。
// edge-tts 对连续快速请求会限流（返回 No audio was received），因此这里带退避重试。
func synthEdge(ctx context.Context, cfg *model.AIModel, text, voice, outPath string) error {
	voiceName := resolveVoice(cfg, voice, edgeVoices)

	candidates, err := edgeCandidates()
	if err != nil {
		return err
	}

	var (
		found     bool
		lastErr   error
		attemptNo int
	)
	for _, cand := range candidates {
		if _, err := exec.LookPath(cand.bin); err != nil {
			continue
		}
		found = true

		const maxAttempts = 4
		for attempt := 1; attempt <= maxAttempts; attempt++ {
			attemptNo++
			err := runEdgeOnce(ctx, cand, voiceName, text, outPath)
			if err == nil {
				return nil
			}
			lastErr = err
			if ctx.Err() != nil {
				return ctx.Err()
			}
			// 音色名错误属于配置问题，重试无意义。
			if strings.Contains(err.Error(), "Invalid voice") || strings.Contains(err.Error(), "not supported") {
				return err
			}
			if attempt < maxAttempts {
				// 指数退避：1.5s / 3s / 4.5s
				delay := time.Duration(attempt) * 1500 * time.Millisecond
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(delay):
				}
			}
		}
		// 找到了可执行文件就不再尝试其它解释器，直接返回本次错误。
		break
	}

	if !found {
		return fmt.Errorf("未找到 edge-tts 命令，请先执行 pip install edge-tts（或改用 Azure/商用 TTS 配置）")
	}
	return fmt.Errorf("edge-tts 合成失败（重试 %d 次）: %w", attemptNo, lastErr)
}

// runEdgeOnce 执行一次 edge-tts 合成。
//
// 子进程写到同目录的临时文件，确认有内容后再原子改名到 outPath：
// 超时/被强杀时只会留下临时文件，不会让目标位置出现 0 字节空文件
//（历史问题：批量生成被中断后留下大量 0 字节 mp3，被"已存在"判定为已完成）。
func runEdgeOnce(ctx context.Context, cand edgeCandidate, voiceName, text, outPath string) error {
	tmpPath, err := tempSibling(outPath)
	if err != nil {
		return err
	}
	defer os.Remove(tmpPath)

	// 先清理可能存在的半成品文件，避免失败时留下空文件被误判为成功。
	_ = os.Remove(outPath)

	args := append(append([]string{}, cand.args...),
		"--voice", voiceName,
		"--text", text,
		"--write-media", tmpPath,
	)
	cmd := exec.CommandContext(ctx, cand.bin, args...)
	// 隐藏子进程窗口：合成大量台词时会反复调用 edge-tts，
	// 否则 Windows 上会不断弹出命令行黑窗。
	hideWindow(cmd)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s", conciseEdgeError(stderr.String(), err))
	}
	info, err := os.Stat(tmpPath)
	if err != nil || info.Size() == 0 {
		return fmt.Errorf("%s", conciseEdgeError(stderr.String(), fmt.Errorf("未生成音频文件")))
	}
	return commitTemp(tmpPath, outPath)
}

// tempSibling 在目标文件同目录下申请一个临时文件名。
//
// 必须与目标同目录：跨卷 rename 不是原子操作，也会失败。
func tempSibling(dst string) (string, error) {
	dir := filepath.Dir(dst)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("创建音频目录失败: %w", err)
	}
	f, err := os.CreateTemp(dir, "."+filepath.Base(dst)+".*.part")
	if err != nil {
		return "", fmt.Errorf("创建临时音频文件失败: %w", err)
	}
	name := f.Name()
	_ = f.Close()
	return name, nil
}

// commitTemp 把临时文件原子改名为目标文件。
//
// Windows 上 os.Rename 覆盖已存在的文件是允许的（MoveFileEx + REPLACE_EXISTING），
// 因此这里不需要先删除目标，避免出现"删了旧的、新的还没到位"的空窗。
func commitTemp(tmpPath, dst string) error {
	if err := os.Rename(tmpPath, dst); err != nil {
		return fmt.Errorf("保存音频文件失败: %w", err)
	}
	return nil
}

// conciseEdgeError 把 edge-tts 的冗长 traceback 压缩成一行可读信息。
func conciseEdgeError(stderr string, fallback error) string {
	// 微软这条未公开接口在 2026-10 把 Sec-MS-GEC 令牌升级到 v2：7.2.x 仍发 v1 令牌并配
	// "1-" 版本前缀，握手即被拒，且响应体为空（Content-Length: 0），堆栈里只剩 URL 可读。
	// 空响应没有更多信息可挖，直接把两个已知成因写在错误里，免得下次从头排查。
	if strings.Contains(stderr, "403") && strings.Contains(stderr, "readaloud") {
		return "edge-tts 被语音服务拒绝（HTTP 403）：Sec-MS-GEC 令牌代次过旧，或本机时钟偏差超出时间窗。" +
			"请改用支持 v2 令牌的 edge-tts（7.3+），或把 EDGE_TTS_BIN 指向装好该版本的解释器，并校准系统时间"
	}

	lines := strings.Split(strings.TrimSpace(stderr), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}
		if strings.Contains(line, "NoAudioReceived") {
			return "edge-tts 未返回音频（通常是请求过快被限流，或语音服务暂不可用），请稍后重试"
		}
		if strings.Contains(line, "Error") || strings.Contains(line, "error") || strings.Contains(line, "Exception") {
			return truncateLine(line, 300)
		}
	}
	if fallback != nil {
		return fallback.Error()
	}
	return "edge-tts 执行失败"
}

func truncateLine(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}

// synthAzure 调用 Azure 语音服务 REST 接口。
func synthAzure(ctx context.Context, cfg *model.AIModel, text, voice, outPath string) error {
	region := cfg.Region
	if region == "" {
		region = "eastasia"
	}
	endpoint := fmt.Sprintf("https://%s.tts.speech.microsoft.com/cognitiveservices/v1", region)
	voiceName := resolveVoice(cfg, voice, edgeVoices)

	ssml := fmt.Sprintf(
		`<speak version='1.0' xml:lang='zh-CN'><voice xml:lang='zh-CN' name='%s'>%s</voice></speak>`,
		voiceName, escapeXML(text),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(ssml))
	if err != nil {
		return err
	}
	req.Header.Set("Ocp-Apim-Subscription-Key", cfg.APIKey)
	req.Header.Set("Content-Type", "application/ssml+xml")
	req.Header.Set("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3")
	req.Header.Set("User-Agent", "ai-phy-beautiful")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("请求 Azure 语音服务失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("Azure 语音服务返回 %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	return writeBody(resp.Body, outPath)
}

// synthOpenAICompatible 调用 OpenAI 兼容的 /audio/speech 接口（OpenAI / 商用 TTS 网关）。
func synthOpenAICompatible(ctx context.Context, cfg *model.AIModel, text, voice, outPath string) error {
	endpoint := strings.TrimRight(normalizeBase(cfg.BaseURL, "https://api.openai.com/v1"), "/") + "/audio/speech"

	modelName := cfg.ModelName
	if modelName == "" {
		modelName = "tts-1"
	}
	payload := map[string]any{
		"model":           modelName,
		"input":           text,
		"voice":           normalizeVoiceName(cfg, resolveVoice(cfg, voice, voiceTableFor(cfg, openAIVoices))),
		"response_format": "mp3",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("请求语音合成接口失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		msg := strings.TrimSpace(snippetText(string(raw), 300))
		// 音色不合法是最常见的一类 400（商用服务的音色名往往要带模型名前缀），单独点明怎么改
		hint := ""
		if strings.Contains(strings.ToLower(msg), "voice") {
			hint = "（音色名不被接受：商用服务通常要求写成「模型名:音色ID」，例如硅基流动是 " +
				"FunAudioLLM/CosyVoice2-0.5B:alex；可把音色填到本配置的「默认音色」里，留空则用内置映射）"
		}
		return fmt.Errorf("语音合成接口返回 %d: %s%s", resp.StatusCode, msg, hint)
	}
	// 返回 HTML/JSON 说明请求根本没打到语音接口（BaseURL 填错是首要原因），
	// 不能把它当成音频存下来让用户误以为合成成功了。
	if ct := resp.Header.Get("Content-Type"); !isAudioContentType(ct) {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("语音合成接口返回的不是音频（Content-Type: %s）：%s。%s",
			ct, strings.TrimSpace(snippetText(string(raw), 200)), ttsEndpointHint)
	}
	return writeBody(resp.Body, outPath)
}

// writeBody 把响应体写入 outPath。
//
// 先写同目录临时文件、成功后再原子改名：中途失败（断网、超时、进程被杀）
// 不会在目标位置留下 0 字节或半截的 mp3，避免被"文件已存在"逻辑误判为已完成。
func writeBody(r io.Reader, outPath string) error {
	tmpPath, err := tempSibling(outPath)
	if err != nil {
		return err
	}
	defer os.Remove(tmpPath)

	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("创建音频文件失败: %w", err)
	}
	written, copyErr := io.Copy(f, r)
	closeErr := f.Close()
	if copyErr != nil {
		return fmt.Errorf("写入音频失败: %w", copyErr)
	}
	if closeErr != nil {
		return fmt.Errorf("写入音频失败: %w", closeErr)
	}
	if written == 0 {
		return fmt.Errorf("语音服务返回了空音频")
	}
	return commitTemp(tmpPath, outPath)
}

// ttsEndpointHint 是配置填错时给出的可行动提示（商用 TTS 最常见的两种填错方式都覆盖）。
const ttsEndpointHint = "请检查「模型配置」里的 BaseURL 是否指向厂商的 API 地址" +
	"（例如硅基流动应为 https://api.siliconflow.cn/v1，而不是控制台网页地址 https://cloud.siliconflow.cn），" +
	"以及模型名（如 FunAudioLLM/CosyVoice2-0.5B）和 API Key 是否正确。"

// isAudioContentType 判断响应的 Content-Type 是否可能是音频。
//
// octet-stream 与空值放行（部分网关不标 Content-Type），最终由 ensureAudioFile 按文件头兜底。
func isAudioContentType(contentType string) bool {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	switch ct {
	case "", "application/octet-stream", "binary/octet-stream", "application/ogg", "application/mp4",
		"application/x-ogg", "application/x-mpeg", "application/mpeg":
		return true
	}
	return strings.HasPrefix(ct, "audio/") || strings.HasPrefix(ct, "video/")
}

// ensureAudioFile 校验刚写出的文件是不是音频容器；不是就删除并返回可操作的错误。
func ensureAudioFile(outPath string) error {
	f, err := os.Open(outPath)
	if err != nil {
		return fmt.Errorf("读取合成结果失败: %w", err)
	}
	head := make([]byte, 16)
	n, _ := io.ReadFull(f, head)
	// 必须先关闭句柄：Windows 下删除仍被打开的文件会失败，坏音频就会留在磁盘上
	_ = f.Close()
	head = head[:n]
	if audioKind(head) != "" {
		return nil
	}

	reason := describeResponseHead(head)
	if rmErr := os.Remove(outPath); rmErr != nil {
		// 删不掉也要说清楚，否则用户会以为"这份坏文件是有效音频"
		return fmt.Errorf("语音合成接口返回的不是音频（%s），且清理无效文件失败：%v。%s", reason, rmErr, ttsEndpointHint)
	}
	return fmt.Errorf("语音合成接口返回的不是音频（%s），本次结果已丢弃。%s", reason, ttsEndpointHint)
}

// audioKind 按文件头识别音频容器，返回类型名；无法识别返回空串。
func audioKind(head []byte) string {
	switch {
	case len(head) >= 3 && string(head[:3]) == "ID3":
		return "mp3"
	case len(head) >= 2 && head[0] == 0xFF && head[1]&0xE0 == 0xE0:
		// MPEG 帧同步（mp3）或 ADTS（aac）
		return "mpeg"
	case len(head) >= 12 && string(head[:4]) == "RIFF" && string(head[8:12]) == "WAVE":
		return "wav"
	case len(head) >= 4 && string(head[:4]) == "RIFF":
		return "riff"
	case len(head) >= 4 && string(head[:4]) == "OggS":
		return "ogg"
	case len(head) >= 12 && string(head[4:8]) == "ftyp":
		return "mp4"
	case len(head) >= 4 && string(head[:4]) == "fLaC":
		return "flac"
	case len(head) >= 4 && head[0] == 0x1A && head[1] == 0x45 && head[2] == 0xDF && head[3] == 0xA3:
		return "webm"
	case len(head) >= 4 && string(head[:4]) == "FORM":
		return "aiff"
	}
	return ""
}

// describeResponseHead 把响应开头变成人能读懂的说明，帮用户判断是哪种填错。
func describeResponseHead(head []byte) string {
	trimmed := strings.TrimSpace(string(head))
	lower := strings.ToLower(trimmed)
	switch {
	case strings.HasPrefix(lower, "<!doctype html") || strings.HasPrefix(lower, "<html"):
		return "内容是网页 HTML，BaseURL 很可能填成了网页/控制台地址而不是 API 地址"
	case strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "["):
		return fmt.Sprintf("内容是 JSON：%s", snippetText(trimmed, 160))
	case trimmed == "":
		return "内容是空内容"
	default:
		return fmt.Sprintf("文件头为 %q", snippetText(trimmed, 60))
	}
}

// snippetText 截断文本并按 rune 安全地补省略号。
func snippetText(s string, limit int) string {
	runes := []rune(s)
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit]) + "…"
}

// siliconflowVoiceIDs 是硅基流动 CosyVoice2 的预置音色中，项目双音色所用的两个。
//
// 官方规定 voice 必须写成 `<模型名>:<音色ID>`（不能只写 alex）；预置音色为
// 男声 alex / benjamin / charles / david，女声 anna / bella / claire / diana。
var siliconflowVoiceIDs = map[string]string{
	VoiceYunxi:    "alex", // 沉稳男声
	VoiceXiaoxiao: "anna", // 沉稳女声
}

// voiceTableFor 按配置挑选音色表。
//
// 硅基流动走 OpenAI 兼容协议，但音色名与 OpenAI 完全不同，且必须带模型名前缀，
// 所以这里按 BaseURL 识别、用配置里的模型名现场拼出 `<model>:<voiceId>`。
func voiceTableFor(cfg *model.AIModel, fallback map[string]string) map[string]string {
	if cfg == nil || !strings.Contains(strings.ToLower(cfg.BaseURL), "siliconflow") {
		return fallback
	}
	model := strings.TrimSpace(cfg.ModelName)
	if model == "" {
		model = "FunAudioLLM/CosyVoice2-0.5B"
	}
	return map[string]string{
		VoiceYunxi:    model + ":" + siliconflowVoiceIDs[VoiceYunxi],
		VoiceXiaoxiao: model + ":" + siliconflowVoiceIDs[VoiceXiaoxiao],
	}
}

// normalizeVoiceName 兜底规整音色名。
//
// 硅基流动要求 voice 写成 `<模型名>:<音色ID>`；用户只写了音色 ID（如 alex）时自动补前缀，
// 避免直接吃一个 400 Invalid voice。
func normalizeVoiceName(cfg *model.AIModel, name string) string {
	name = strings.TrimSpace(name)
	if name == "" || cfg == nil {
		return name
	}
	if !strings.Contains(strings.ToLower(cfg.BaseURL), "siliconflow") || strings.Contains(name, ":") {
		return name
	}
	model := strings.TrimSpace(cfg.ModelName)
	if model == "" {
		model = "FunAudioLLM/CosyVoice2-0.5B"
	}
	return model + ":" + name
}

// resolveVoice 解析音色名：配置里显式填写的最高优先，其次查服务商音色表，最后回退云希。
//
// 顺序很关键：以前 `table[voice]` 排在最前面，而调用方传进来的 voice 永远是内部标识
// yunxi/xiaoxiao，于是配置里的「默认音色」**永远不会生效** —— 商用服务商的音色名只有
// 用户知道，填了也没用，测试连接就会报 400 Invalid voice。
func resolveVoice(cfg *model.AIModel, voice string, table map[string]string) string {
	if cfg != nil {
		if v := strings.TrimSpace(cfg.Voice); v != "" {
			if _, isInnerID := table[v]; !isInnerID {
				return v
			}
		}
	}
	if name, ok := table[voice]; ok {
		return name
	}
	if voice != "" && voice != VoiceYunxi && voice != VoiceXiaoxiao {
		return voice // 直接传入厂商音色名
	}
	return table[VoiceYunxi]
}

// EstimateDurationMs 按中文朗读速度（约 5 字/秒）估算时长，用于缺少音频元信息时的兜底。
func EstimateDurationMs(text string) int {
	runes := len([]rune(strings.TrimSpace(text)))
	if runes == 0 {
		return 0
	}
	return runes * 1000 / 5
}

// mp3DurationMs 通过首个 MPEG 帧头估算时长（假定 CBR）。
func mp3DurationMs(path string) int {
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()

	head := make([]byte, 10)
	if _, err := io.ReadFull(f, head); err != nil {
		return 0
	}
	// 跳过 ID3v2 标签
	if string(head[:3]) == "ID3" {
		size := int(head[6])<<21 | int(head[7])<<14 | int(head[8])<<7 | int(head[9])
		if _, err := f.Seek(int64(10+size), io.SeekStart); err != nil {
			return 0
		}
		head = make([]byte, 4)
		if _, err := io.ReadFull(f, head); err != nil {
			return 0
		}
	}

	bitrate := mp3BitrateKbps(head)
	if bitrate == 0 {
		return 0
	}
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	// 时长(秒) = 文件字节数 * 8 / (码率 kbps * 1000)
	seconds := float64(info.Size()) * 8 / (float64(bitrate) * 1000)
	return int(seconds * 1000)
}

// mp3BitrateKbps 从 4 字节帧头解析 MPEG1 Layer3 码率。
func mp3BitrateKbps(h []byte) int {
	if len(h) < 4 || h[0] != 0xFF || h[1]&0xE0 != 0xE0 {
		return 0
	}
	versionBits := (h[1] >> 3) & 0x03 // 3=MPEG1
	layerBits := (h[1] >> 1) & 0x03   // 1=Layer3
	bitrateIdx := (h[2] >> 4) & 0x0F
	if versionBits != 3 || layerBits != 1 {
		return 0
	}
	table := []int{0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0}
	if int(bitrateIdx) >= len(table) {
		return 0
	}
	return table[bitrateIdx]
}

// AudioFileSize 返回音频文件大小（字节），用于管理后台展示。
func AudioFileSize(path string) int64 {
	if path == "" {
		return 0
	}
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return info.Size()
}

// ProbeHTTP 对配置的 BaseURL 做一次轻量连通性探测。
func ProbeHTTP(ctx context.Context, cfg *model.AIModel) error {
	if cfg.BaseURL == "" {
		return fmt.Errorf("未配置 BaseURL")
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(cfg.BaseURL, "/"), nil)
	if err != nil {
		return err
	}
	if cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("无法访问 %s: %w", cfg.BaseURL, err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	return nil
}

func escapeXML(s string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&apos;",
	)
	return replacer.Replace(s)
}
