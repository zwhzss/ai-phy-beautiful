package service

import (
	"encoding/json"
	"errors"

	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

// NarrationService 提供讲解稿件的读取能力。
type NarrationService struct {
	repo    *repository.NarrationRepo
	expRepo *repository.ExperimentRepo
}

func NewNarrationService() *NarrationService {
	return &NarrationService{
		repo:    repository.NewNarrationRepo(),
		expRepo: repository.NewExperimentRepo(),
	}
}

func (s *NarrationService) ListByExperiment(experimentID uint) ([]model.Narration, error) {
	return s.repo.ListByExperiment(experimentID)
}

func (s *NarrationService) GetByExperimentAndLine(experimentID uint, lineID string) (*model.Narration, error) {
	return s.repo.GetByExperimentAndLine(experimentID, lineID)
}

// ScriptLine 是返回给前端的讲解行。
type ScriptLine struct {
	ID            uint           `json:"id"`
	SectionID     string         `json:"section_id"`
	LineID        string         `json:"line_id"`
	LineIndex     int            `json:"line_index"`
	Text          string         `json:"text"`
	AudioYunxi    string         `json:"audio_yunxi"`
	AudioXiaoxiao string         `json:"audio_xiaoxiao"`
	DurationMs    int            `json:"duration_ms"`
	Animation     map[string]any `json:"animation"`
}

// ScriptSection 是讲解段落（PPT 式章节）。
type ScriptSection struct {
	ID    string       `json:"id"`
	Title string       `json:"title"`
	Lines []ScriptLine `json:"lines"`
}

// Script 是完整的讲解稿件。
type Script struct {
	ExperimentID uint            `json:"experiment_id"`
	Slug         string          `json:"slug"`
	Title        string          `json:"title"`
	TotalLines   int             `json:"total_lines"`
	TotalMs      int             `json:"total_duration_ms"`
	HasAudio     bool            `json:"has_audio"`
	Sections     []ScriptSection `json:"sections"`
}

// GetScriptBySlug 按实验 slug 组装讲解稿件；没有稿件时返回空结构而不是错误，
// 便于前端提示"该实验尚未生成讲解"。
func (s *NarrationService) GetScriptBySlug(slug string) (*Script, error) {
	exp, err := s.expRepo.GetBySlug(slug)
	if err != nil {
		return nil, errors.New("实验不存在")
	}
	narrations, err := s.repo.ListByExperiment(exp.ID)
	if err != nil {
		return nil, err
	}

	script := &Script{
		ExperimentID: exp.ID,
		Slug:         exp.Slug,
		Title:        exp.Title,
		Sections:     []ScriptSection{},
	}

	indexBySection := map[string]int{}
	for _, n := range narrations {
		pos, ok := indexBySection[n.SectionID]
		if !ok {
			title := n.SectionTitle
			if title == "" {
				title = sectionTitleFallback(n.SectionID)
			}
			script.Sections = append(script.Sections, ScriptSection{
				ID:    n.SectionID,
				Title: title,
				Lines: []ScriptLine{},
			})
			pos = len(script.Sections) - 1
			indexBySection[n.SectionID] = pos
		}
		line := ScriptLine{
			ID:            n.ID,
			SectionID:     n.SectionID,
			LineID:        n.LineID,
			LineIndex:     n.LineIndex,
			Text:          n.Text,
			AudioYunxi:    n.AudioYunxi,
			AudioXiaoxiao: n.AudioXiaoxiao,
			DurationMs:    n.DurationMs,
			Animation:     map[string]any{},
		}
		if n.AnimationCfg != "" && n.AnimationCfg != "{}" {
			var anim map[string]any
			if json.Unmarshal([]byte(n.AnimationCfg), &anim) == nil {
				line.Animation = anim
			}
		}
		if n.AudioYunxi != "" || n.AudioXiaoxiao != "" {
			script.HasAudio = true
		}
		script.TotalMs += n.DurationMs
		script.TotalLines++
		script.Sections[pos].Lines = append(script.Sections[pos].Lines, line)
	}

	return script, nil
}

// sectionTitleFallback 为缺失标题的段落提供中文默认名。
func sectionTitleFallback(id string) string {
	switch id {
	case "intro":
		return "开场引入"
	case "concept":
		return "核心概念"
	case "formula":
		return "公式与推导"
	case "application":
		return "现实应用"
	case "history":
		return "历史背景"
	case "summary":
		return "总结回顾"
	default:
		return id
	}
}
