package service

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/ai"
	"github.com/ai-phy-beautiful/server/internal/model"
)

// 照抄示例的图形必须被识别出来 —— 否则每个实验的画面都长一样。
func TestGraphTemplateWarning(t *testing.T) {
	copied := &model.ExperimentContent{
		Graph: json.RawMessage(`{"kind":"2d","elements":[{"type":"rect","w":"$num_a","_demo":true}]}`),
	}
	if w := graphTemplateWarning(1, copied); w == "" {
		t.Error("带 _demo 标记的图形应判定为照抄示例")
	}

	oldCopy := &model.ExperimentContent{
		Graph: json.RawMessage(`{"kind":"2d","elements":[{"type":"text","text":"拖动参数试试"}]}`),
	}
	if w := graphTemplateWarning(1, oldCopy); w == "" {
		t.Error("照抄旧示例文案也应判定为照抄")
	}

	themed := &model.ExperimentContent{
		Graph: json.RawMessage(`{"kind":"2d","elements":[{"type":"circle","center":[0,0],"r":"$num_a","fill":"rgba(102,126,234,0.35)"},{"type":"text","at":[0,0],"text":"把整块饼分成 num_b 份"}]}`),
	}
	if w := graphTemplateWarning(1, themed); w != "" {
		t.Errorf("针对主题设计的图形不应提示，实际: %q", w)
	}

	if w := graphTemplateWarning(1, nil); w != "" {
		t.Errorf("空内容不应提示，实际: %q", w)
	}
}

// 讲解稿段落不完整时必须提示 —— 模型照抄「只有一段」的示例时，
// 合成语音会跟着变少，用户会误以为合成坏了。
func TestNarrationWarning(t *testing.T) {
	single := &model.ExperimentContent{
		Narration: model.NarrationScript{Sections: []model.NarrationSection{{
			ID:    "intro",
			Title: "开场引入",
			Lines: []model.NarrationLine{{ID: "intro-1", Text: "台词"}},
		}}},
	}
	if w := narrationWarning(1, single); w == "" {
		t.Error("只生成 1 段 1 行时应给出提示")
	} else if !strings.Contains(w, "1 段") {
		t.Errorf("提示里应说明实际段数，实际: %q", w)
	}

	full := &model.ExperimentContent{}
	for _, id := range []string{"intro", "concept", "formula", "application", "summary"} {
		full.Narration.Sections = append(full.Narration.Sections, model.NarrationSection{
			ID:    id,
			Title: id,
			Lines: []model.NarrationLine{
				{ID: id + "-1", Text: "台词一"},
				{ID: id + "-2", Text: "台词二"},
			},
		})
	}
	if w := narrationWarning(1, full); w != "" {
		t.Errorf("5 段 10 行不应提示，实际: %q", w)
	}

	if w := narrationWarning(1, nil); w != "" {
		t.Errorf("空内容不应提示，实际: %q", w)
	}
}

// 参数面板里的每个滑块都必须在图形里被用到，否则"拖了没反应"。
func TestGraphParamCoverageWarning(t *testing.T) {
	schema := map[string]model.ParamDef{
		"num_a": {Type: "range"},
		"num_b": {Type: "range"},
	}
	both := &model.ExperimentContent{
		ParamsSchema: schema,
		Graph:        json.RawMessage(`{"kind":"2d","elements":[{"type":"rect","w":"$num_a","h":"$num_b"}]}`),
	}
	if w := graphParamCoverageWarning(1, both); w != "" {
		t.Errorf("两个参数都被引用时不应提示，实际: %q", w)
	}

	partial := &model.ExperimentContent{
		ParamsSchema: schema,
		Graph:        json.RawMessage(`{"kind":"2d","elements":[{"type":"rect","w":"$num_a","h":2}]}`),
	}
	w := graphParamCoverageWarning(1, partial)
	if w == "" {
		t.Fatal("有参数未被引用时应提示")
	}
	if !strings.Contains(w, "num_b") {
		t.Errorf("提示应点名未被引用的参数，实际: %q", w)
	}
	if strings.Contains(w, "num_a") {
		t.Errorf("不应把已引用的参数也算进去，实际: %q", w)
	}

	if w := graphParamCoverageWarning(1, &model.ExperimentContent{ParamsSchema: schema}); w != "" {
		t.Errorf("没有 graph 时不应提示，实际: %q", w)
	}
	if w := graphParamCoverageWarning(1, &model.ExperimentContent{Graph: json.RawMessage(`{}`)}); w != "" {
		t.Errorf("没有 params_schema 时不应提示，实际: %q", w)
	}
}

// 只在文字里写 $参数名不算联动：数值字段 / 表达式才真正驱动重绘。
func TestGraphParamLinkOnlyCountsGeometry(t *testing.T) {
	schema := map[string]model.ParamDef{"num_a": {Type: "range"}, "num_b": {Type: "range"}}

	geometry := json.RawMessage(`{"kind":"2d","elements":[{"type":"rect","at":[0,0],"w":"$num_a","h":"$num_b"}]}`)
	if !graphHasParamLink(geometry, schema) {
		t.Error("数值字段引用参数应判定为已联动")
	}

	expression := json.RawMessage(`{"kind":"2d","elements":[{"type":"curve","fn":"num_a * x","fromX":0,"toX":"$num_b"}]}`)
	if !graphHasParamLink(expression, schema) {
		t.Error("表达式引用参数应判定为已联动")
	}

	// 用户实际遇到的情况：参数只出现在 point.label / text.text 里，几何字段全是固定数字
	labelOnly := json.RawMessage(`{"kind":"2d","elements":[
		{"type":"point","at":[4.3,2.3],"label":"$num_a"},
		{"type":"text","at":[9,0],"text":"$num_a + $num_b = $num_a + $num_b"},
		{"type":"rect","at":[1,0.5],"w":6.5,"h":3.5}]}`)
	if graphHasParamLink(labelOnly, schema) {
		t.Error("只写在 label/text 里应判定为未联动（否则拖动参数画面不会变却无提示）")
	}
	unused := graphUnusedParams(labelOnly, schema)
	if len(unused) != 2 {
		t.Errorf("两个参数都应算未引用，实际: %v", unused)
	}
	if w := graphLinkWarning(1, &model.ExperimentContent{Graph: labelOnly, ParamsSchema: schema}); w == "" {
		t.Error("只写在文字里时应给出未联动提示")
	}
}

// 参数写在「动画/数列/饼图」图元的专属字段里同样算已引用 —— 这些字段也在驱动重绘。
//
// 用户实际遇到的误报：motion 图元的 x / y 是表达式字段，但早期实现只扫描 fn，
// 于是 "x": "num_a*cos(s)" 这种写法会被误判成"参数没被引用"，提示用户去重新生成。
func TestGraphParamCoverageCountsAnimAndSeqFields(t *testing.T) {
	schema := map[string]model.ParamDef{
		"num_theta0": {Type: "range"},
		"num_n":      {Type: "range"},
		"num_k":      {Type: "range"},
		"num_frac":   {Type: "range"},
		"num_never":  {Type: "range"},
	}
	cases := []struct {
		name  string
		graph string
		// 这些参数确实写在了驱动绘制的字段里，不得被判为未引用
		referenced []string
	}{
		{
			"motion 的 x / y 表达式",
			`{"kind":"2d","elements":[{"type":"motion","x":"num_theta0*sin(s)","y":"-num_theta0*cos(s)","label":"$num_never"}]}`,
			[]string{"num_theta0"},
		},
		{
			"motion 的 xs / ys 别名",
			`{"kind":"2d","elements":[{"type":"motion","xs":"$num_theta0*cos(s)","ys":"sin(s)"}]}`,
			[]string{"num_theta0"},
		},
		{
			"motion 的 span / sFrom / sTo",
			`{"kind":"2d","elements":[{"type":"motion","x":"cos(s)","y":"sin(s)","span":["$num_theta0",1],"sFrom":"$num_n","sTo":1}]}`,
			[]string{"num_theta0", "num_n"},
		},
		{
			"sequence 的 nFrom / nTo 别名",
			`{"kind":"2d","elements":[{"type":"sequence","fn":"n^2","nFrom":1,"nTo":"$num_n"}]}`,
			[]string{"num_n"},
		},
		{
			"pie 的 numerator / denominator",
			`{"kind":"2d","elements":[{"type":"pie","center":[0,0],"r":1,"numerator":"$num_frac","denominator":"$num_k"}]}`,
			[]string{"num_frac", "num_k"},
		},
		{
			"3D 曲面的 fn",
			`{"kind":"3d","surface":{"fn":"num_k*sin(x - num_theta0*y)","range":[-3,3]}}`,
			[]string{"num_k", "num_theta0"},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			unused := graphUnusedParams(json.RawMessage(c.graph), schema)
			flagged := make(map[string]bool, len(unused))
			for _, name := range unused {
				flagged[name] = true
			}
			for _, name := range c.referenced {
				if flagged[name] {
					t.Errorf("%s 写在驱动绘制的字段里，不该被判为未引用（unused=%v）", name, unused)
				}
			}
			// 反向保护：真正没用到的参数仍然必须报出来，别把检测放宽成"永远不报"。
			if !flagged["num_never"] {
				t.Errorf("num_never 从未在图形里出现，应被判为未引用（unused=%v）", unused)
			}
		})
	}
}

// 写在"渲染器直接使用、不解析参数"的字段里（dash / mode / closed），
// 既不算联动、也不算"只写在文字标注里" —— 提示语要归到"图形里完全没有用到"才符合现象。
func TestGraphParamCoverageRawOptionFieldsAreNotTextOnly(t *testing.T) {
	schema := map[string]model.ParamDef{
		"num_dash": {Type: "range"},
		"num_mode": {Type: "range"},
		"num_txt":  {Type: "range"},
	}
	graph := json.RawMessage(`{"kind":"2d","elements":[
		{"type":"line","from":[0,0],"to":[1,1],"dash":["$num_dash",4]},
		{"type":"sequence","fn":"n","from":1,"to":5,"mode":"$num_mode"},
		{"type":"text","at":[0,0],"text":"参考值 $num_txt"}]}`)

	w := graphParamCoverageWarning(1, &model.ExperimentContent{ParamsSchema: schema, Graph: graph})
	inText, absent := splitCoverageWarning(t, w)
	if !strings.Contains(inText, "num_txt") || !strings.Contains(inText, "文字") {
		t.Errorf("num_txt 只写在 text 里，应归入「只写在文字标注里」，实际: %q", w)
	}
	if !strings.Contains(absent, "完全没有用到") {
		t.Errorf("dash / mode 这类字段里的参数应归入「完全没有用到」，实际: %q", w)
	}
	for _, name := range []string{"num_dash", "num_mode"} {
		if strings.Contains(inText, name) {
			t.Errorf("%s 不属于「文字标注」，不该出现在那半句里，实际: %q", name, w)
		}
		if !strings.Contains(absent, name) {
			t.Errorf("%s 应出现在「完全没有用到」那半句里，实际: %q", name, w)
		}
	}
}

// 把两条提示语拆开取用：句 A = "只写在文字标注里…"，句 B = "完全没有用到…"。
//
// 早先的测试只在整条消息里做 strings.Contains，结果**分类写反也能通过**
// （参数跑到另一句里了，但两句话里的关键词都在），所以这里必须分句断言。
func splitCoverageWarning(t *testing.T, w string) (textOnlyClause, absentClause string) {
	t.Helper()
	if w == "" {
		t.Fatal("应给出提示，实际为空")
	}
	body := strings.TrimPrefix(w, "提示：")
	parts := strings.SplitN(body, "；", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	// 只有一种情形：靠关键词判断它是哪一句
	if strings.Contains(body, "只写在文字标注里") {
		return body, ""
	}
	return "", body
}

// 提示要把两种「拖了没反应」区分开：
//  1. 参数只写在文字/标注里 —— 文字里的数字会变，图形形状不变；
//  2. 参数在图形里完全没出现 —— 拖了什么都不变。
//
// 早期把两者合并成一句「拖动它画面不会变化」，对第 1 种说法不准确（用户明明看到数字变了）。
func TestGraphParamCoverageMessageDistinguishesTextOnly(t *testing.T) {
	schema := map[string]model.ParamDef{
		"num_text": {Type: "range"},
		"num_gone": {Type: "range"},
		"num_used": {Type: "range"},
	}
	content := &model.ExperimentContent{
		ParamsSchema: schema,
		Graph: json.RawMessage(`{"kind":"2d","elements":[
			{"type":"rect","w":"$num_used","h":1},
			{"type":"text","at":[0,0],"text":"I = $num_text * 2"}]}`),
	}
	w := graphParamCoverageWarning(1, content)
	inText, absent := splitCoverageWarning(t, w)

	if !strings.Contains(inText, "num_text") || !strings.Contains(inText, "文字") {
		t.Errorf("num_text 只写在 text 里，应出现在「只写在文字标注里」那半句，实际: %q", w)
	}
	if strings.Contains(inText, "num_gone") {
		t.Errorf("num_gone 图形里完全没出现，不该被说成「只写在文字标注里」，实际: %q", w)
	}
	if !strings.Contains(absent, "num_gone") || !strings.Contains(absent, "完全没有用到") {
		t.Errorf("num_gone 应出现在「完全没有用到」那半句，实际: %q", w)
	}
	if strings.Contains(absent, "num_text") {
		t.Errorf("num_text 只写在文字里，不该被说成「完全没有用到」，实际: %q", w)
	}
	if strings.Contains(w, "num_used") {
		t.Errorf("已引用的参数不应出现在提示里，实际: %q", w)
	}
}

// 反过来也要成立：只有"写在文字里"这一类时，不能凭空生成第二句
// （两句话都出现会让用户以为还有别的问题）。
func TestGraphParamCoverageOnlyTextOnly(t *testing.T) {
	schema := map[string]model.ParamDef{"num_txt": {Type: "range"}, "num_used": {Type: "range"}}
	content := &model.ExperimentContent{
		ParamsSchema: schema,
		Graph: json.RawMessage(`{"kind":"2d","elements":[
			{"type":"rect","w":"$num_used","h":1},
			{"type":"circle","center":[0,0],"r":1,"label":"参考 $num_txt"}]}`),
	}
	w := graphParamCoverageWarning(1, content)
	inText, absent := splitCoverageWarning(t, w)
	if !strings.Contains(inText, "num_txt") {
		t.Errorf("num_txt 只写在 label 里，应出现在文字那半句，实际: %q", w)
	}
	if strings.Contains(absent, "完全没有用到") {
		t.Errorf("没有「完全没用到」的参数时不该出现第二句，实际: %q", w)
	}
}

// 用户真实遇到的那一份（角动量守恒，AI 版内容来自 content_versions）：
//   - num_r1 / num_r2 写在圆的 r、点的 at 与动画表达式里 → 真联动；
//   - num_m 只写在 text 插值里（"I = … $num_m …"）→ 只有文字里的数字会变；
//   - num_tau 只在讲解文字里以「τ≠0」出现，图形里完全没有 → 拖了什么都不变。
//
// 提示必须把后两者分开说，否则"拖动它画面不会变化"与用户看到的现象（数字变了）矛盾。
func TestGraphParamCoverageOnRealAngularMomentumGraph(t *testing.T) {
	schema := map[string]model.ParamDef{
		"num_m":   {Type: "range", Label: "每个质量块质量 m"},
		"num_r1":  {Type: "range", Label: "内圈质量块半径 r₁"},
		"num_r2":  {Type: "range", Label: "外圈质量块半径 r₂"},
		"num_tau": {Type: "range", Label: "外力矩 τ"},
	}
	graph := json.RawMessage(`{"kind":"2d","axes":{"x":[-4,4],"y":[-4,4]},
		"animate":{"period":6,"pingpong":false},
		"elements":[
			{"type":"circle","center":[0,0],"r":"$num_r2","color":"#a0aec0"},
			{"type":"circle","center":[0,0],"r":"$num_r1","color":"#a0aec0"},
			{"type":"line","from":[0,0],"to":["$num_r2 * cos(2*t)","$num_r2 * sin(2*t)"],"color":"#667eea"},
			{"type":"point","at":["$num_r1 * cos(2*t)","$num_r1 * sin(2*t)"],"label":"内圈 m"},
			{"type":"text","at":[-3.8,3.5],"text":"I = 2m(r₁² + r₂²) = $num_m * 2 * ($num_r1^2 + $num_r2^2)"},
			{"type":"text","at":[-3.8,-3.4],"text":"拖动 r₁、r₂ 观察质量分布；τ≠0 时 L 随时间改变"}]}`)

	w := graphParamCoverageWarning(1, &model.ExperimentContent{ParamsSchema: schema, Graph: graph})
	t.Logf("用户实际看到的提示（修正后）：%s", w)
	inText, absent := splitCoverageWarning(t, w)
	if !strings.Contains(inText, "num_m") || !strings.Contains(inText, "文字") {
		t.Errorf("num_m 只写在 text 里，应归入「只写在文字标注里」那半句，实际: %q", w)
	}
	if strings.Contains(inText, "num_tau") {
		t.Errorf("num_tau 图形里完全没出现，不该被说成「只写在文字标注里」，实际: %q", w)
	}
	if !strings.Contains(absent, "num_tau") || !strings.Contains(absent, "完全没有用到") {
		t.Errorf("num_tau 应归入「完全没有用到」那半句，实际: %q", w)
	}
	if strings.Contains(absent, "num_m") {
		t.Errorf("num_m 有出现在文字里，不该被说成「完全没有用到」，实际: %q", w)
	}
	for _, used := range []string{"num_r1", "num_r2"} {
		if strings.Contains(w, used) {
			t.Errorf("%s 写在 r / at / 动画表达式里，不该出现在提示里，实际: %q", used, w)
		}
	}
}

// 提示词里【JSON 结构】的示例本身必须满足"每个参数都被图形引用"这条硬性要求。
//
// 示例是模型最爱照抄的模板：示例里带一个死滑块，等于亲手教模型留死滑块
// （用户遇到的 num_tau 就是这么来的：需求写了、图形里没接上）。
func TestPromptJsonExampleWiresEveryParam(t *testing.T) {
	prompt := ai.BuildContentPrompt(&model.Experiment{
		Number: "P003", Title: "示例自检", Level: "基础", Difficulty: "basic",
		Concept: "示例自检", Description: "示例自检",
	}, "经典力学")

	// 用 LastIndex：【JSON 结构】这个字样在规则 7 里也出现过一次（"【JSON 结构】里带 _demo 的图元…"），
	// 取第一次出现会把规则 8 之后的一大段说明当成"示例 JSON"去解析。
	idx := strings.LastIndex(prompt, "【JSON 结构】")
	if idx < 0 {
		t.Fatal("用户提示词里没有【JSON 结构】区块")
	}
	content, err := ai.ParseContent(prompt[idx:])
	if err != nil {
		t.Fatalf("【JSON 结构】示例必须是一份可解析的 JSON: %v", err)
	}
	if len(content.ParamsSchema) == 0 || len(content.Graph) == 0 {
		t.Fatal("示例里应同时给出 params_schema 与 graph")
	}
	if unused := graphUnusedParams(content.Graph, content.ParamsSchema); len(unused) > 0 {
		t.Errorf("示例图形没有引用参数 %v —— 示例自己就不合格，模型会照着留死滑块", unused)
	}
}

// 空图元（如 "points": []）画不出任何东西，必须提示（用户看到的是整片空白）。
func TestGraphEmptyElementWarning(t *testing.T) {
	emptyOnly := &model.ExperimentContent{
		Graph: json.RawMessage(`{"kind":"2d","elements":[{"type":"text","at":[7,28],"text":"说明"},{"type":"polyline","points":[],"color":"#667eea"}]}`),
	}
	w := graphEmptyElementWarning(1, emptyOnly)
	if w == "" {
		t.Fatal("存在空 points 时应提示")
	}
	if !strings.Contains(w, "空图元") {
		t.Errorf("提示应说明空图元问题，实际: %q", w)
	}

	// 用户实际遇到的那份：两个 polyline 都是空 points，另一个是 sequence
	almostEmpty := &model.ExperimentContent{
		Graph: json.RawMessage(`{"kind":"2d","elements":[
			{"type":"polyline","points":[]},{"type":"polyline","points":[]},
			{"type":"sequence","fn":"1 + (n-1)*num_d","from":1,"to":"$num_n","mode":"bars"}]}`),
	}
	if w := graphEmptyElementWarning(1, almostEmpty); w == "" || !strings.Contains(w, "2 个空图元") {
		t.Errorf("应报出 2 个空图元，实际: %q", w)
	}

	normal := &model.ExperimentContent{
		Graph: json.RawMessage(`{"kind":"2d","elements":[{"type":"polyline","points":[[0,0],[1,1]]},{"type":"text","at":[0,0],"text":"x"}]}`),
	}
	if w := graphEmptyElementWarning(1, normal); w != "" {
		t.Errorf("正常图形不应提示，实际: %q", w)
	}

	noElements := &model.ExperimentContent{Graph: json.RawMessage(`{"kind":"2d","elements":[]}`)}
	if w := graphEmptyElementWarning(1, noElements); w == "" {
		t.Error("没有任何图元时应提示空白")
	}

	if w := graphEmptyElementWarning(1, nil); w != "" {
		t.Errorf("空内容不应提示，实际: %q", w)
	}
}

// 引用了 params_schema 里没定义的参数名时，画面上会原样显示 "$area_a"，必须提示。
func TestGraphUndefinedParamWarning(t *testing.T) {
	schema := map[string]model.ParamDef{"num_a": {Type: "range"}, "num_b": {Type: "range"}}

	ok := &model.ExperimentContent{
		ParamsSchema: schema,
		Graph:        json.RawMessage(`{"kind":"2d","elements":[{"type":"text","at":["$num_a / 2","-0.8"],"text":"a = $num_a"},{"type":"rect","at":[0,0],"w":"$num_b","h":1}]}`),
	}
	if w := graphUndefinedParamWarning(1, ok); w != "" {
		t.Errorf("全部参数都已定义时不应提示，实际: %q", w)
	}

	bad := &model.ExperimentContent{
		ParamsSchema: schema,
		Graph:        json.RawMessage(`{"kind":"2d","elements":[{"type":"text","at":[5,7],"text":"c = $sqrt_c  $area_a + $area_b = $area_c"}]}`),
	}
	w := graphUndefinedParamWarning(1, bad)
	if w == "" {
		t.Fatal("引用未定义参数时应提示")
	}
	for _, name := range []string{"$sqrt_c", "$area_a", "$area_c"} {
		if !strings.Contains(w, name) {
			t.Errorf("提示应点名 %s，实际: %q", name, w)
		}
	}
	if strings.Contains(w, "$num_a") {
		t.Errorf("已定义的参数不应出现在提示里，实际: %q", w)
	}

	if w := graphUndefinedParamWarning(1, nil); w != "" {
		t.Errorf("空内容不应提示，实际: %q", w)
	}
}

func TestJoinWarnings(t *testing.T) {
	cases := []struct {
		parts []string
		want  string
	}{
		{[]string{}, ""},
		{[]string{"", ""}, ""},
		{[]string{"", "b"}, "b"},
		{[]string{"a", ""}, "a"},
		{[]string{"a", "b"}, "a b"},
		{[]string{"a", "", "c"}, "a c"},
	}
	for _, c := range cases {
		if got := joinWarnings(c.parts...); got != c.want {
			t.Errorf("joinWarnings(%q) = %q, want %q", c.parts, got, c.want)
		}
	}
}
