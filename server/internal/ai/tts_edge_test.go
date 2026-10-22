package ai

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// EDGE_TTS_BIN 决定用哪个 edge-tts 发令牌。
//
// 微软把 Sec-MS-GEC 升到 v2 后，旧版库发 v1 令牌会被握手直接拒掉（403 空响应），
// 所以必须能显式指定"装了新版的解释器/可执行文件"，而不是靠 PATH 上的顺序碰运气。
func TestEdgeCandidatesPrefersEnvOverride(t *testing.T) {
	dir := t.TempDir()
	py := filepath.Join(dir, "python.exe")
	if err := touchFile(py); err != nil {
		t.Fatal(err)
	}
	t.Setenv("EDGE_TTS_BIN", py)

	cands, err := edgeCandidates()
	if err != nil {
		t.Fatalf("EDGE_TTS_BIN 指向存在的文件却报错: %v", err)
	}
	if len(cands) == 0 || cands[0].bin != py {
		t.Fatalf("首选调用方式应为 EDGE_TTS_BIN，得到 %+v", cands)
	}
	if strings.Join(cands[0].args, " ") != "-m edge_tts" {
		t.Fatalf("解释器形式的参数应为 -m edge_tts，得到 %v", cands[0].args)
	}
	// 兜底顺序必须保持原样，没配环境变量时行为不变
	if strings.Join(candidateTail(cands), ",") != "edge-tts,python,python3,py" {
		t.Fatalf("兜底候选顺序变了: %v", candidateTail(cands))
	}
}

func TestEdgeCandidatesEnvAcceptsExecutable(t *testing.T) {
	dir := t.TempDir()
	bin := filepath.Join(dir, "edge-tts.exe")
	if err := touchFile(bin); err != nil {
		t.Fatal(err)
	}
	t.Setenv("EDGE_TTS_BIN", bin)

	cands, err := edgeCandidates()
	if err != nil {
		t.Fatal(err)
	}
	if len(cands[0].args) != 0 {
		t.Fatalf("入口程序形式不应附加参数，得到 %v", cands[0].args)
	}
}

func TestEdgeCandidatesRejectsMissingEnvTarget(t *testing.T) {
	t.Setenv("EDGE_TTS_BIN", filepath.Join(t.TempDir(), "nope.exe"))

	if _, err := edgeCandidates(); err == nil || !strings.Contains(err.Error(), "EDGE_TTS_BIN") {
		t.Fatalf("填了不存在的文件必须明确报错，得到 %v", err)
	}
}

func TestEdgeCandidatesWithoutEnv(t *testing.T) {
	t.Setenv("EDGE_TTS_BIN", "")

	cands, err := edgeCandidates()
	if err != nil {
		t.Fatal(err)
	}
	if cands[0].bin != "edge-tts" || len(cands[0].args) != 0 || len(cands) != 4 {
		t.Fatalf("未设置时应保持原有 4 个候选，得到 %+v", cands)
	}
}

// 403 的响应体是空的，堆栈里只有 URL；错误信息必须直接给出可执行的下一步。
func TestConciseEdgeErrorExplainsTokenForbidden(t *testing.T) {
	stderr := "aiohttp.client_exceptions.WSServerHandshakeError: 403, " +
		"message='Invalid response status', url='wss://speech.platform.bing.com/consumer/speech/" +
		"synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4" +
		"&Sec-MS-GEC=E509C135DF101554&Sec-MS-GEC-Version=1-143.0.3650.75'"

	got := conciseEdgeError(stderr, nil)
	for _, want := range []string{"403", "Sec-MS-GEC", "EDGE_TTS_BIN", "时钟"} {
		if !strings.Contains(got, want) {
			t.Fatalf("错误信息缺少 %q：%s", want, got)
		}
	}
	// 不能被 synthEdge 的"音色名错误"分支误判成配置问题而跳过重试
	if strings.Contains(got, "Invalid voice") || strings.Contains(got, "not supported") {
		t.Fatalf("403 文案不能命中音色错误的判定: %s", got)
	}
}

func TestConciseEdgeErrorKeepsOtherCases(t *testing.T) {
	if got := conciseEdgeError("RuntimeError: NoAudioReceived", nil); !strings.Contains(got, "限流") {
		t.Fatalf("限流提示变了: %s", got)
	}
	if got := conciseEdgeError("some noise\nValueError: bad voice\nmore", nil); !strings.Contains(got, "bad voice") {
		t.Fatalf("通用错误应回落到最后一行异常: %s", got)
	}
}

func candidateTail(cands []edgeCandidate) []string {
	out := []string{}
	for _, c := range cands[1:] {
		out = append(out, c.bin)
	}
	return out
}

func touchFile(path string) error {
	return os.WriteFile(path, []byte("stub"), 0o644)
}
