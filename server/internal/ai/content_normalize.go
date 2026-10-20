package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

// repairUnescapedQuotes 修复字符串内部未转义的英文双引号与裸控制字符。
//
// 中文表达能力强的模型爱在 JSON 字符串里用英文双引号强调，例如：
//
//	"text": "核心规则是"加法原则"：…"
//
// 这会让字符串提前闭合、整份 JSON 断裂（报错形如
// invalid character 'å' after object key:value pair —— 后面的中文字节被当成结构字符）。
//
// 判定规则（只在字符串内部生效）：遇到 " 时向后跳过空白看下一个字符 ——
// 若是 : , } ] 或已到结尾，说明它是字符串的结束引号；否则是内容里的引号，转义成 \"。
// 字符串内的裸换行/制表符也一并转义。
//
// 对本来就合法的 JSON 不会有任何改动：合法 JSON 的字符串里不可能出现裸引号或裸换行。
func repairUnescapedQuotes(s string) (string, bool) {
	out := make([]byte, 0, len(s)+16)
	inStr := false
	escaped := false
	changed := false

	for i := 0; i < len(s); i++ {
		c := s[i]

		if !inStr {
			if c == '"' {
				inStr = true
			}
			out = append(out, c)
			continue
		}

		if escaped {
			escaped = false
			out = append(out, c)
			continue
		}

		switch c {
		case '\\':
			escaped = true
			out = append(out, c)
		case '"':
			j := i + 1
			for j < len(s) && (s[j] == ' ' || s[j] == '\t' || s[j] == '\r' || s[j] == '\n') {
				j++
			}
			if j >= len(s) || s[j] == ':' || s[j] == ',' || s[j] == '}' || s[j] == ']' {
				inStr = false
				out = append(out, c)
				continue
			}
			out = append(out, '\\', '"') // 内容里的引号：转义掉
			changed = true
		case '\n':
			out = append(out, '\\', 'n')
			changed = true
		case '\r':
			out = append(out, '\\', 'r')
			changed = true
		case '\t':
			out = append(out, '\\', 't')
			changed = true
		default:
			out = append(out, c)
		}
	}

	if !changed {
		return s, false
	}
	return string(out), true
}

// repairJSONSyntax 修复大模型常见的 JSON「符号级」错误，只动结构符号、不改内容：
//
//   - 括号配对写错（例如对象用 "]" 收尾）：按括号栈把收尾符号纠正成应有的那个；
//   - 尾随逗号（{"a":1,} / [1,2,]）：删除；
//   - 字符串外的行注释 // 与块注释 /* */：删除（字符串内的 // 不受影响，如 URL）。
//
// 返回修复后的文本与是否发生过改动；无改动时 ok=false。
func repairJSONSyntax(s string) (string, bool) {
	out := make([]byte, 0, len(s)+16)
	stack := make([]byte, 0, 16) // 待闭合的符号（'{' 记 '}'，'[' 记 ']'）
	changed := false
	inStr := false
	escaped := false

	skipSpace := func(i int) int {
		for i < len(s) && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n') {
			i++
		}
		return i
	}

	for i := 0; i < len(s); i++ {
		c := s[i]

		if inStr {
			out = append(out, c)
			switch {
			case escaped:
				escaped = false
			case c == '\\':
				escaped = true
			case c == '"':
				inStr = false
			}
			continue
		}

		switch c {
		case '"':
			inStr = true
			out = append(out, c)
		case '{':
			stack = append(stack, '}')
			out = append(out, c)
		case '[':
			stack = append(stack, ']')
			out = append(out, c)
		case '}', ']':
			if n := len(stack); n > 0 {
				if want := stack[n-1]; want != c {
					c = want // 配对写错：按上下文纠正收尾符号
					changed = true
				}
				stack = stack[:n-1]
			}
			out = append(out, c)
		case ',':
			// 尾随逗号：后面直接跟闭合符号时删掉
			if j := skipSpace(i + 1); j < len(s) && (s[j] == '}' || s[j] == ']') {
				changed = true
				continue
			}
			out = append(out, c)
		case '/':
			if i+1 < len(s) && s[i+1] == '/' {
				// 行注释：保留换行，避免前后 token 粘连
				j := i + 2
				for j < len(s) && s[j] != '\n' {
					j++
				}
				i = j - 1
				changed = true
				continue
			}
			if i+1 < len(s) && s[i+1] == '*' {
				j := i + 2
				for j+1 < len(s) && !(s[j] == '*' && s[j+1] == '/') {
					j++
				}
				i = j + 1
				changed = true
				continue
			}
			out = append(out, c)
		default:
			out = append(out, c)
		}
	}

	if !changed {
		return s, false
	}
	return string(out), true
}

// 大模型偶尔不遵守 contentSchemaHint 给出的形态，把本该是对象的字段写成别的类型。
// 这些偏差语义明确、可以无损还原，所以在解析层统一兜底，而不是直接判失败：
//
//   - params_schema 被写成数组（元素含 parameter_name / name）→ 归一化为 {参数名: 定义}；
//   - narration.sections[].lines[].animation 被写成字符串 → 归一化为 {"action": 字符串}；
//   - graph 被写成「JSON 字符串」（双重编码）→ 还原为对象。
//
// 返回 false 表示没有任何需要修正的地方，调用方应直接按原文解析。
func normalizeContentJSON(text string) (string, bool) {
	dec := json.NewDecoder(strings.NewReader(text))
	// UseNumber 保留数字原文，避免重新序列化时把 0.1 变成 0.10000000000000001。
	dec.UseNumber()

	var root any
	if err := dec.Decode(&root); err != nil {
		return "", false
	}
	obj, ok := root.(map[string]any)
	if !ok {
		return "", false
	}

	changed := false

	if v, exists := obj["params_schema"]; exists {
		if m, ok := paramsSchemaToMap(v); ok {
			obj["params_schema"] = m
			changed = true
		}
	}

	changed = normalizeNarrationAnimations(obj["narration"]) || changed

	if g, ok := obj["graph"].(string); ok {
		if sub := decodeJSONObject(g); sub != nil {
			obj["graph"] = sub
			changed = true
		}
	}

	if !changed {
		return "", false
	}
	out, err := json.Marshal(obj)
	if err != nil {
		return "", false
	}
	return string(out), true
}

// paramsSchemaToMap 把数组形式的 params_schema 归一化为「参数名 → 参数定义」的对象。
// 已经是对象时返回 changed=false（无需修正）。
func paramsSchemaToMap(v any) (map[string]any, bool) {
	switch typed := v.(type) {
	case map[string]any:
		return typed, false
	case []any:
		out := make(map[string]any, len(typed))
		for i, item := range typed {
			def, ok := item.(map[string]any)
			if !ok {
				// 元素不是对象，无法还原成参数定义，跳过。
				continue
			}
			name, def := paramNameAndDef(def, i)
			out[name] = def
		}
		return out, true
	default:
		return nil, false
	}
}

// paramNameAndDef 从数组元素里取出参数名与参数定义。
// 支持 {"parameter_name": "num_a", ...}、{"name": "num_a", ...}
// 以及 {"num_a": {...定义...}} 这两种常见写法。
func paramNameAndDef(def map[string]any, index int) (string, map[string]any) {
	for _, key := range []string{"parameter_name", "name", "key", "id"} {
		if s, ok := def[key].(string); ok && strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s), def
		}
	}
	// 单键包裹：{"num_a": {"type": "range", ...}}
	if len(def) == 1 {
		for k, v := range def {
			if inner, ok := v.(map[string]any); ok {
				return k, inner
			}
		}
	}
	return fmt.Sprintf("param_%d", index+1), def
}

// normalizeNarrationAnimations 把字符串形式的 animation 归一化为 {"action": ...}。
func normalizeNarrationAnimations(narration any) bool {
	n, ok := narration.(map[string]any)
	if !ok {
		return false
	}
	sections, ok := n["sections"].([]any)
	if !ok {
		return false
	}
	changed := false
	for _, s := range sections {
		section, ok := s.(map[string]any)
		if !ok {
			continue
		}
		lines, ok := section["lines"].([]any)
		if !ok {
			continue
		}
		for _, l := range lines {
			line, ok := l.(map[string]any)
			if !ok {
				continue
			}
			action, ok := line["animation"].(string)
			if !ok {
				continue
			}
			line["animation"] = map[string]any{"action": strings.TrimSpace(action)}
			changed = true
		}
	}
	return changed
}

// decodeJSONObject 尝试把字符串解析成 JSON 对象，失败返回 nil。
func decodeJSONObject(s string) map[string]any {
	trimmed := strings.TrimSpace(s)
	if !strings.HasPrefix(trimmed, "{") {
		return nil
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(trimmed), &out); err != nil {
		return nil
	}
	return out
}

// repairUnquotedIdentifiers 给「值位置」上裸写的标识符/算式补上引号。
//
// 模型经常在 graph 的数值字段里直接写参数名或算式：
//
//	"at": [num_focus_pos, 0]
//	"from": [-8, num_focus_pos - num_p]
//
// 这不是合法 JSON —— 解析器读到 num_ 的 n 会当成 null 字面量开始，读到 u、l 之后
// 遇到 m 就报 `invalid character 'm' in literal null (expecting 'l')`，
// 整份教学内容作废。而语义上它是对的：前端会把带引号的字符串当表达式求值
//（渲染器既认 "$参数名"，也认整串算式），所以补引号即可。
//
// 只在字符串之外、且处于「值位置」（紧跟 : [ , 之后的第一个 token）时处理；
// true / false / null 原样保留。合法 JSON 不会被改动。
func repairUnquotedIdentifiers(s string) (string, bool) {
	out := make([]byte, 0, len(s)+32)
	inStr := false
	escaped := false
	valuePos := false
	changed := false

	for i := 0; i < len(s); {
		c := s[i]

		if inStr {
			out = append(out, c)
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == '"' {
				inStr = false
			}
			i++
			continue
		}

		switch {
		case c == '"':
			inStr = true
			out = append(out, c)
			i++
			valuePos = false // 字符串结束之后要等 : 或 , 才是下一个值位置
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			out = append(out, c)
			i++
		case c == ':' || c == '[' || c == ',':
			out = append(out, c)
			i++
			valuePos = true // 这些符号后面的第一个 token 是值
		case c == ']' || c == '}':
			out = append(out, c)
			i++
			valuePos = false
		case valuePos && isExprIdentStart(c):
			j := i
			for j < len(s) && isExprTokenChar(s[j]) {
				j++
			}
			// 去掉尾部空白，空白原样写回（保持排版）
			token := s[i:j]
			trimmed := strings.TrimRight(token, " \t\r\n")
			rest := token[len(trimmed):]
			switch trimmed {
			case "true", "false", "null":
				out = append(out, trimmed...)
			default:
				out = append(out, '"')
				out = append(out, trimmed...)
				out = append(out, '"')
				changed = true
			}
			out = append(out, rest...)
			i = j
			valuePos = false
		default:
			out = append(out, c)
			i++
			valuePos = false
		}
	}

	if !changed {
		return s, false
	}
	return string(out), true
}

// isExprIdentStart 判断字符能否作为「裸标识符表达式」的开头（参数名、$参数名）。
func isExprIdentStart(c byte) bool {
	return c == '_' || c == '$' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// isExprTokenChar 判断字符是否属于裸表达式（标识符、数字、运算符、括号、点、空格）。
//
// 逗号与方括号不在其中，所以表达式会在 "," 或 "]" 处自然结束。
func isExprTokenChar(c byte) bool {
	switch {
	case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		return true
	}
	switch c {
	case '_', '$', '.', '+', '-', '*', '/', '^', '(', ')', '%', ' ', '\t', '\n', '\r':
		return true
	}
	return false
}
