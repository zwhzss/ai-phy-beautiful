package ai

import (
	"encoding/json"
	"strings"
	"testing"
)

// 模型在数值字段里裸写参数名/算式时，JSON 解析会报
// `invalid character 'm' in literal null (expecting 'l')`（num_ 的 n 被当成 null 开头）。
// 这类输出语义正确，补上引号即可 —— 前端会把带引号的字符串当表达式求值。
func TestRepairUnquotedIdentifiers(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		want    string
		changed bool
	}{
		{
			name:    "数组里的裸参数名",
			in:      `{"at": [num_focus_pos, 0]}`,
			want:    `{"at": ["num_focus_pos", 0]}`,
			changed: true,
		},
		{
			name:    "数组里的裸算式",
			in:      `{"from": [-8, num_focus_pos - num_p]}`,
			want:    `{"from": [-8, "num_focus_pos - num_p"]}`,
			changed: true,
		},
		{
			name:    "带尾随空白的裸算式",
			in:      "{\"at\": [num_focus_pos - num_p - 1, num_focus_pos - num_p]}",
			want:    `{"at": ["num_focus_pos - num_p - 1", "num_focus_pos - num_p"]}`,
			changed: true,
		},
		{
			name:    "对象值的裸参数名",
			in:      `{"r": num_a}`,
			want:    `{"r": "num_a"}`,
			changed: true,
		},
		{
			name:    "字符串内容不动",
			in:      `{"fn": "num_a * x", "text": "准线, num_p"}`,
			want:    `{"fn": "num_a * x", "text": "准线, num_p"}`,
			changed: false,
		},
		{
			name:    "true/false/null 保留",
			in:      `{"a": [true, false, null], "b": null}`,
			want:    `{"a": [true, false, null], "b": null}`,
			changed: false,
		},
		{
			name:    "合法 JSON 一字不改",
			in:      `{"at": ["$num_a", 0], "label": "焦点"}`,
			want:    `{"at": ["$num_a", 0], "label": "焦点"}`,
			changed: false,
		},
		{
			name:    "数字与字符串混合不受影响",
			in:      `{"type": "point", "at": [1.5, -2]}`,
			want:    `{"type": "point", "at": [1.5, -2]}`,
			changed: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, changed := repairUnquotedIdentifiers(tc.in)
			if got != tc.want {
				t.Errorf("repairUnquotedIdentifiers()\n  in   = %s\n  got  = %s\n  want = %s", tc.in, got, tc.want)
			}
			if changed != tc.changed {
				t.Errorf("changed = %v，期望 %v", changed, tc.changed)
			}
		})
	}
}

// 回归：真实模型输出（圆锥曲线统一定义）里的裸标识符写法应能解析成功，
// 且解析后数值字段里的表达式保留成字符串，交给前端求值。
func TestParseContentWithUnquotedIdentifiers(t *testing.T) {
	raw := `{
  "description": "本实验通过交互演示圆锥曲线的统一定义。",
  "formulas": [{"label": "统一定义", "latex": "\\frac{PF}{d(P, L)} = e"}],
  "params_schema": {
    "num_e": {"type": "range", "min": 0.1, "max": 2.5, "step": 0.05, "default": 1.0, "label": "离心率 e"},
    "num_p": {"type": "range", "min": 1, "max": 8, "step": 0.5, "default": 4, "label": "焦准距 p"},
    "num_focus_pos": {"type": "range", "min": -6, "max": 6, "step": 0.5, "default": 3, "label": "焦点横坐标"}
  },
  "graph": {
    "kind": "2d",
    "axes": {"x": [-8, 8], "y": [-8, 8]},
    "elements": [
      {"type": "point", "at": [num_focus_pos, 0], "color": "#ed8936", "label": "焦点"},
      {"type": "line", "from": [-8, num_focus_pos - num_p], "to": [8, num_focus_pos - num_p], "dash": true},
      {"type": "text", "at": [-7, num_focus_pos - num_p + 0.8], "text": "准线"},
      {"type": "rect", "at": [num_focus_pos - num_p - 1, num_focus_pos - num_p], "w": 2, "h": 1.5},
      {"type": "curve", "fn": "num_e * (num_focus_pos - num_p) + sqrt(num_e^2)", "fromX": -8, "toX": 8}
    ]
  },
  "narration": {
    "sections": [
      {"id": "intro", "title": "开场引入", "lines": [
        {"id": "intro-1", "text": "同学们好，今天我们来认识圆锥曲线。", "animation": {"action": "reset"}}
      ]}
    ]
  }
}`

	content, err := ParseContent(raw)
	if err != nil {
		t.Fatalf("应能解析成功，实际报错：%v", err)
	}
	if len(content.Narration.Sections) != 1 {
		t.Fatalf("讲解稿段落数 = %d，期望 1", len(content.Narration.Sections))
	}

	// 数值字段里的表达式应变成字符串
	var graph struct {
		Elements []map[string]any `json:"elements"`
	}
	if err := json.Unmarshal(content.Graph, &graph); err != nil {
		t.Fatalf("图形字段应为合法 JSON：%v", err)
	}
	at, ok := graph.Elements[0]["at"].([]any)
	if !ok || len(at) == 0 {
		t.Fatalf("第一个图元的 at 结构异常：%v", graph.Elements[0]["at"])
	}
	if got, _ := at[0].(string); got != "num_focus_pos" {
		t.Errorf("at[0] = %v，期望字符串 num_focus_pos", at[0])
	}
	from, ok := graph.Elements[1]["from"].([]any)
	if !ok || len(from) != 2 {
		t.Fatalf("第二个图元的 from 结构异常：%v", graph.Elements[1]["from"])
	}
	if got, _ := from[1].(string); !strings.Contains(got, "num_focus_pos - num_p") {
		t.Errorf("from[1] = %v，期望表达式字符串", from[1])
	}
	// 表达式字段（curve.fn）本来就是字符串，不应被二次加引号
	if fn, _ := graph.Elements[4]["fn"].(string); !strings.Contains(fn, "sqrt(num_e^2)") {
		t.Errorf("curve.fn 被破坏：%v", graph.Elements[4]["fn"])
	}
}
