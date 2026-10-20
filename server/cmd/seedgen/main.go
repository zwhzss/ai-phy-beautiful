// Command seedgen 从《架构设计.md》提取 375 个实验目录，生成种子数据 JSON。
//
// 用法（在 server 目录下执行）：
//
//	go run ./cmd/seedgen -doc ../架构设计.md -out internal/seed/data/experiments.json
//
// 生成结果被 internal/seed 包通过 go:embed 嵌入二进制，用于数据库初始化。
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

// categorySpec 描述架构文档中的一个实验分组（对应 categories 表一行）。
type categorySpec struct {
	Name  string
	Slug  string
	Level string
	Order int
}

// 分组定义与《架构设计.md》3.1/3.2 的层级完全一致：
// 基础篇 4 组 / 入门篇 5 组 / 中级篇 7 组 / 高级篇 8 组 / 专业篇 7 组。
var categorySpecs = []categorySpec{
	// 基础篇（小学）
	{"算术与数论基础", "arithmetic-number-theory", "basic", 1},
	{"几何图形与空间", "geometry-space", "basic", 2},
	{"分数、比例与统计入门", "fractions-proportion-statistics", "basic", 3},
	{"逻辑、规律与组合入门", "logic-patterns-combinatorics", "basic", 4},
	// 入门篇（初中）
	{"代数与方程", "algebra-equations", "intro", 5},
	{"函数与图像", "functions-graphs", "intro", 6},
	{"平面几何深化", "plane-geometry", "intro", 7},
	{"概率统计基础", "probability-statistics", "intro", 8},
	{"数据结构与算法初探", "algorithms-data-structures", "intro", 9},
	// 中级篇（高中）
	{"三角学与复数", "trigonometry-complex", "intermediate", 10},
	{"圆锥曲线与解析几何", "conic-analytic-geometry", "intermediate", 11},
	{"微积分初步", "calculus", "intermediate", 12},
	{"线性代数基础", "linear-algebra", "intermediate", 13},
	{"数列与级数", "sequences-series", "intermediate", 14},
	{"算法与数据结构深化", "algorithms-advanced", "intermediate", 15},
	{"概率统计深化", "probability-statistics-advanced", "intermediate", 16},
	// 高级篇（大学本科）
	{"数学分析深化", "mathematical-analysis", "advanced", 17},
	{"线性代数进阶", "linear-algebra-advanced", "advanced", 18},
	{"常微分方程与动力系统", "ode-dynamical-systems", "advanced", 19},
	{"数值计算与优化", "numerical-optimization", "advanced", 20},
	{"信号与傅里叶分析", "signal-fourier", "advanced", 21},
	{"机器学习数学基础", "machine-learning-math", "advanced", 22},
	{"图论与离散数学", "graph-discrete-math", "advanced", 23},
	{"密码学数学原理", "cryptography", "advanced", 24},
	// 专业篇（研究生+）
	{"微分几何与拓扑", "differential-geometry-topology", "professional", 25},
	{"混沌、分形与动力系统", "chaos-fractals", "professional", 26},
	{"随机过程与概率进阶", "stochastic-processes", "professional", 27},
	{"信息论与编码理论", "information-theory", "professional", 28},
	{"高级优化与数值方法", "optimization-numerical", "professional", 29},
	{"特殊曲面与几何", "special-surfaces", "professional", 30},
	{"物理应用与交叉领域", "physics-applications", "professional", 31},
}

// levelMeta 描述五个难度篇的 difficulty 与 level 标签。
var levelMeta = map[string]struct {
	Difficulty string
	Level      string
	Key        string
}{
	"基础篇": {"basic", "小学", "b"},
	"入门篇": {"intro", "初中", "i"},
	"中级篇": {"intermediate", "高中", "m"},
	"高级篇": {"advanced", "大学", "a"},
	"专业篇": {"professional", "研究生", "p"},
}

var (
	reLevel       = regexp.MustCompile(`^####\s*(基础篇|入门篇|中级篇|高级篇|专业篇)`)
	reSubsection  = regexp.MustCompile(`^\*\*(.+?)（\d+个）\*\*`)
	reHeading     = regexp.MustCompile(`^#{1,4}\s`)
	reNumberTitle = regexp.MustCompile(`^[A-Z]\d+$`)
)

// Catalog 是生成并嵌入的种子目录结构。
type Catalog struct {
	Categories  []CatalogCategory   `json:"categories"`
	Experiments []CatalogExperiment `json:"experiments"`
	Stats       map[string]int      `json:"stats"`
}

type CatalogCategory struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Level       string `json:"level"`
	OrderIndex  int    `json:"order_index"`
	Description string `json:"description"`
}

type CatalogExperiment struct {
	Number       string `json:"number"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	CategorySlug string `json:"category_slug"`
	Difficulty   string `json:"difficulty"`
	Level        string `json:"level"`
	Description  string `json:"description"`
	Concept      string `json:"concept"`
	VizComponent string `json:"viz_component"`
}

func main() {
	docPath := flag.String("doc", "../架构设计.md", "架构设计文档路径")
	outPath := flag.String("out", "internal/seed/data/experiments.json", "输出 JSON 路径")
	flag.Parse()

	raw, err := os.ReadFile(*docPath)
	if err != nil {
		fatalf("读取架构文档失败: %v", err)
	}
	catalog := extract(string(raw))

	data, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		fatalf("序列化失败: %v", err)
	}
	if err := os.MkdirAll(dirOf(*outPath), 0o755); err != nil {
		fatalf("创建输出目录失败: %v", err)
	}
	if err := os.WriteFile(*outPath, append(data, '\n'), 0o644); err != nil {
		fatalf("写入失败: %v", err)
	}

	fmt.Printf("已生成 %s\n", *outPath)
	fmt.Printf("分类 %d 个，实验 %d 个\n", len(catalog.Categories), len(catalog.Experiments))
	levels := make([]string, 0, len(catalog.Stats))
	for k := range catalog.Stats {
		levels = append(levels, k)
	}
	sort.Strings(levels)
	for _, k := range levels {
		fmt.Printf("  %-14s %d\n", k, catalog.Stats[k])
	}
}

// extract 解析 markdown 表格，得到分类与实验清单。
func extract(doc string) Catalog {
	byName := map[string]categorySpec{}
	for _, c := range categorySpecs {
		byName[c.Name] = c
	}

	catalog := Catalog{
		Categories:  make([]CatalogCategory, 0, len(categorySpecs)),
		Experiments: []CatalogExperiment{},
		Stats:       map[string]int{},
	}
	for _, c := range categorySpecs {
		catalog.Categories = append(catalog.Categories, CatalogCategory{
			Name:        c.Name,
			Slug:        c.Slug,
			Level:       c.Level,
			OrderIndex:  c.Order,
			Description: c.Name + "（" + c.Level + "）",
		})
	}

	usedSlug := map[string]int{}
	var (
		levelName string
		section   categorySpec
		haveSec   bool
	)

	for _, line := range strings.Split(doc, "\n") {
		trimmed := strings.TrimSpace(line)

		if m := reLevel.FindStringSubmatch(trimmed); m != nil {
			levelName = m[1]
			haveSec = false
			continue
		}
		if m := reSubsection.FindStringSubmatch(trimmed); m != nil {
			name := strings.TrimSpace(m[1])
			if spec, ok := byName[name]; ok {
				section = spec
				haveSec = true
			} else {
				haveSec = false
			}
			continue
		}
		if !haveSec || !strings.HasPrefix(trimmed, "|") {
			continue
		}

		cells := splitRow(trimmed)
		if len(cells) < 4 {
			continue
		}
		number := cells[0]
		if !reNumberTitle.MatchString(number) {
			continue // 表头或分隔行
		}
		title := cells[1]
		slug := normalizeSlug(cells[2])
		concept := cells[3]
		if slug == "" {
			slug = normalizeSlug(number)
		}

		meta := levelMeta[levelName]
		// slug 全库唯一：重复时追加编号后缀（如 calculus-m19 / calculus-a01）
		base := slug
		if n := usedSlug[base]; n > 0 {
			slug = fmt.Sprintf("%s-%s", base, strings.ToLower(number))
		}
		usedSlug[base]++

		catalog.Experiments = append(catalog.Experiments, CatalogExperiment{
			Number:       number,
			Title:        title,
			Slug:         slug,
			CategorySlug: section.Slug,
			Difficulty:   meta.Difficulty,
			Level:        meta.Level,
			Description:  fmt.Sprintf("%s：围绕「%s」展开的交互式可视化实验。", title, concept),
			Concept:      concept,
			VizComponent: pascalCase(slug) + "Viz",
		})
		catalog.Stats[levelName]++
	}

	return catalog
}

// splitRow 按 | 切分 markdown 表格行并去掉首尾空单元格。
func splitRow(line string) []string {
	parts := strings.Split(strings.Trim(line, "|"), "|")
	cells := make([]string, 0, len(parts))
	for _, p := range parts {
		cells = append(cells, strings.TrimSpace(p))
	}
	return cells
}

// normalizeSlug 清理 slug 文本：去掉括号备注、空格与非法字符。
func normalizeSlug(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.Trim(s, "()（）")
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")
	return s
}

// pascalCase 把 slug 转为大驼峰（用于 viz_component 命名：matrix-transform -> MatrixTransform）。
func pascalCase(slug string) string {
	var b strings.Builder
	for _, part := range strings.Split(slug, "-") {
		if part == "" {
			continue
		}
		b.WriteString(strings.ToUpper(part[:1]))
		b.WriteString(part[1:])
	}
	return b.String()
}

func dirOf(path string) string {
	if i := strings.LastIndexAny(path, `\/`); i >= 0 {
		return path[:i]
	}
	return "."
}

func fatalf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
