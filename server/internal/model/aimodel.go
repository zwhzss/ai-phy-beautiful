package model

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// AI 大模型类型（需求 5：LLM、TTS、ASR、图像，相同类型只能激活一个）
const (
	ModelTypeLLM   = "llm"
	ModelTypeTTS   = "tts"
	ModelTypeASR   = "asr"
	ModelTypeImage = "image"
)

// ModelTypes 返回全部受支持的大模型类型。
func ModelTypes() []string {
	return []string{ModelTypeLLM, ModelTypeTTS, ModelTypeASR, ModelTypeImage}
}

// IsValidModelType 校验类型是否受支持。
func IsValidModelType(t string) bool {
	for _, v := range ModelTypes() {
		if v == t {
			return true
		}
	}
	return false
}

// AI 服务商标识。TTS 额外支持 edge（Edge TTS 免费合成）。
const (
	ProviderOpenAI    = "openai"    // OpenAI 兼容协议（deepseek/dashscope/ollama/vllm 等）
	ProviderAzure     = "azure"     // Azure OpenAI / Azure Speech
	ProviderAnthropic = "anthropic" // Anthropic Messages API
	ProviderEdge      = "edge"      // Edge TTS（本地 edge-tts 命令）
	ProviderCustom    = "custom"    // 自定义 HTTP 接口
)

// AIModel 表示一条大模型接入配置。
type AIModel struct {
	gorm.Model
	Name        string     `gorm:"size:100;not null" json:"name"`
	ModelType   string     `gorm:"size:20;not null;index" json:"model_type"`
	Provider    string     `gorm:"size:30;not null;default:'openai'" json:"provider"`
	BaseURL     string     `gorm:"size:500" json:"base_url"`
	APIKey      string     `gorm:"size:512" json:"api_key,omitempty"`
	ModelName   string     `gorm:"size:200" json:"model_name"`
	Voice       string     `gorm:"size:100" json:"voice"`
	Region      string     `gorm:"size:50" json:"region"` // Azure 区域
	ExtraConfig string     `gorm:"type:text;default:'{}'" json:"extra_config"`
	IsActive    bool       `gorm:"default:false;index" json:"is_active"`
	LastTestAt  *time.Time `json:"last_test_at"`
	LastTestOK  bool       `gorm:"default:false" json:"last_test_ok"`
	LastTestMsg string     `gorm:"size:500" json:"last_test_msg"`
}

// ExperimentContent 是 AI 生成的教学内容（需求 4）。
// 结构同时用于 LLM 返回解析与内容落库。
type ExperimentContent struct {
	Description   string              `json:"description"`
	Formulas      []FormulaItem       `json:"formulas"`
	HistoryInfo   HistoryInfo         `json:"history_info"`
	AppHooks      []AppHookItem       `json:"app_hooks"`
	ParamsSchema  map[string]ParamDef `json:"params_schema"`
	// Graph 是 AI 生成的图形描述（2D 图元或 3D 曲面），前端用通用渲染器绘制。
	// 设计为 json.RawMessage，避免为每种图元建结构体。
	Graph json.RawMessage `json:"graph,omitempty"`
	Prerequisites []string            `json:"prerequisites"`
	Related       []string            `json:"related"`
	Narration     NarrationScript     `json:"narration"`
}

// FormulaItem 表示一条数学公式。
type FormulaItem struct {
	Label string `json:"label"`
	Latex string `json:"latex"`
}

// HistoryInfo 表示历史背景信息。
type HistoryInfo struct {
	Mathematician string `json:"mathematician"`
	Background    string `json:"background"`
	Story         string `json:"story"`
	// Legacy 记录该成果对科技/文明的影响与所获荣誉（无则写「无」）。
	Legacy string `json:"legacy"`
	// OpenProblem 说明它是否仍是未解之谜（已解决则写明由谁在何时解决）。
	OpenProblem string `json:"open_problem"`
	// CrossDiscipline 说明它对物理、化学、生物、计算机等其他学科的推动。
	CrossDiscipline string `json:"cross_discipline"`
}

// AppHookItem 表示一条现实应用。
type AppHookItem struct {
	Title string `json:"title"`
	Desc  string `json:"desc"`
}

// ParamDef 描述一个可交互参数。
type ParamDef struct {
	Type    string   `json:"type"`
	Min     *float64 `json:"min,omitempty"`
	Max     *float64 `json:"max,omitempty"`
	Step    *float64 `json:"step,omitempty"`
	Default any      `json:"default,omitempty"`
	Options []string `json:"options,omitempty"`
	Label   string   `json:"label,omitempty"`
}

// NarrationScript 是讲解稿件（段落 → 行）。
type NarrationScript struct {
	Sections []NarrationSection `json:"sections"`
}

// NarrationSection 是讲解段落。
type NarrationSection struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Lines []NarrationLine `json:"lines"`
}

// NarrationLine 是讲解中的一行台词及其触发的动画。
type NarrationLine struct {
	ID        string           `json:"id"`
	Text      string           `json:"text"`
	Animation *AnimationConfig `json:"animation,omitempty"`
}

// AnimationConfig 描述讲解时对可视化触发的动作。
type AnimationConfig struct {
	Action string         `json:"action"`
	Params map[string]any `json:"params,omitempty"`
	Delay  int            `json:"delay,omitempty"`
}
