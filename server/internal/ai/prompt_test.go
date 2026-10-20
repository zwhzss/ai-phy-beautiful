package ai

import (
	"encoding/json"
	"sort"
	"strings"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// 大模型偶尔把 params_schema 写成数组、把 animation 写成字符串，
// 解析层必须容错归一化成 map[string]ParamDef / AnimationConfig。
const looseContentJSON = `{
    "description": "通过互动实验让学生直观理解分数的本质，用饼图形式呈现部分与整体关系，帮助理解分数运算规律。",
    "formulas": [
        {"label": "加法：向右移动 b 个单位", "latex": "a + b = c"},
        {"label": "乘法：上下同步移动 a 个单位", "latex": "a * b = c"},
        {"label": "减法：向上移动 b 个单位", "latex": "a - b = c"}
    ],
    "history_info": {
        "mathematician": "古希腊数学家欧几里得、毕达哥拉斯",
        "background": "古希腊时期，人们发现用圆和弦等几何图形表示数量关系。",
        "story": "早期学者尝试用圆和线段表示比例。",
        "legacy": "分数作为数学基础。",
        "open_problem": "分数与实数之间的对应关系至今未解。",
        "cross_discipline": "分数理论是微积分、概率论等数学分支的基础。"
    },
    "app_hooks": [
        {"title": "教育应用", "desc": "用于小学阶段分数概念教学"},
        {"title": "图像分析", "desc": "用于展示分数运算规律"},
        {"title": "概率统计", "desc": "用于演示概率与比例的关系"}
    ],
    "params_schema": [
        {"parameter_name": "num_a", "type": "range", "min": 0, "max": 10, "step": 0.1, "default": 1, "label": "分子值"},
        {"parameter_name": "num_b", "type": "range", "min": 0, "max": 10, "step": 0.1, "default": 1, "label": "分母值"}
    ],
    "graph": {
        "kind": "3d",
        "axes": {"x": [-5, 5], "y": [-5, 5]},
        "elements": [
            {"type": "surface", "fn": "sin(x)*cos(y)", "range": [-3, 3], "resolution": 36, "palette": "rainbow"},
            {"type": "point", "at": [3, 0], "label": "(3,0)"}
        ],
        "surface": {"fn": "sin(x)*cos(y)", "range": [-3, 3], "resolution": 36, "palette": "rainbow"}
    },
    "prerequisites": ["分数运算基础"],
    "related": ["分数运算实验"],
    "narration": {
        "sections": [
            {
                "id": "intro",
                "title": "开场引入",
                "lines": [
                    {"id": "intro-1", "text": "今天我们来做个有趣的小实验，通过饼图直观感受分数的本质。", "animation": "reset"}
                ]
            }
        ]
    }
}`

func TestParseContentAcceptsLooseShape(t *testing.T) {
	content, err := ParseContent(looseContentJSON)
	if err != nil {
		t.Fatalf("ParseContent 应容错解析数组式 params_schema / 字符串式 animation，却报错: %v", err)
	}
	if len(content.ParamsSchema) != 2 {
		t.Fatalf("params_schema 应归一化为 2 个参数，实际 %d 个: %+v", len(content.ParamsSchema), content.ParamsSchema)
	}
	a, ok := content.ParamsSchema["num_a"]
	if !ok {
		t.Fatalf("归一化后应保留参数名 num_a，实际键: %v", keysOf(content.ParamsSchema))
	}
	if a.Type != "range" || a.Label != "分子值" || a.Default == nil {
		t.Errorf("num_a 的定义应被完整保留，实际: %+v", a)
	}
	if a.Min == nil || *a.Min != 0 || a.Max == nil || *a.Max != 10 || a.Step == nil || *a.Step != 0.1 {
		t.Errorf("num_a 的 min/max/step 应保留，实际: %+v", a)
	}
	if len(content.Narration.Sections) != 1 || len(content.Narration.Sections[0].Lines) != 1 {
		t.Fatalf("讲解稿应被解析出来，实际: %+v", content.Narration)
	}
	anim := content.Narration.Sections[0].Lines[0].Animation
	if anim == nil || anim.Action != "reset" {
		t.Fatalf("字符串式 animation 应归一化为 {action:reset}，实际: %+v", anim)
	}
}

func keysOf(m map[string]model.ParamDef) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// 提示词必须把「能动的主题优先动起来」写成硬性要求，并给出可用的写法：
// 少了这几句，模型会继续只给静态图 —— 学生看到的就是"AI 演示图不会动"。
//
// 动画要求写在系统提示词（SystemPrompt）里，输出纪律写在用户提示词里，两边都要检查。
func TestPromptRequiresAnimationForMovingTopics(t *testing.T) {
	userPrompt := BuildContentPrompt(&model.Experiment{
		Number: "P001", Title: "单摆", Level: "基础", Difficulty: "basic",
		Concept: "单摆的等时性", Description: "摆长与周期的关系",
	}, "经典力学")

	mustContain := []string{
		"动起来优先",               // 系统提示词的章节标题
		"motion",              // 参数方程动图图元
		`"fn":"sin(2*x-3*t)"`, // 表达式里带时间变量 t 的示例（比较时已去掉空格）
		"period",              // 时间轴配置
		"pingpong",            // 往返推进（单摆式来回）
		"t 与 s 是渲染器的保留变量名",    // t / s 不可当参数名（系统提示词）
		"随时间演化",               // 哪些主题必须动起来（系统提示词）
		"能动的主题必须动起来",          // 硬性要求（用户提示词）
	}
	flat := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(SystemPrompt + userPrompt)
	for _, want := range mustContain {
		needle := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(want)
		if !strings.Contains(flat, needle) {
			t.Errorf("提示词缺少动画要求片段 %q", want)
		}
	}
}

// 提示词必须要求「params_schema 里每个参数都在图形里被引用」。
//
// 用户实际遇到的情况：AI 为「角动量守恒」定义了质量 m 与外力矩 τ 两个滑块，
// 但图形里只有 m 出现在一句文字插值里、τ 完全没出现 —— 拖动它们图形毫无变化。
// 老提示词只要求"至少 2 个图元引用参数"，模型照做即合格，剩下两个滑块就成了死滑块。
func TestPromptRequiresEveryParamToBeReferenced(t *testing.T) {
	userPrompt := BuildContentPrompt(&model.Experiment{
		Number: "P002", Title: "角动量守恒", Level: "基础", Difficulty: "basic",
		Concept: "角动量守恒", Description: "质量分布与外力矩对转动的影响",
	}, "经典力学")

	mustContain := []string{
		"每一个参数都必须至少被一个图元引用",     // 系统提示词的硬性要求
		"把它从 params_schema 里删掉", // 用不上就别留死滑块（系统提示词）
		"不算图形联动",                // 只写进 text / label 不算（系统提示词）
		"num_theta0 * sin(s)",   // motion 的 x/y 里可以写参数（系统提示词）
		"每个参数都要在图形里被引用一次",       // 用户提示词的自检项
		"绝不留", // 用户提示词：不许留拖了没反应的滑块
	}
	flat := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(SystemPrompt + userPrompt)
	for _, want := range mustContain {
		needle := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(want)
		if !strings.Contains(flat, needle) {
			t.Errorf("提示词缺少「每个参数都要联动」的片段 %q", want)
		}
	}
}

// 规范形态的 JSON 必须走「直接解析」快路径：归一化不得改动正常内容（含数字精度）。
func TestParseContentKeepsCanonicalShape(t *testing.T) {
	const canonical = `{
  "description": "规范简介",
  "formulas": [{"label": "公式", "latex": "a + b = c"}],
  "params_schema": {"num_a": {"type": "range", "min": 0, "max": 10, "step": 0.1, "default": 1, "label": "分子值"}},
  "graph": {"kind": "2d", "elements": [{"type": "circle", "center": [0, 0], "r": "$num_a"}]},
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "intro-1", "text": "台词", "animation": {"action": "reset"}}]}]}
}`
	if _, changed := normalizeContentJSON(canonical); changed {
		t.Errorf("规范形态不应被归一化改写")
	}
	content, err := ParseContent("```json\n" + canonical + "\n```")
	if err != nil {
		t.Fatalf("规范 JSON 应能解析: %v", err)
	}
	if content.ParamsSchema["num_a"].Step == nil || *content.ParamsSchema["num_a"].Step != 0.1 {
		t.Errorf("step 0.1 应保持原值，实际: %+v", content.ParamsSchema["num_a"].Step)
	}
	if string(content.Graph) == "" {
		t.Errorf("graph 应被保留")
	}
}

// graph 被双重编码成字符串时也应还原为对象；params_schema 里单键包裹的写法同样兼容。
func TestParseContentAcceptsWrappedShapes(t *testing.T) {
	const wrapped = `{
  "description": "简介",
  "params_schema": [{"num_a": {"type": "range", "min": 0, "max": 5, "default": 2}}],
  "graph": "{\"kind\": \"2d\", \"elements\": [{\"type\": \"point\", \"at\": [1, 1]}]}",
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "intro-1", "text": "台词"}]}]}
}`
	content, err := ParseContent(wrapped)
	if err != nil {
		t.Fatalf("应容错解析: %v", err)
	}
	if len(content.ParamsSchema) != 1 || content.ParamsSchema["num_a"].Type != "range" {
		t.Fatalf("单键包裹的 params_schema 应还原为 num_a，实际: %+v", content.ParamsSchema)
	}
	if !strings.Contains(string(content.Graph), `"kind"`) {
		t.Errorf("双重编码的 graph 应还原为对象，实际: %s", content.Graph)
	}
}

// 完全无法修复的内容仍要报出可诊断的错误，不能让上层拿到半成品。
func TestParseContentRejectsBrokenJSON(t *testing.T) {
	if _, err := ParseContent("抱歉，我无法生成这段内容。"); err == nil {
		t.Fatal("没有 JSON 时应报错")
	} else if !strings.Contains(err.Error(), "解析教学内容 JSON 失败") {
		t.Fatalf("错误信息应可诊断，实际: %v", err)
	}
}

// 既有的「截断修复」行为不能被改动破坏：max_tokens 截断后仍应拿到前半部分内容。
func TestParseContentStillRepairsTruncatedJSON(t *testing.T) {
	const truncated = `{
  "description": "被截断的简介",
  "formulas": [{"label": "公式", "latex": "a + b = c"}],
  "params_schema": {"num_a": {"type": "range", "min": 0, "max": 10, "default": 1}},
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "intro-1", "text": "第一句台词"}`
	content, err := ParseContent(truncated)
	if err != nil {
		t.Fatalf("截断 JSON 应被修复，实际报错: %v", err)
	}
	if content.Description != "被截断的简介" || len(content.ParamsSchema) != 1 {
		t.Fatalf("修复后应保留已完整输出的字段，实际: %+v", content)
	}
}

// 模型偶尔把对象的 "}" 写成 "]"、加尾随逗号或注释 —— 这些符号级错误要能修复后解析成功，
// 而不是整份内容作废（用户看到的报错形如 invalid character ']' after object key:value pair）。
func TestParseContentRepairsSyntaxErrors(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{
			name: "对象被 ] 误闭合",
			raw: `{
  "description": "括号写错的内容",
  "formulas": [{"label": "绝对值定义", "latex": "|x| = x"}],
  "params_schema": {"num_a": {"type": "range", "min": 0, "max": 10, "default": 1]},
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "intro-1", "text": "第一句"}]}]}
}`,
		},
		{
			name: "数组与对象都有尾随逗号",
			raw: `{
  "description": "尾随逗号的内容",
  "formulas": [{"label": "f", "latex": "a+b=c"},],
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "i1", "text": "第一句"},]},]},
}`,
		},
		{
			name: "带注释（字符串内的 // 不能动）",
			raw: `{
  // 这是模型多写的注释
  "description": "带注释的内容，参考 http://example.com/a",
  /* 块注释 */
  "formulas": [{"label": "f", "latex": "a+b=c"}],
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "i1", "text": "a//b 不是注释"}]}]}
}`,
		},
		{
			// JSON 之后再补一段说明、且说明里含 } 时，按「第一个 { 到最后一个 }」截取会把垃圾尾巴带进来，
			// 必须由「只解第一个完整 JSON 值」的兜底救回来。
			name: "JSON 之后还有含 } 的说明文字",
			raw: `{
  "description": "尾部带说明的内容",
  "formulas": [{"label": "f", "latex": "a+b=c"}],
  "narration": {"sections": [{"id": "intro", "title": "开场", "lines": [{"id": "i1", "text": "第一句"}]}]}
}
说明：elements 里每个图元形如 {"type":"circle"}，坐标写在 at 字段中。`,
		},
	}

	for _, tc := range cases {
		content, err := ParseContent(tc.raw)
		if err != nil {
			t.Errorf("%s：应能修复后解析，实际报错 %v", tc.name, err)
			continue
		}
		if strings.TrimSpace(content.Description) == "" || len(content.Narration.Sections) == 0 {
			t.Errorf("%s：修复后字段不完整: %+v", tc.name, content)
		}
	}

	// 字符串里的 // 与 URL 必须原样保留（不能被当成注释删掉）
	content, err := ParseContent(cases[2].raw)
	if err != nil {
		t.Fatalf("带注释的内容应能解析: %v", err)
	}
	if got := content.Narration.Sections[0].Lines[0].Text; got != "a//b 不是注释" {
		t.Errorf("字符串内的 // 被误删，实际: %q", got)
	}
	if !strings.Contains(content.Description, "http://example.com/a") {
		t.Errorf("URL 被误删，实际: %q", content.Description)
	}
}

// 模型在 JSON 字符串里直接用英文双引号强调（中文表达强的模型常犯）时，
// 字符串会提前闭合、整份 JSON 断裂 —— 必须能修复后解析，且内容里的引号要保留。
func TestParseContentRepairsUnescapedQuotes(t *testing.T) {
	const raw = `{
  "description": "本实验帮助学生理解罗马数字，并体验"小减大"的特殊规则。",
  "formulas": [{"label": "减法规则", "latex": "IV = 5-1 = 4"}],
  "narration": {"sections": [{"id": "concept", "title": "核心概念", "lines": [
    {"id": "concept-1", "text": "核心规则是"加法原则"：相同符号连写表示累加，例如 III = 3。"},
    {"id": "concept-2", "text": "这是它最常见的"出镜"场景。
换行也要能修"}
  ]}]}
}`
	content, err := ParseContent(raw)
	if err != nil {
		t.Fatalf("字符串内裸引号应能修复后解析，实际报错: %v", err)
	}
	if !strings.Contains(content.Description, `"小减大"`) {
		t.Errorf("修复后内容里的引号应原样保留，实际: %q", content.Description)
	}
	lines := content.Narration.Sections[0].Lines
	if len(lines) != 2 {
		t.Fatalf("应解析出 2 行台词，实际 %d 行", len(lines))
	}
	if !strings.Contains(lines[0].Text, `"加法原则"`) {
		t.Errorf("台词里的引号应保留，实际: %q", lines[0].Text)
	}
	if !strings.Contains(lines[1].Text, "出镜") {
		t.Errorf("第 2 行内容丢失，实际: %q", lines[1].Text)
	}

	// 本来就合法的 JSON 不能被这个修复改动（合法 JSON 字符串里不会有裸引号）
	const canonical = `{"description":"正常内容","narration":{"sections":[{"id":"intro","title":"开场","lines":[{"id":"i1","text":"台词"}]}]}}`
	if _, changed := repairUnescapedQuotes(canonical); changed {
		t.Error("合法 JSON 不应被 repairUnescapedQuotes 改动")
	}
}

// contentSchemaHint 必须是合法 JSON，且示例本身要演示「参数联动」——
// 示例若全是固定数字，模型会照抄，学生拖动参数时图形不动。
func TestContentSchemaHintIsValidAndShowsParamLink(t *testing.T) {
	if !json.Valid([]byte(contentSchemaHint)) {
		t.Fatal("contentSchemaHint 不是合法 JSON")
	}
	var hint map[string]any
	if err := json.Unmarshal([]byte(contentSchemaHint), &hint); err != nil {
		t.Fatal(err)
	}
	if _, ok := hint["params_schema"].(map[string]any); !ok {
		t.Error("params_schema 示例必须是对象（键 = 参数名），不能是数组")
	}
	graph, ok := hint["graph"].(map[string]any)
	if !ok {
		t.Fatal("graph 示例缺失或不是对象")
	}
	elements, ok := graph["elements"].([]any)
	if !ok || len(elements) == 0 {
		t.Fatal("graph.elements 示例缺失")
	}
	linked := 0
	for _, e := range elements {
		el, ok := e.(map[string]any)
		if !ok {
			continue
		}
		raw, _ := json.Marshal(el)
		if strings.Contains(string(raw), "num_a") || strings.Contains(string(raw), "num_b") {
			linked++
		}
	}
	if linked < 2 {
		t.Errorf("graph 示例里至少应有 2 个图元演示参数联动（写成 \"$num_a\" 或在表达式里用参数名），实际 %d 个", linked)
	}
	// 示例图元必须带 "_demo": true 标记 —— graphTemplateWarning 靠它识别「模型照抄示例」。
	for _, e := range elements {
		el, ok := e.(map[string]any)
		if !ok {
			continue
		}
		if demo, _ := el["_demo"].(bool); !demo {
			t.Errorf("示例图元缺少 \"_demo\": true 标记（照抄检测依赖它），type=%v", el["type"])
		}
	}
	if surface, ok := graph["surface"].(map[string]any); ok {
		if fn, _ := surface["fn"].(string); !strings.Contains(fn, "num_a") && !strings.Contains(fn, "num_b") {
			t.Errorf("3D 曲面示例的 fn 也应含参数名，实际: %q", fn)
		}
	}

	// 讲解稿示例必须写全 5 段：示例里只有一段时，模型会照抄只生成「开场引入」，
	// 合成语音也就只有一句（用户会误以为「合成坏了」）。
	narration, ok := hint["narration"].(map[string]any)
	if !ok {
		t.Fatal("narration 示例缺失或不是对象")
	}
	sections, ok := narration["sections"].([]any)
	if !ok || len(sections) == 0 {
		t.Fatal("narration.sections 示例缺失")
	}
	if len(sections) < 5 {
		t.Errorf("narration.sections 示例至少要有 5 段（intro/concept/formula/application/summary），实际 %d 段", len(sections))
	}
	lines := 0
	for _, s := range sections {
		sec, ok := s.(map[string]any)
		if !ok {
			continue
		}
		if ls, ok := sec["lines"].([]any); ok {
			lines += len(ls)
		}
	}
	if lines < 8 {
		t.Errorf("narration 示例的行数太少（应示范每段 2 行左右），实际 %d 行", lines)
	}
}
