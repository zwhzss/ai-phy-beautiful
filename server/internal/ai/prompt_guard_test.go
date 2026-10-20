package ai

import (
	"strings"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// 提示词必须明确要求「直接输出 JSON、不要输出思考过程」。
//
// 推理模型（DeepSeek-R1 / Qwen3 等）会把「最大 Token」优先用于思维链，
// 一旦正文被挤空，用户只会看到「解析教学内容 JSON 失败: unexpected end of JSON input」。
func TestPromptForbidsReasoningOutput(t *testing.T) {
	if !strings.Contains(SystemPrompt, "不要输出思考过程") {
		t.Error("SystemPrompt 缺少「不要输出思考过程」的输出纪律")
	}
	if !strings.Contains(SystemPrompt, "左花括号") {
		t.Error("SystemPrompt 未要求回复直接以 JSON 对象开头")
	}

	// user 消息（更靠近生成位置）里也要重申一次。
	exp := &model.Experiment{Title: "勾股定理", Number: "MATH-1"}
	prompt := BuildContentPrompt(exp, "平面几何")
	if !strings.Contains(prompt, "不要输出任何思考过程") {
		t.Error("BuildContentPrompt 的【输出要求】缺少「不要输出任何思考过程」")
	}
	if !strings.Contains(prompt, "第一个非空白字符必须是 {") {
		t.Error("BuildContentPrompt 未要求第一个非空白字符是 {")
	}
}

// 台词里的公式必须成对用 $ 包裹、同一张图里的多条曲线必须给出不同表达式。
//
// 没有 $ 包裹的裸 LaTeX（T_{n}、x^{n}）在字幕里会被当成普通文字念出来；
// 两条曲线写成同一表达式则会在默认参数下完全重合，学生只看得见一条。
func TestPromptRequiresDollarFormulasAndDistinctCurves(t *testing.T) {
	if !strings.Contains(SystemPrompt, "必须成对用 $ 包裹") {
		t.Error("SystemPrompt 未要求台词里的数学表达式用 $ 包裹")
	}
	if !strings.Contains(SystemPrompt, "同一张图里的多条曲线必须给出不同的表达式") {
		t.Error("SystemPrompt 未要求同一张图的多条曲线给出不同表达式")
	}

	exp := &model.Experiment{Title: "切比雪夫多项式", Number: "M33"}
	prompt := BuildContentPrompt(exp, "数学分析")
	if !strings.Contains(prompt, "必须成对用 $ 包裹") {
		t.Error("BuildContentPrompt 的【输出要求】未重申台词公式要用 $ 包裹")
	}
}
