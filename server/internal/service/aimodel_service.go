package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/ai"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

// AIModelService 实现大模型配置的业务规则（需求 5）。
type AIModelService struct {
	repo *repository.AIModelRepo
}

func NewAIModelService() *AIModelService {
	return &AIModelService{repo: repository.NewAIModelRepo()}
}

// AIModelView 是返回给前端的大模型配置视图（API Key 脱敏）。
type AIModelView struct {
	ID           uint       `json:"id"`
	Name         string     `json:"name"`
	ModelType    string     `json:"model_type"`
	Provider     string     `json:"provider"`
	BaseURL      string     `json:"base_url"`
	ModelName    string     `json:"model_name"`
	Voice        string     `json:"voice"`
	Region       string     `json:"region"`
	ExtraConfig  string     `json:"extra_config"`
	IsActive     bool       `json:"is_active"`
	HasAPIKey    bool       `json:"has_api_key"`
	APIKeyMasked string     `json:"api_key_masked"`
	LastTestAt   *time.Time `json:"last_test_at"`
	LastTestOK   bool       `json:"last_test_ok"`
	LastTestMsg  string     `json:"last_test_msg"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// ToView 把实体转成脱敏视图。
func ToView(m *model.AIModel) AIModelView {
	return AIModelView{
		ID:           m.ID,
		Name:         m.Name,
		ModelType:    m.ModelType,
		Provider:     m.Provider,
		BaseURL:      m.BaseURL,
		ModelName:    m.ModelName,
		Voice:        m.Voice,
		Region:       m.Region,
		ExtraConfig:  m.ExtraConfig,
		IsActive:     m.IsActive,
		HasAPIKey:    m.APIKey != "",
		APIKeyMasked: MaskAPIKey(m.APIKey),
		LastTestAt:   m.LastTestAt,
		LastTestOK:   m.LastTestOK,
		LastTestMsg:  m.LastTestMsg,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
}

// MaskAPIKey 只保留首尾少量字符，避免密钥泄漏到前端。
func MaskAPIKey(key string) string {
	if key == "" {
		return ""
	}
	runes := []rune(key)
	if len(runes) <= 8 {
		return strings.Repeat("*", len(runes))
	}
	return string(runes[:4]) + strings.Repeat("*", 6) + string(runes[len(runes)-4:])
}

// List 返回大模型配置视图。
func (s *AIModelService) List(modelType string) ([]AIModelView, error) {
	if modelType != "" && !model.IsValidModelType(modelType) {
		return nil, fmt.Errorf("不支持的大模型类型: %s", modelType)
	}
	items, err := s.repo.List(modelType, nil)
	if err != nil {
		return nil, err
	}
	views := make([]AIModelView, 0, len(items))
	for i := range items {
		views = append(views, ToView(&items[i]))
	}
	return views, nil
}

// Create 新建配置；若该类型尚无激活配置，则自动激活。
func (s *AIModelService) Create(req *model.AIModel) (*model.AIModel, error) {
	normalize(req)
	if err := validate(req); err != nil {
		return nil, err
	}

	active, err := s.repo.GetActive(req.ModelType)
	if err != nil {
		return nil, err
	}
	if active == nil {
		req.IsActive = true
	} else {
		req.IsActive = false
	}

	if err := s.repo.Create(req); err != nil {
		return nil, err
	}
	return req, nil
}

// Update 编辑配置；请求中 api_key 为空表示保留原密钥，voice/model_name 等字段按需覆盖。
func (s *AIModelService) Update(id uint, req *model.AIModel) (*model.AIModel, error) {
	current, err := s.repo.Get(id)
	if err != nil {
		return nil, errors.New("大模型配置不存在")
	}

	if strings.TrimSpace(req.Name) != "" {
		current.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.ModelType) != "" {
		if !model.IsValidModelType(req.ModelType) {
			return nil, fmt.Errorf("不支持的大模型类型: %s", req.ModelType)
		}
		if req.ModelType != current.ModelType {
			// 类型变更视为重新归类，取消激活状态避免同类型出现两个激活项。
			current.IsActive = false
		}
		current.ModelType = req.ModelType
	}
	if strings.TrimSpace(req.Provider) != "" {
		current.Provider = req.Provider
	}
	current.BaseURL = req.BaseURL
	current.ModelName = req.ModelName
	current.Voice = req.Voice
	current.Region = req.Region
	if strings.TrimSpace(req.ExtraConfig) != "" {
		current.ExtraConfig = req.ExtraConfig
	}
	if strings.TrimSpace(req.APIKey) != "" {
		current.APIKey = strings.TrimSpace(req.APIKey)
	}

	normalize(current)
	if err := validate(current); err != nil {
		return nil, err
	}
	if err := s.repo.Save(current); err != nil {
		return nil, err
	}
	return current, nil
}

// Delete 删除配置。
func (s *AIModelService) Delete(id uint) error {
	if _, err := s.repo.Get(id); err != nil {
		return errors.New("大模型配置不存在")
	}
	return s.repo.Delete(id)
}

// Activate 激活配置（同类型互斥）。
func (s *AIModelService) Activate(id uint) (*model.AIModel, error) {
	item, err := s.repo.Get(id)
	if err != nil {
		return nil, errors.New("大模型配置不存在")
	}
	if err := s.repo.Activate(id, item.ModelType); err != nil {
		return nil, err
	}
	item.IsActive = true
	return item, nil
}

// Test 测试连接并记录测试结果。
func (s *AIModelService) Test(ctx context.Context, id uint) (string, error) {
	item, err := s.repo.Get(id)
	if err != nil {
		return "", errors.New("大模型配置不存在")
	}

	detail, testErr := ai.TestConnection(ctx, item)
	now := time.Now()
	item.LastTestAt = &now
	if testErr != nil {
		item.LastTestOK = false
		item.LastTestMsg = truncate(testErr.Error(), 480)
	} else {
		item.LastTestOK = true
		item.LastTestMsg = truncate(detail, 480)
	}
	if err := s.repo.Save(item); err != nil {
		return "", err
	}
	if testErr != nil {
		return "", testErr
	}
	return detail, nil
}

// GetActive 返回指定类型当前激活的配置。
func (s *AIModelService) GetActive(modelType string) (*model.AIModel, error) {
	return s.repo.GetActive(modelType)
}

// Stats 返回各类型配置数量。
func (s *AIModelService) Stats() (map[string]any, error) {
	counts, err := s.repo.CountByType()
	if err != nil {
		return nil, err
	}
	active := map[string]any{}
	for _, t := range model.ModelTypes() {
		item, err := s.repo.GetActive(t)
		if err != nil {
			return nil, err
		}
		if item != nil {
			active[t] = ToView(item)
		} else {
			active[t] = nil
		}
	}
	edgeOK, edgeHint := ai.EdgeAvailable()
	return map[string]any{
		"counts":             counts,
		"active":             active,
		"supported_types":    model.ModelTypes(),
		"edge_tts_available": edgeOK,
		"edge_tts_hint":      edgeHint,
	}, nil
}

// normalize 补齐默认值。
func normalize(m *model.AIModel) {
	m.Name = strings.TrimSpace(m.Name)
	m.ModelType = strings.ToLower(strings.TrimSpace(m.ModelType))
	m.Provider = strings.ToLower(strings.TrimSpace(m.Provider))
	m.BaseURL = strings.TrimRight(strings.TrimSpace(m.BaseURL), "/")
	m.ModelName = strings.TrimSpace(m.ModelName)
	m.APIKey = strings.TrimSpace(m.APIKey)
	m.Region = strings.TrimSpace(m.Region)
	m.Voice = strings.TrimSpace(m.Voice)
	if m.ExtraConfig == "" {
		m.ExtraConfig = "{}"
	}
	if m.Provider == "" {
		if m.ModelType == model.ModelTypeTTS {
			m.Provider = model.ProviderEdge
		} else {
			m.Provider = model.ProviderOpenAI
		}
	}
}

// validate 校验必填项。
func validate(m *model.AIModel) error {
	if m.Name == "" {
		return errors.New("配置名称不能为空")
	}
	if !model.IsValidModelType(m.ModelType) {
		return fmt.Errorf("大模型类型必须是 llm/tts/asr/image 之一，当前为 %q", m.ModelType)
	}

	switch m.Provider {
	case model.ProviderEdge:
		if m.ModelType != model.ModelTypeTTS {
			return errors.New("edge 仅适用于 TTS 类型")
		}
	case model.ProviderAzure:
		if m.ModelType == model.ModelTypeLLM && m.BaseURL == "" {
			return errors.New("Azure OpenAI 需要填写 BaseURL（如 https://<resource>.openai.azure.com）")
		}
	case model.ProviderAnthropic:
		if m.ModelType != model.ModelTypeLLM {
			return errors.New("anthropic 仅适用于 LLM 类型")
		}
	case model.ProviderOpenAI, model.ProviderCustom, "":
		if m.ModelType != model.ModelTypeTTS && m.BaseURL == "" && m.Provider != model.ProviderOpenAI {
			return errors.New("需要填写 BaseURL")
		}
		if m.ModelType == model.ModelTypeTTS && m.Provider == model.ProviderCustom && m.BaseURL == "" {
			return errors.New("自定义 TTS 需要填写 BaseURL")
		}
	default:
		return fmt.Errorf("不支持的服务商: %s", m.Provider)
	}

	if m.ModelType == model.ModelTypeLLM && m.ModelName == "" {
		return errors.New("LLM 需要填写模型名称，例如 deepseek-chat / qwen-plus / gpt-4o-mini")
	}
	return nil
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}
