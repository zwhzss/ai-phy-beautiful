// e2e-inject-ai 是**端到端验证用的临时工具**：把一份带动画的 AI 教学内容
// 写入指定数据库的 content_versions(source=ai) 并置为生效版本。
//
// 为什么需要它：验证"AI 版图形会不会动"必须让详情页真的走 AI 版分支
// （isAiSource → app-ai-graph-canvas），而这条路径只有存在生效的 AI 版内容时才会走到；
// 真实 LLM 生成不可复现，所以这里直接构造一份**符合提示词要求**的内容落库。
//
// ⚠ 只对**副本库**使用：DB_PATH 必须指向临时副本，绝不能指向生产库。
//
// 用法：go run ./cmd/e2e-inject-ai -db <副本库路径> -slug simple-pendulum
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	dbPath := flag.String("db", "", "副本数据库路径（必填；不要指生产库）")
	slug := flag.String("slug", "simple-pendulum", "要注入 AI 版内容的展项 slug")
	flag.Parse()
	if *dbPath == "" {
		log.Fatal("必须指定 -db（副本库路径）")
	}

	db, err := gorm.Open(sqlite.Open(*dbPath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}

	var exp model.Experiment
	if err := db.Where("slug = ?", *slug).First(&exp).Error; err != nil {
		log.Fatalf("找不到展项 %s: %v", *slug, err)
	}

	content := model.ExperimentContent{
		Description: "单摆的振动：摆角很小时周期只与摆长和重力加速度有关，与振幅无关（等时性）。这份内容是端到端验证用的示例，用于检查 AI 版图形会不会随时间演化。",
		Formulas: []model.FormulaItem{
			{Label: "小角近似下的单摆周期", Latex: "T = 2\\pi\\sqrt{\\frac{L}{g}}"},
			{Label: "回复力（切向分量）", Latex: "F = -mg\\sin\\theta \\approx -mg\\theta"},
		},
		HistoryInfo: model.HistoryInfo{
			Mathematician:   "伽利略（1564—1642）、惠更斯（1629—1695）",
			Background:      "16 世纪末，人们需要精确计时来支持航海与天文观测。伽利略据比萨大教堂吊灯摆动的观察提出单摆的等时性，惠更斯在 1656 年据此造出摆钟。",
			Story:           "伽利略用脉搏为吊灯计时，发现摆幅减小而周期几乎不变；惠更斯进一步把它做成可实用的摆钟，并研究摆线以求等时。",
			Legacy:          "摆钟让时间测量精度提高了两个数量级，为牛顿力学与天文导航提供了关键工具。无诺贝尔奖（该成果早于诺奖设立）。",
			OpenProblem:     "单摆本身早已解决；大摆角下的非线性修正有解析级数解，已不是未解之谜。",
			CrossDiscipline: "推动了精密机械制造、天文观测与后来的非线性动力学（混沌）研究。",
		},
		AppHooks: []model.AppHookItem{
			{Title: "摆钟与计时", Desc: "惠更斯摆钟把摆的等时性变成实用计时标准，沿用两百余年。"},
			{Title: "地震仪", Desc: "利用摆的惯性测量地面运动，是早期地震仪的核心原理。"},
			{Title: "重力勘探", Desc: "测得摆的周期即可反推当地重力加速度 g，用于找矿与地球物理测量。"},
		},
		ParamsSchema: map[string]model.ParamDef{
			"theta0": {Type: "range", Min: f(0.05), Max: f(0.6), Step: f(0.01), Default: 0.35, Label: "最大摆角（弧度）"},
			"length": {Type: "range", Min: f(0.5), Max: f(2), Step: f(0.05), Default: 1, Label: "摆长 L（米）"},
		},
		Graph: animatedPendulumGraph(),
		Narration: model.NarrationScript{Sections: []model.NarrationSection{
			{ID: "intro", Title: "开场引入", Lines: []model.NarrationLine{
				{ID: "intro-1", Text: "先看这段动画：摆球从一侧摆到另一侧，再摆回来。", Animation: &model.AnimationConfig{Action: "reset"}},
				{ID: "intro-2", Text: "注意摆球走得快的地方在中点，两端会慢下来。"},
			}},
		}},
	}

	raw, err := json.Marshal(content)
	if err != nil {
		log.Fatalf("序列化内容失败: %v", err)
	}

	// 真实切换版本时（ContentVersionService.applyContent）会把教学字段写进 experiments 行，
	// 详情接口返回的 graph / params_schema 就取自那里。这里必须做同样的事 ——
	// 只写 content_versions 的话 content_source 会是 ai、但 graph 仍是空，
	// 页面只会显示「AI 版暂无图形数据」，验证不到渲染路径。
	schema, err := json.Marshal(content.ParamsSchema)
	if err != nil {
		log.Fatalf("序列化参数失败: %v", err)
	}
	if err := db.Model(&model.Experiment{}).Where("id = ?", exp.ID).Updates(map[string]any{
		"content_status": "ready",
		"content_error":  "",
		"description":    content.Description,
		"graph":          string(content.Graph),
		"params_schema":  string(schema),
		"formulas":       mustJSON(content.Formulas),
		"history_info":   mustJSON(content.HistoryInfo),
		"app_hooks":      mustJSON(content.AppHooks),
	}).Error; err != nil {
		log.Fatalf("写入 experiments 教学字段失败: %v", err)
	}

	// 只有一个生效版本：先把该展项的所有版本置为非生效，再写入/更新 ai 版并置为生效。
	if err := db.Model(&model.ContentVersion{}).Where("experiment_id = ?", exp.ID).
		Update("is_active", false).Error; err != nil {
		log.Fatalf("重置生效标记失败: %v", err)
	}

	version := model.ContentVersion{ExperimentID: exp.ID, Source: "ai"}
	err = db.Where("experiment_id = ? AND source = ?", exp.ID, "ai").First(&version).Error
	version.Payload = string(raw)
	version.ModelName = "e2e-fixture"
	version.IsActive = true
	if err == gorm.ErrRecordNotFound {
		if err := db.Create(&version).Error; err != nil {
			log.Fatalf("写入 AI 版内容失败: %v", err)
		}
	} else if err != nil {
		log.Fatalf("查询 AI 版内容失败: %v", err)
	} else if err := db.Save(&version).Error; err != nil {
		log.Fatalf("更新 AI 版内容失败: %v", err)
	}

	fmt.Printf("已注入 AI 版动画内容：展项 #%d %s（%d 字节 payload）\n", exp.ID, exp.Slug, len(raw))
}

func f(v float64) *float64 { return &v }

// mustJSON 序列化（失败即中止：这是验证工具，宁可炸掉也不要写入半成品）。
func mustJSON(v any) string {
	raw, err := json.Marshal(v)
	if err != nil {
		log.Fatalf("序列化失败: %v", err)
	}
	return string(raw)
}

// animatedPendulumGraph 是**严格按提示词写法**构造的单摆演示图：
// 摆杆用含 t 的 line、摆球用含 t 的 point、轨迹用 motion 参数方程 + pingpong 往返。
func animatedPendulumGraph() json.RawMessage {
	return json.RawMessage(`{
  "kind": "2d",
  "axes": {"x": [-1.4, 1.4], "y": [-1.3, 0.4]},
  "animate": {"period": 3, "pingpong": true},
  "elements": [
    {"type": "line", "from": [0, 0], "to": [0, -1.4], "color": "#4a5568", "width": 1, "dash": true},
    {"type": "circle", "center": [0, 0], "r": 0.06, "fill": "#a0aec0", "color": "#a0aec0"},
    {"type": "line", "from": [0, 0], "to": ["sin(theta0*cos(t))", "-cos(theta0*cos(t))"], "color": "#f6ad55", "width": 3},
    {"type": "motion", "x": "sin(theta0*s)", "y": "-cos(theta0*s)", "sFrom": -1, "sTo": 1, "span": [0.2, 1], "trail": 0.35, "color": "rgba(237,137,54,0.55)", "size": 3},
    {"type": "point", "at": ["sin(theta0*cos(t))", "-cos(theta0*cos(t))"], "color": "#e53e3e", "size": 10, "label": "摆球"},
    {"type": "text", "at": [-1.15, 0.25], "text": "T = 2π√(L/g) = 2.0 s", "size": 13, "color": "#e2e8f0"},
    {"type": "text", "at": [1.05, 0.25], "text": "t = $t s", "size": 13, "color": "#90cdf4"}
  ]
}`)
}
