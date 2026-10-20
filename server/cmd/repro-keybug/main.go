package main

import (
	"encoding/json"
	"fmt"

	"github.com/ai-phy-beautiful/server/internal/ai"
)

// 复现：模型在对象键位置裸写标识符（formulas 第 4 条的 "latex" 键丢了引号），
// 报 `invalid character 'l' looking for beginning of object key string`，
// 现有 repairUnquotedIdentifiers 只处理「值位置」，救不回来。
const raw = `{"description": "本实验演示若尔当-赫尔德定理。", "formulas": [{"label": "合成列", "latex": "1 = G_{0} \\triangleleft G_{1} = G"}, {"label": "合成因子为单群", "latex": "G_{i}/G_{i-1} \\text{ is simple}"}, {"label": "阶的乘积分解", "latex": "|G| = \\prod_{i=1}^{n} |G_{i}/G_{i-1}|"}, {"label": "唯一性陈述", latex: "(G_{i}/G_{i-1}) \\cong (H_{j}/H_{j-1}) \\text{ up to order}"}], "prerequisites": ["group-basics"], "narration": {"sections": [{"id": "intro", "title": "开场引入", "lines": [{"id": "intro-1", "text": "把有限群拆成单群。"}]}]}}`

func main() {
	var probe map[string]any
	err := json.Unmarshal([]byte(raw), &probe)
	fmt.Println("json.Unmarshal err:", err)

	content, perr := ai.ParseContent(raw)
	fmt.Println("ParseContent err:", perr)
	if content != nil {
		fmt.Printf("description=%q formulas=%d\n", content.Description, len(content.Formulas))
	}
}
