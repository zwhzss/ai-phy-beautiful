package main

import (
	"fmt"
	"os"

	"github.com/ai-phy-beautiful/server/internal/ai"
)

// 读取 stdin（或 argv[1] 文件）的模型原始输出，跑一遍 ParseContent 并报告修复链里
// 各候选的解析结果，用于定位「已自动尝试修复仍无法解析」的真实断点。
func main() {
	var raw []byte
	var err error
	if len(os.Args) > 1 {
		raw, err = os.ReadFile(os.Args[1])
	} else {
		raw, err = os.ReadFile("model_output.json")
	}
	if err != nil {
		fmt.Println("read error:", err)
		os.Exit(1)
	}

	content, perr := ai.ParseContent(string(raw))
	if perr != nil {
		fmt.Println("ParseContent FAILED:", perr)
		os.Exit(2)
	}
	fmt.Printf("ParseContent OK: description=%q formulas=%d sections=%d\n",
		content.Description, len(content.Formulas), len(content.Narration.Sections))
}
