package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"go.uber.org/zap"
	"time"

	"github.com/ai-phy-beautiful/server/internal/ai"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

// DefaultMaxTokens 是生成教学内容时的默认最大输出 token 数。
//
// 该值必须保守！它会与 prompt 长度一起占用「上下文窗口」：
//
//	实际占用 = prompt_tokens + max_tokens
//
// 一旦超出 llama.cpp 启动时的 -c（n_ctx_slot），KV cache 就会越界，
// 表现为 CUDA illegal memory access -> GPU 上下文损毁 -> 整机卡死。
// 此前误设为 65536，配合 -c 65536 的服务端（12575+65536 > 65536）必然崩溃。
// 教学内容（正文+公式+图形 JSON）通常远小于 8K，取 8192 足够且安全。
const DefaultMaxTokens = 8192

// MaxTokensUpperBound 是前台可设置的上限，同样必须保守：
// 即使服务端把 -c 开得很大，也不该让用户填出会顶穿常见 n_ctx 的值
// （本地部署普遍在 8K~32K 之间）。
const MaxTokensUpperBound = 16384

// resolveMaxTokens 归一化 max_tokens：未设置（<=0）时用默认值，超上限则截到上限。
func resolveMaxTokens(v int) int {
	if v <= 0 {
		return DefaultMaxTokens
	}
	if v > MaxTokensUpperBound {
		return MaxTokensUpperBound
	}
	return v
}

// ContentService 负责"AI 生成教学内容 + 语音合成"这条内容生产流水线（需求 4、6）。
type ContentService struct {
	// versionSvc 把生成结果与种子基线存档为「版本」，实现种子版与 AI 版共存。
	versionSvc *ContentVersionService
	expRepo    *repository.ExperimentRepo
	narrRepo   *repository.NarrationRepo
	aiSvc      *AIModelService
	audioDir   string
}

func NewContentService(aiSvc *AIModelService, audioDir string) *ContentService {
	return &ContentService{
		expRepo:    repository.NewExperimentRepo(),
		narrRepo:   repository.NewNarrationRepo(),
		aiSvc:      aiSvc,
		audioDir:   audioDir,
		versionSvc: NewContentVersionService(),
	}
}

// GenerateResult 描述一次内容生成的结果。
type GenerateResult struct {
	ExperimentID uint   `json:"experiment_id"`
	Slug         string `json:"slug"`
	Title        string `json:"title"`
	Status       string `json:"status"`
	Sections     int    `json:"sections"`
	Lines        int    `json:"lines"`
	Formulas     int    `json:"formulas"`
	AppHooks     int    `json:"app_hooks"`
	Message      string `json:"message,omitempty"`
	// Warning 记录「生成成功但质量有问题」的提示，例如图形没有与参数联动。
	Warning string `json:"warning,omitempty"`
}

// SynthResult 描述一个实验某个音色的合成结果。
type SynthResult struct {
	ExperimentID uint     `json:"experiment_id"`
	Voice        string   `json:"voice"`
	Synthesized  int      `json:"synthesized"`
	Skipped      int      `json:"skipped"`
	Failed       int      `json:"failed"`
	TotalMs      int      `json:"total_duration_ms"`
	Errors       []string `json:"errors,omitempty"`
}

// BatchSummary 汇总批量任务结果。
type BatchSummary struct {
	Total     int              `json:"total"`
	Succeeded int              `json:"succeeded"`
	Failed    int              `json:"failed"`
	Results   []GenerateResult `json:"results"`
}

// GenerateForExperiment 为一个实验生成完整教学内容（图文/公式/历史/应用/参数/讲解稿件）。
func (s *ContentService) GenerateForExperiment(ctx context.Context, experimentID uint) (*GenerateResult, error) {
	exp, err := s.expRepo.GetByID(experimentID)
	if err != nil {
		return nil, errors.New("实验不存在")
	}

	llm, err := s.aiSvc.GetActive(model.ModelTypeLLM)
	if err != nil {
		return nil, err
	}
	if llm == nil {
		return nil, errors.New("尚未激活 LLM 大模型，请先在「管理后台 → 大模型配置」中添加并激活")
	}

	if err := s.expRepo.UpdateFields(exp.ID, map[string]any{
		"content_status": "generating",
		"content_error":  "",
	}); err != nil {
		return nil, err
	}

	categoryName := ""
	if exp.Category != nil {
		categoryName = exp.Category.Name
	}

	prompt := ai.BuildContentPrompt(exp, categoryName)
	raw, chatErr := ai.Chat(ctx, llm, ai.ChatRequest{
		System:      ai.SystemPrompt,
		User:        prompt,
		Temperature: 0.7,
		MaxTokens:   DefaultMaxTokens,
		JSONMode:    true,
	})
	if chatErr != nil && strings.Contains(chatErr.Error(), "response_format") {
		// 部分厂商不支持 JSON mode，降级重试一次。
		raw, chatErr = ai.Chat(ctx, llm, ai.ChatRequest{
			System:      ai.SystemPrompt,
			User:        prompt,
			Temperature: 0.7,
			MaxTokens:   DefaultMaxTokens,
		})
	}
	if chatErr != nil {
		s.markFailed(exp.ID, chatErr)
		return nil, chatErr
	}

	if strings.TrimSpace(raw) == "" {
		emptyErr := emptyCompletionError()
		s.markFailed(exp.ID, emptyErr)
		return nil, emptyErr
	}
	content, parseErr := ai.ParseContent(raw)
	if parseErr != nil {
		s.markFailed(exp.ID, parseErr)
		return nil, wrapParseError(parseErr, raw)
	}
	lines, sections, warning, applyErr := s.applyGeneratedContent(exp, content, llm.ModelName)
	if applyErr != nil {
		s.markFailed(exp.ID, applyErr)
		return nil, applyErr
	}

	result := &GenerateResult{
		ExperimentID: exp.ID,
		Slug:         exp.Slug,
		Title:        exp.Title,
		Status:       "ready",
		Sections:     sections,
		Lines:        lines,
		Formulas:     len(content.Formulas),
		AppHooks:     len(content.AppHooks),
		Warning:      warning,
	}
	return result, nil
}

// persistContent 把生成结果写库（实验字段 + 讲解稿件）。
func (s *ContentService) persistContent(exp *model.Experiment, content *model.ExperimentContent) (int, int, error) {
	now := time.Now()
	fields := map[string]any{
		"content_status": "ready",
		"content_error":  "",
		"generated_at":   now,
	}

	// 无条件写入：新内容若没有简介，必须清掉上一次生成的值（同类残留问题）。
	fields["description"] = strings.TrimSpace(content.Description)
	if v, err := marshalJSON(content.Formulas, "[]"); err == nil {
		fields["formulas"] = v
	}
	if v, err := marshalJSON(content.HistoryInfo, "{}"); err == nil {
		fields["history_info"] = v
	}
	if v, err := marshalJSON(content.AppHooks, "[]"); err == nil {
		fields["app_hooks"] = v
	}
	// 重新生成时完全覆盖这两个字段：新内容若没有图形/参数，
	// 必须清掉上一次生成的值，否则旧 AI 图形会残留并在详情页遮挡种子渲染器。
	fields["params_schema"] = "{}"
	if len(content.ParamsSchema) > 0 {
		if v, err := marshalJSON(content.ParamsSchema, "{}"); err == nil {
			fields["params_schema"] = v
		}
	}
	fields["graph"] = ""
	if len(content.Graph) > 0 {
		fields["graph"] = string(content.Graph)
	}
	if v, err := marshalJSON(content.Prerequisites, "[]"); err == nil {
		fields["prerequisites"] = v
	}
	if v, err := marshalJSON(content.Related, "[]"); err == nil {
		fields["related_experiments"] = v
	}

	if err := s.expRepo.UpdateFields(exp.ID, fields); err != nil {
		return 0, 0, err
	}

	// 讲解稿件：按段落顺序展平为行。
	rows := make([]model.Narration, 0, 32)
	index := 0
	for si, section := range content.Narration.Sections {
		sectionID := strings.TrimSpace(section.ID)
		if sectionID == "" {
			sectionID = fmt.Sprintf("section-%d", si+1)
		}
		for li, line := range section.Lines {
			text := strings.TrimSpace(line.Text)
			if text == "" {
				continue
			}
			lineID := strings.TrimSpace(line.ID)
			if lineID == "" {
				lineID = fmt.Sprintf("%s-%d", sectionID, li+1)
			}
			anim := "{}"
			if line.Animation != nil {
				if v, err := json.Marshal(line.Animation); err == nil {
					anim = string(v)
				}
			} else if section.Title != "" {
				anim = fmt.Sprintf(`{"action":"highlight","params":{"section":%q}}`, section.Title)
			}
			rows = append(rows, model.Narration{
				SectionID:    sectionID,
				SectionTitle: section.Title,
				LineIndex:    index,
				LineID:       lineID,
				Text:         text,
				AnimationCfg: anim,
			})
			index++
		}
	}

	// 无条件替换：ReplaceForExperiment 会先清空该实验的旧讲解稿行，
	// 避免重新生成后行数变少时残留旧行（会导致文稿与音频错配）。
	if err := s.narrRepo.ReplaceForExperiment(exp.ID, rows); err != nil {
		return 0, 0, err
	}
	return len(rows), len(content.Narration.Sections), nil
}

// SynthesizeForExperiment 为实验的讲解稿件合成指定音色的音频。
func (s *ContentService) SynthesizeForExperiment(ctx context.Context, experimentID uint, voices []string, force bool) ([]SynthResult, error) {
	exp, err := s.expRepo.GetByID(experimentID)
	if err != nil {
		return nil, errors.New("实验不存在")
	}
	tts, err := s.aiSvc.GetActive(model.ModelTypeTTS)
	if err != nil {
		return nil, err
	}
	if tts == nil {
		return nil, errors.New("尚未激活 TTS 大模型，请先在「管理后台 → 大模型配置」中添加并激活（可使用 Edge TTS，无需密钥）")
	}

	// 合成只针对 AI 版：行取自 AI 版存档，音频写入 <id>/<voice>/ai/。
	// 种子版的文稿与配音是基线资产，任何情况下都不改写、不覆盖。
	aiContent, loadErr := s.LoadAIVersionContent(exp.ID)
	if loadErr != nil {
		return nil, errors.New("该实验还没有 AI 版内容：请先在「AI 教学」里生成文稿，再点「🎧 合成语音」")
	}
	plan := narrationAudioLines(aiContent)
	if len(plan) == 0 {
		return nil, errors.New("AI 版内容里没有讲解稿，请先生成教学内容")
	}
	if len(voices) == 0 {
		voices = ai.Voices()
	}

	// 只有 AI 版正在生效时才把音频地址写回 narrations；
	// 种子版生效时 narrations 里是种子行，写回会破坏「种子文稿 ↔ 种子配音」的对应关系。
	narrationByLine := map[string]*model.Narration{}
	if s.ActiveSource(exp.ID) == model.ContentSourceAI {
		rows, listErr := s.narrRepo.ListByExperiment(exp.ID)
		if listErr != nil {
			return nil, listErr
		}
		for i := range rows {
			narrationByLine[rows[i].LineID] = &rows[i]
		}
	}

	results := make([]SynthResult, 0, len(voices))
	for _, voice := range voices {
		if voice != ai.VoiceYunxi && voice != ai.VoiceXiaoxiao {
			return nil, fmt.Errorf("不支持的音色: %s", voice)
		}
		res := SynthResult{ExperimentID: exp.ID, Voice: voice}

		// 第一步（串行）：筛出真正需要合成的行，并把已存在文件的 URL 补写回库
		// （仅当 AI 版生效、narrations 里确实是 AI 行时）。
		type synthTask struct {
			lineID   string
			text     string
			outPath  string
			audioURL string
		}
		tasks := make([]synthTask, 0, len(plan))
		for _, line := range plan {
			relPath := filepath.Join(append(s.AIAudioDirParts(exp.ID, voice), line.LineID+".mp3")...)
			outPath := filepath.Join(s.audioDir, relPath)
			audioURL := "/audio/" + filepath.ToSlash(relPath)

			if !force {
				if info, statErr := os.Stat(outPath); statErr == nil && info.Size() > 0 {
					res.Skipped++
					if row, ok := narrationByLine[line.LineID]; ok {
						if s.needsAudioUpdate(row, voice, audioURL) {
							s.applyAudio(row, voice, audioURL, row.DurationMs)
							if err := s.narrRepo.Save(row); err != nil {
								res.Errors = append(res.Errors, fmt.Sprintf("%s: 保存失败 %v", line.LineID, err))
							}
						}
						res.TotalMs += row.DurationMs
					}
					continue
				}
			}
			tasks = append(tasks, synthTask{
				lineID: line.LineID, text: line.Text,
				outPath: outPath, audioURL: audioURL,
			})
		}

		// 第二步（并发）：多路同时调用 TTS。
		// 台词数量常有数十条，逐条串行会让一个实验耗时接近十分钟，
		// 前端会长时间停留在「合成中」。Edge TTS 是网络服务，并发 4 路足够稳妥。
		type synthOut struct {
			task synthTask
			ms   int
			err  error
		}
		outs := make([]synthOut, len(tasks))
		conc := 4
		if len(tasks) < conc {
			conc = len(tasks)
		}
		if conc > 0 {
			var wg sync.WaitGroup
			ch := make(chan int)
			for w := 0; w < conc; w++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					for ti := range ch {
						t := tasks[ti]
						ms, synthErr := ai.Synthesize(ctx, tts, t.text, voice, t.outPath)
						outs[ti] = synthOut{task: t, ms: ms, err: synthErr}
					}
				}()
			}
			for ti := range tasks {
				select {
				case <-ctx.Done():
					close(ch)
					wg.Wait()
					return results, ctx.Err()
				case ch <- ti:
				}
			}
			close(ch)
			wg.Wait()
		}

		// 第三步（串行）：入库与统计。数据库写入保持单线程，避免并发写冲突。
		// 只有 AI 版生效时 narrationByLine 才非空，种子版生效时只落文件、不动种子行。
		for _, o := range outs {
			if o.err != nil {
				res.Failed++
				if len(res.Errors) < 5 {
					res.Errors = append(res.Errors, fmt.Sprintf("%s: %v", o.task.lineID, o.err))
				}
				continue
			}
			ms := o.ms
			if ms <= 0 {
				ms = ai.EstimateDurationMs(o.task.text)
			}
			if row, ok := narrationByLine[o.task.lineID]; ok {
				s.applyAudio(row, voice, o.task.audioURL, ms)
				if err := s.narrRepo.Save(row); err != nil {
					res.Failed++
					if len(res.Errors) < 5 {
						res.Errors = append(res.Errors, fmt.Sprintf("%s: 保存失败 %v", o.task.lineID, err))
					}
					continue
				}
			}
			res.Synthesized++
			res.TotalMs += ms
		}
		results = append(results, res)
	}

	// 一条都没成功、却确实有失败：按错误返回。
	// 否则接口返回 code 0「语音合成完成」，前端也提示"合成完成"，而实际产出的全是坏音频
	//（例如商用 TTS 的 BaseURL 填成了网页地址，拿到 200 + HTML）。
	synthesized, failed := 0, 0
	firstErr := ""
	for _, r := range results {
		synthesized += r.Synthesized
		failed += r.Failed
		if firstErr == "" && len(r.Errors) > 0 {
			firstErr = r.Errors[0]
		}
	}
	if synthesized == 0 && failed > 0 {
		if firstErr == "" {
			firstErr = "所有台词都合成失败"
		}
		return results, fmt.Errorf("语音合成失败（%d 句全部失败）：%s", failed, firstErr)
	}
	return results, nil
}

func (s *ContentService) needsAudioUpdate(line *model.Narration, voice, url string) bool {
	if voice == ai.VoiceXiaoxiao {
		return line.AudioXiaoxiao != url
	}
	return line.AudioYunxi != url
}

func (s *ContentService) applyAudio(line *model.Narration, voice, url string, ms int) {
	if voice == ai.VoiceXiaoxiao {
		line.AudioXiaoxiao = url
	} else {
		line.AudioYunxi = url
	}
	if ms > 0 {
		line.DurationMs = ms
	}
}

// narrationAudioLine 是合成语音需要的一行：只保留落文件所需的信息。
type narrationAudioLine struct {
	LineID string
	Text   string
}

// narrationAudioLines 展平一份教学内容里的讲解稿。
//
// 行标识规则必须与 applyContent / persistContent 完全一致（section 缺失用 section-N、
// line 缺失用 <sectionID>-N、空台词跳过），否则音频文件名会与文稿对不上。
func narrationAudioLines(content *model.ExperimentContent) []narrationAudioLine {
	if content == nil {
		return nil
	}
	out := make([]narrationAudioLine, 0, 32)
	for si, section := range content.Narration.Sections {
		sectionID := strings.TrimSpace(section.ID)
		if sectionID == "" {
			sectionID = fmt.Sprintf("section-%d", si+1)
		}
		for li, line := range section.Lines {
			text := strings.TrimSpace(line.Text)
			if text == "" {
				continue
			}
			lineID := strings.TrimSpace(line.ID)
			if lineID == "" {
				lineID = fmt.Sprintf("%s-%d", sectionID, li+1)
			}
			out = append(out, narrationAudioLine{LineID: lineID, Text: text})
		}
	}
	return out
}

// GenerateBatch 批量生成教学内容（默认只处理 pending 状态的实验）。
func (s *ContentService) GenerateBatch(ctx context.Context, difficulty string, limit int, includeReady bool) (*BatchSummary, error) {
	status := "pending"
	if includeReady {
		status = ""
	}
	if limit <= 0 {
		limit = 5
	}
	experiments, err := s.expRepo.ListByContentStatus(status, difficulty, limit)
	if err != nil {
		return nil, err
	}

	summary := &BatchSummary{Total: len(experiments)}
	for i := range experiments {
		select {
		case <-ctx.Done():
			return summary, ctx.Err()
		default:
		}
		res, genErr := s.GenerateForExperiment(ctx, experiments[i].ID)
		if genErr != nil {
			summary.Failed++
			summary.Results = append(summary.Results, GenerateResult{
				ExperimentID: experiments[i].ID,
				Slug:         experiments[i].Slug,
				Title:        experiments[i].Title,
				Status:       "failed",
				Message:      genErr.Error(),
			})
			continue
		}
		summary.Succeeded++
		summary.Results = append(summary.Results, *res)
	}
	return summary, nil
}

// SynthesizeBatch 批量为"已有稿件但缺音频"的实验合成语音。
func (s *ContentService) SynthesizeBatch(ctx context.Context, voice string, limit int, force bool) ([]SynthResult, error) {
	if voice == "" {
		voice = ai.VoiceYunxi
	}
	if limit <= 0 {
		limit = 5
	}
	ids, err := s.narrRepo.ExperimentIDsWithoutAudio(audioColumn(voice), limit)
	if err != nil {
		return nil, err
	}
	results := make([]SynthResult, 0, len(ids))
	for _, id := range ids {
		select {
		case <-ctx.Done():
			return results, ctx.Err()
		default:
		}
		// 批量合成同样只处理 AI 版：没有 AI 版存档的实验直接跳过，
		// 既不报错也不改动种子版的文稿与配音。
		if _, loadErr := s.LoadAIVersionContent(id); loadErr != nil {
			continue
		}
		res, synthErr := s.SynthesizeForExperiment(ctx, id, []string{voice}, force)
		if synthErr != nil {
			results = append(results, SynthResult{ExperimentID: id, Voice: voice, Failed: 1, Errors: []string{synthErr.Error()}})
			continue
		}
		results = append(results, res...)
	}
	return results, nil
}

// ListNarrations 返回某个实验的讲解稿件（含音频地址与时长）。
func (s *ContentService) ListNarrations(experimentID uint) ([]model.Narration, error) {
	if _, err := s.expRepo.GetByID(experimentID); err != nil {
		return nil, errors.New("实验不存在")
	}
	return s.narrRepo.ListByExperiment(experimentID)
}

// UpdateNarration 人工润色单行台词；文本变更后音频需要重新合成。
func (s *ContentService) UpdateNarration(id uint, text, sectionID string) (*model.Narration, error) {
	item, err := s.narrRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("讲解行不存在")
	}
	if t := strings.TrimSpace(text); t != "" && t != item.Text {
		item.Text = t
		// 文本变化后旧的音频已不匹配，清空以便重新合成。
		item.AudioYunxi = ""
		item.AudioXiaoxiao = ""
		item.DurationMs = ai.EstimateDurationMs(t)
	}
	if sid := strings.TrimSpace(sectionID); sid != "" {
		item.SectionID = sid
	}
	if err := s.narrRepo.Save(item); err != nil {
		return nil, err
	}
	return item, nil
}

// DeleteNarration 删除单行台词。
func (s *ContentService) DeleteNarration(id uint) error {
	if _, err := s.narrRepo.GetByID(id); err != nil {
		return errors.New("讲解行不存在")
	}
	return s.narrRepo.Delete(id)
}

// NarrationInput 是手工录入/批量上传的一条讲解台词。
type NarrationInput struct {
	SectionID    string                 `json:"section_id"`
	SectionTitle string                 `json:"section_title"`
	LineID       string                 `json:"line_id"`
	Text         string                 `json:"text"`
	Animation    *model.AnimationConfig `json:"animation"`
}

// ImportNarrations 批量导入讲解台词；replace 为 true 时整体替换既有稿件。
// 用于管理后台手工编写讲解，或在 AI 生成后做人工补充（架构 6.6 批量上传讲解）。
func (s *ContentService) ImportNarrations(experimentID uint, inputs []NarrationInput, replace bool) (int, error) {
	exp, err := s.expRepo.GetByID(experimentID)
	if err != nil {
		return 0, errors.New("实验不存在")
	}
	if len(inputs) == 0 {
		return 0, errors.New("讲解内容为空")
	}

	existing, err := s.narrRepo.ListByExperiment(exp.ID)
	if err != nil {
		return 0, err
	}

	rows := make([]model.Narration, 0, len(inputs))
	index := 0
	if !replace {
		rows = append(rows, existing...)
		index = len(existing)
	}
	for i, in := range inputs {
		text := strings.TrimSpace(in.Text)
		if text == "" {
			continue
		}
		sectionID := strings.TrimSpace(in.SectionID)
		if sectionID == "" {
			sectionID = "custom"
		}
		lineID := strings.TrimSpace(in.LineID)
		if lineID == "" {
			lineID = fmt.Sprintf("%s-%d", sectionID, i+1)
		}
		anim := "{}"
		if in.Animation != nil {
			if v, err := json.Marshal(in.Animation); err == nil {
				anim = string(v)
			}
		}
		rows = append(rows, model.Narration{
			SectionID:    sectionID,
			SectionTitle: strings.TrimSpace(in.SectionTitle),
			LineIndex:    index,
			LineID:       lineID,
			Text:         text,
			AnimationCfg: anim,
		})
		index++
	}
	if len(rows) == 0 {
		return 0, errors.New("没有有效的讲解台词")
	}
	if err := s.narrRepo.ReplaceForExperiment(exp.ID, rows); err != nil {
		return 0, err
	}
	return len(rows), nil
}

// ContentOverview 返回内容生产进度概览，供管理后台展示。
func (s *ContentService) ContentOverview() (map[string]any, error) {
	statusCounts, err := s.expRepo.ContentStats()
	if err != nil {
		return nil, err
	}
	byDifficulty, err := s.expRepo.CountByDifficulty()
	if err != nil {
		return nil, err
	}
	yunxi, err := s.narrRepo.CountWithAudio("audio_yunxi")
	if err != nil {
		return nil, err
	}
	xiaoxiao, err := s.narrRepo.CountWithAudio("audio_xiaoxiao")
	if err != nil {
		return nil, err
	}
	edgeOK, edgeHint := ai.EdgeAvailable()
	return map[string]any{
		"content_status":       statusCounts,
		"difficulty":           byDifficulty,
		"audio_lines_yunxi":    yunxi,
		"audio_lines_xiaoxiao": xiaoxiao,
		"voices":               ai.Voices(),
		"edge_tts_available":   edgeOK,
		"edge_tts_hint":        edgeHint,
	}, nil
}

func audioColumn(voice string) string {
	if voice == ai.VoiceXiaoxiao {
		return "audio_xiaoxiao"
	}
	return "audio_yunxi"
}

func (s *ContentService) markFailed(experimentID uint, cause error) {
	_ = s.expRepo.UpdateFields(experimentID, map[string]any{
		"content_status": "failed",
		"content_error":  truncate(cause.Error(), 480),
	})
}

// marshalJSON 序列化并保证非空（空值使用 fallback）。
func marshalJSON(v any, fallback string) (string, error) {
	buf, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	out := strings.TrimSpace(string(buf))
	if out == "" || out == "null" {
		return fallback, nil
	}
	return out, nil
}

// GenerateStreamForExperiment 以流式方式生成教学内容。
//
// 与 GenerateForExperiment 的区别：LLM 的增量输出会实时回调 onDelta（供前端 SSE 展示），
// 全部接收完毕后再解析落库。ctx 被取消（用户点「取消」）时立即中止，且不会污染已有内容。
func (s *ContentService) GenerateStreamForExperiment(
	ctx context.Context,
	experimentID uint,
	maxTokens int,
	onDelta ai.DeltaFunc,
) (*GenerateResult, error) {
	exp, err := s.expRepo.GetByID(experimentID)
	if err != nil {
		return nil, errors.New("实验不存在")
	}

	llm, err := s.aiSvc.GetActive(model.ModelTypeLLM)
	if err != nil {
		return nil, err
	}
	if llm == nil {
		return nil, errors.New("尚未配置大模型：请先在「模型配置」中添加并激活一个 LLM")
	}

	_ = s.expRepo.UpdateFields(exp.ID, map[string]any{
		"content_status": "generating",
		"content_error":  "",
	})

	categoryName := ""
	if exp.Category != nil {
		categoryName = exp.Category.Name
	}
	prompt := ai.BuildContentPrompt(exp, categoryName)

	var buf strings.Builder
	streamErr := ai.ChatStream(ctx, llm, ai.ChatRequest{
		System:      ai.SystemPrompt,
		User:        prompt,
		Temperature: 0.6,
		MaxTokens:   resolveMaxTokens(maxTokens),
	}, func(delta string) error {
		buf.WriteString(delta)
		return onDelta(delta)
	})

	if streamErr != nil {
		if ctx.Err() != nil {
			// 用户主动取消：不算失败，保留原有内容
			_ = s.expRepo.UpdateFields(exp.ID, map[string]any{"content_status": "ready"})
			return nil, ctx.Err()
		}
		s.markFailed(exp.ID, streamErr)
		return nil, streamErr
	}

	rawOutput := buf.String()
	// 空输出的专门提示：商用推理模型（DeepSeek-R1 / -reasoner 等）会先流式输出一大段
	// 思维链（reasoning_content），我们只取正文（delta.content）；一旦「最大 Token」
	// 被思维链吃光，正文就一直是空的 —— 这时若直接去解析空串，只会报
	// "unexpected end of JSON input"，对用户毫无指导意义。
	if strings.TrimSpace(rawOutput) == "" {
		emptyErr := emptyCompletionError()
		s.markFailed(exp.ID, emptyErr)
		return nil, emptyErr
	}
	content, parseErr := ai.ParseContent(rawOutput)
	if parseErr != nil {
		s.markFailed(exp.ID, parseErr)
		return nil, wrapParseError(parseErr, rawOutput)
	}

	lines, sections, warning, applyErr := s.applyGeneratedContent(exp, content, llm.ModelName)
	if applyErr != nil {
		s.markFailed(exp.ID, applyErr)
		return nil, applyErr
	}

	return &GenerateResult{
		ExperimentID: exp.ID,
		Slug:         exp.Slug,
		Title:        exp.Title,
		Status:       "ready",
		Sections:     sections,
		Lines:        lines,
		Formulas:     len(content.Formulas),
		AppHooks:     len(content.AppHooks),
		Warning:      warning,
	}, nil
}

// applyGeneratedContent 落库本次生成结果，并返回讲解稿行数与段落数。
//
// 种子数据安全约定：内容一律写入「AI 版」存档；只有当 AI 版正是当前生效版本时，
// 才同步 experiments / narrations。种子版生效时（缺省态）界面内容保持不动，
// 用户点「AI 版」tab 时才切换 —— 因此重新生成永远不会冲掉种子数据。
func (s *ContentService) applyGeneratedContent(
	exp *model.Experiment,
	content *model.ExperimentContent,
	modelName string,
) (int, int, string, error) {
	// 先确保种子版已有存档基线：否则一旦覆盖 experiments / narrations，
	// 种子内容就再也切不回来。归档失败直接中止，绝不冒险覆盖。
	if s.versionSvc != nil {
		if err := s.versionSvc.EnsureSeedVersion(exp.ID); err != nil {
			return 0, 0, "", fmt.Errorf("保存种子版基线失败: %w", err)
		}
	}

	lines := len(narrationAudioLines(content))
	sections := len(content.Narration.Sections)

	// 当前生效版本决定「是否同步到界面」：AI 版生效才写 experiments / narrations。
	activeAI := s.ActiveSource(exp.ID) == model.ContentSourceAI
	if activeAI {
		persistedLines, persistedSections, err := s.persistContent(exp, content)
		if err != nil {
			return 0, 0, "", err
		}
		lines, sections = persistedLines, persistedSections
	} else if err := s.expRepo.UpdateFields(exp.ID, map[string]any{
		"content_status": "ready",
		"content_error":  "",
	}); err != nil {
		return 0, 0, "", err
	}

	warning := joinWarnings(
		graphLinkWarning(exp.ID, content),
		graphTemplateWarning(exp.ID, content),
		graphParamCoverageWarning(exp.ID, content),
		graphUndefinedParamWarning(exp.ID, content),
		graphEmptyElementWarning(exp.ID, content),
		narrationWarning(exp.ID, content),
	)
	s.storeVersion(exp.ID, modelName, content, activeAI)
	return lines, sections, warning, nil
}

// narrationWarning 检查讲解稿是否写全段落；不完整时返回给前端看的提示。
//
// 模型偶尔只生成「开场引入」一段就收尾（结构示例里只有一段时尤其容易照抄），
// 那样合成语音也只有一句，用户会误以为「合成坏了」。
func narrationWarning(expID uint, content *model.ExperimentContent) string {
	if content == nil {
		return ""
	}
	sections := len(content.Narration.Sections)
	lines := len(narrationAudioLines(content))
	if sections >= 4 && lines >= 8 {
		return ""
	}
	zap.L().Warn("讲解稿段落不完整",
		zap.Uint("experiment", expID),
		zap.Int("sections", sections),
		zap.Int("lines", lines),
	)
	return fmt.Sprintf(
		"提示：本次讲解稿只生成了 %d 段 / %d 行（要求 5 段、不少于 14 行），合成语音也会相应变少，建议点「重新生成」再试一次。",
		sections, lines,
	)
}

// joinWarnings 合并多条质量提示（忽略空串）。
func joinWarnings(parts ...string) string {
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, " ")
}

// graphLinkWarning 检查图形是否与可调参数联动；未联动时返回给前端看的提示。
//
// 「拖动参数图形却不变化」对教学是致命的，而模型偶尔会给出全固定数字的图形，
// 所以这里做一次校验，把问题显式告诉用户，而不是让他以为功能坏了。
func graphLinkWarning(expID uint, content *model.ExperimentContent) string {
	if content == nil || len(content.Graph) == 0 || len(content.ParamsSchema) == 0 {
		return ""
	}
	if graphHasParamLink(content.Graph, content.ParamsSchema) {
		return ""
	}
	zap.L().Warn("AI 图形未与参数联动", zap.Uint("experiment", expID))
	return "提示：本次生成的图形没有引用可调参数，拖动参数时画面不会变化，建议点「重新生成」再试一次。"
}

// graphTemplateWarning 检查图形是否照抄了提示词里的示例；照抄时返回给前端看的提示。
//
// 示例图元带 "_demo": true 标记，文案也写成占位式（「（示例文字…）」）。
// 模型照抄示例时这两样都会原样带出来 —— 用户看到的现象就是「每个实验的图形都一模一样」。
func graphTemplateWarning(expID uint, content *model.ExperimentContent) string {
	if content == nil || len(content.Graph) == 0 {
		return ""
	}
	raw := string(content.Graph)
	marker := ""
	switch {
	case strings.Contains(raw, `"_demo"`):
		marker = "_demo 标记"
	case strings.Contains(raw, "（示例文字，请换成"):
		marker = "示例文字"
	case strings.Contains(raw, "（示例标注，请换成"):
		marker = "示例标注"
	case strings.Contains(raw, "拖动参数试试"):
		marker = "旧示例文案（拖动参数试试）"
	case strings.Contains(raw, "拖动参数看这一点"):
		marker = "旧示例文案（拖动参数看这一点）"
	}
	if marker == "" {
		return ""
	}
	zap.L().Warn("AI 图形疑似照抄提示词示例",
		zap.Uint("experiment", expID),
		zap.String("marker", marker),
	)
	return "提示：本次图形与系统示例雷同（" + marker + "），没有针对本实验内容设计，建议点「重新生成」再试一次。"
}

// graphParamCoverageWarning 检查是否每个可调参数都被图形引用；有遗漏时返回提示。
//
// 参数面板里出现、但图形里没用到的滑块，拖了画面也不会变 —— 用户会以为坏了。
// 两种情形分开说明，因为用户看到的现象不同：
//   - 只写在文字/标注里 —— 文字里的数字会变，图形形状不变；
//   - 图形里完全没有 —— 拖了什么都不变。
func graphParamCoverageWarning(expID uint, content *model.ExperimentContent) string {
	if content == nil || len(content.Graph) == 0 || len(content.ParamsSchema) == 0 {
		return ""
	}
	unused := graphUnusedParams(content.Graph, content.ParamsSchema)
	if len(unused) == 0 {
		return ""
	}
	textOnly := graphTextOnlyParams(content.Graph, content.ParamsSchema)
	zap.L().Warn("部分参数未被图形引用",
		zap.Uint("experiment", expID),
		zap.Strings("unused", unused),
		zap.Strings("text_only", textOnly),
	)
	// 把「只在文字里」的参数从 unused 里摘出来，剩下的就是图形里完全没出现的。
	inText := make(map[string]bool, len(textOnly))
	for _, name := range textOnly {
		inText[name] = true
	}
	absent := make([]string, 0, len(unused))
	for _, name := range unused {
		if !inText[name] {
			absent = append(absent, name)
		}
	}
	parts := make([]string, 0, 2)
	if len(textOnly) > 0 {
		parts = append(parts, fmt.Sprintf(
			"参数 %s 只写在文字标注里（只有文字里的数字会变，图形形状不变）",
			strings.Join(textOnly, "、")))
	}
	if len(absent) > 0 {
		parts = append(parts, fmt.Sprintf(
			"参数 %s 在图形里完全没有用到",
			strings.Join(absent, "、")))
	}
	return fmt.Sprintf(
		"提示：%s，拖动它们图形不会变化，建议点「重新生成」再试一次。",
		strings.Join(parts, "；"),
	)
}

// graphUnusedParams 返回 params_schema 里没有被 graph 的几何/表达式字段引用的参数名（已排序）。
func graphUnusedParams(graph json.RawMessage, schema map[string]model.ParamDef) []string {
	interactive := graphInteractiveFields(graph)
	out := make([]string, 0, len(schema))
	for name := range schema {
		if graphFieldsReference(interactive, strings.TrimSpace(name)) {
			continue
		}
		out = append(out, strings.TrimSpace(name))
	}
	return sortedParamNames(out)
}

// graphTextOnlyParams 返回「只写在文字标注/配色等展示字段里、没有进入图形几何」的参数名（已排序）。
//
// 这类参数拖动时文字里的数字确实会变，所以提示语不能说"画面不会变化" —— 得说清是图形形状不变。
// 注意方向：这里是**出现在展示字段里、且没出现在几何字段里**的参数，
// 与 graphUnusedParams（几何字段里找不到的一切）不是一回事，别把两者写反。
func graphTextOnlyParams(graph json.RawMessage, schema map[string]model.ParamDef) []string {
	display := graphDisplayFields(graph)
	if display == "" {
		return nil
	}
	interactive := graphInteractiveFields(graph)
	out := make([]string, 0, len(schema))
	for name := range schema {
		name = strings.TrimSpace(name)
		if !graphFieldsReference(display, name) || graphFieldsReference(interactive, name) {
			continue
		}
		out = append(out, name)
	}
	return sortedParamNames(out)
}

// sortedParamNames 去掉空名并排序（提示语里要稳定可读）。
func sortedParamNames(names []string) []string {
	out := make([]string, 0, len(names))
	for _, name := range names {
		if strings.TrimSpace(name) != "" {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}

// graphFieldsReference 判断字段文本里是否引用了某个参数（"$参数名" 或表达式里的裸标识符）。
//
// "$num_a" 里的 num_a 前后分别是 $ 与结尾，都是非标识符字符，所以裸标识符匹配本身就覆盖了 $ 写法；
// 反过来 "$num_a2" 不会被误判成引用了 num_a。
func graphFieldsReference(fields, name string) bool {
	if fields == "" {
		return false
	}
	return containsBareIdentifier(fields, name)
}

// graphDisplayOnlyKeys 是**只影响文字与配色、不影响图形形状**的字段名（小写比较）。
//
// 参数只出现在这些字段里时，拖动参数只有画面上的数字会变 —— 不能算"图形联动了"，
// 但也要和"图形里完全没出现"区分开，否则提示语说的现象和用户看到的对不上。
var graphDisplayOnlyKeys = map[string]bool{
	"text": true, "label": true,
	"color": true, "fill": true, "emptyfill": true, "stroke": true, "palette": true,
}

// graphRawOptionKeys 是渲染器**直接使用、不经过参数求值**的枚举/结构字段（小写比较）。
//
// 写在里面的 "$参数名" 不会生效（canvas 会当无效值忽略），所以既不算图形联动，
// 也不算"只写在文字标注里" —— 归入"图形里完全没有用到"才是用户看到的现象。
var graphRawOptionKeys = map[string]bool{
	"type": true, "kind": true, "mode": true, "closed": true, "dash": true,
}

// graphElementText 把 graph 的所有图元字段摊平成文本；displayOnly 为 true 时只取展示字段，
// 为 false 时取除展示字段与原始枚举字段以外的全部字段（即**真正影响绘制**的几何与表达式字段）。
//
// 这里用「排除展示字段」的黑名单而不是以前的「只认 from/to/at/center/w/h/r/points/fn」白名单：
// 白名单漏掉了 motion 的 x / y / xs / ys / span / sFrom / sTo（动画图元）、
// sequence 的 nFrom / nTo、pie 的 numerator / denominator，
// 于是「参数只写在 motion 表达式里」的合规图形会被误报成"参数没被引用"。
// 新增图元类型时也不必再回来补白名单 —— 前提是渲染器侧也把该字段接上了 numeric()（见约定 18）。
func graphElementText(graph json.RawMessage, displayOnly bool) string {
	var spec struct {
		Elements []map[string]any `json:"elements"`
		Surface  map[string]any   `json:"surface"`
	}
	if err := json.Unmarshal(graph, &spec); err != nil {
		return ""
	}
	var sb strings.Builder
	writeFields := func(el map[string]any) {
		keys := make([]string, 0, len(el))
		for k := range el {
			keys = append(keys, k)
		}
		sort.Strings(keys) // 固定顺序，便于测试与排查
		for _, k := range keys {
			lower := strings.ToLower(k)
			if displayOnly {
				if !graphDisplayOnlyKeys[lower] {
					continue
				}
			} else if graphDisplayOnlyKeys[lower] || graphRawOptionKeys[lower] {
				continue
			}
			if text := fieldText(el[k]); text != "" {
				sb.WriteString(text)
				sb.WriteByte('\n')
			}
		}
	}
	for _, el := range spec.Elements {
		writeFields(el)
	}
	if spec.Surface != nil && !displayOnly {
		// 3D 曲面的 fn 一定会参与绘制，不属于展示字段。
		if fn, ok := spec.Surface["fn"].(string); ok && strings.TrimSpace(fn) != "" {
			sb.WriteString(fn)
			sb.WriteByte('\n')
		}
	}
	return sb.String()
}

// graphInteractiveFields 抽取 graph 里**真正影响绘制**的文本（几何字段与表达式）。
//
// 纯展示字段（text / label / color / fill / palette）不参与判断 —— 否则模型只在标注里写 "$num_a"、
// 而所有几何字段都是固定数字时，会被误判为"已联动"，用户拖动参数却看不到图形变化。
func graphInteractiveFields(graph json.RawMessage) string {
	return graphElementText(graph, false)
}

// graphDisplayFields 抽取 graph 里的纯展示文本（text / label / color / fill…）。
func graphDisplayFields(graph json.RawMessage) string {
	return graphElementText(graph, true)
}

// graphParamRefPattern 匹配 graph 里的 $参数名 引用（含文字字段，因为文字也会做插值）。
var graphParamRefPattern = regexp.MustCompile(`\$([A-Za-z_]\w*)`)

// graphUndefinedParamWarning 检查 graph 引用了 params_schema 里没定义的参数名。
//
// 未声明的参数不会被替换：画面上（以及文字插值里）会原样显示成 "$area_a"、"$sqrt_c" 这种怪符号。
func graphUndefinedParamWarning(expID uint, content *model.ExperimentContent) string {
	if content == nil || len(content.Graph) == 0 {
		return ""
	}
	undefined := graphUndefinedParams(content.Graph, content.ParamsSchema)
	if len(undefined) == 0 {
		return ""
	}
	zap.L().Warn("图形引用了未声明的参数",
		zap.Uint("experiment", expID),
		zap.Strings("undefined", undefined),
	)
	names := make([]string, 0, len(undefined))
	for _, n := range undefined {
		names = append(names, "$"+n)
	}
	return fmt.Sprintf(
		"提示：图形里用到了未定义的参数 %s（不在 params_schema 中），画面上会原样显示出来，建议点「重新生成」再试一次。",
		strings.Join(names, "、"),
	)
}

// graphUndefinedParams 返回 graph 引用了、但 params_schema 里没有定义的参数名（已排序）。
func graphUndefinedParams(graph json.RawMessage, schema map[string]model.ParamDef) []string {
	matches := graphParamRefPattern.FindAllStringSubmatch(string(graph), -1)
	if len(matches) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(matches))
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		if _, ok := schema[name]; !ok {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}

// fieldText 把数值字段的值摊平成便于搜索的文本（字符串 / 数组 / 嵌套数组都处理）。
func fieldText(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case []any:
		parts := make([]string, 0, len(t))
		for _, item := range t {
			if text := fieldText(item); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, " ")
	default:
		return ""
	}
}

// graphEmptyElementWarning 检查图形里是否有「空图元」（最典型的是 "points": []）。
//
// 模型想画"由参数算出来的一串点"时，常写成空的 points 占位 —— 渲染出来整片空白。
// 数列类图形应当用 sequence 图元，所以这里直接把问题告诉用户，而不是让他对着空地发呆。
func graphEmptyElementWarning(expID uint, content *model.ExperimentContent) string {
	if content == nil || len(content.Graph) == 0 {
		return ""
	}
	empty, drawable := countGraphElements(content.Graph)
	if drawable == 0 && empty == 0 {
		return "提示：图形里没有任何可绘制的图元，画出来是空白，建议点「重新生成」再试一次。"
	}
	if empty == 0 {
		return ""
	}
	zap.L().Warn("图形里有空图元",
		zap.Uint("experiment", expID),
		zap.Int("empty", empty),
		zap.Int("drawable", drawable),
	)
	if drawable == 0 {
		return fmt.Sprintf(
			"提示：图形里有 %d 个空图元（例如 \"points\": []），整张图实际上什么都没画出来；数列请用 sequence 图元。建议点「重新生成」再试一次。",
			empty,
		)
	}
	return fmt.Sprintf("提示：图形里有 %d 个空图元（例如 \"points\": []）不会显示任何内容，建议点「重新生成」再试一次。", empty)
}

// countGraphElements 统计 graph 里「空图元」（points 为空数组）与「可绘制图元」的数量。
func countGraphElements(graph json.RawMessage) (empty, drawable int) {
	var spec struct {
		Elements []map[string]any `json:"elements"`
		Surface  map[string]any   `json:"surface"`
	}
	if err := json.Unmarshal(graph, &spec); err != nil {
		return 0, 0
	}
	if spec.Surface != nil {
		if fn, _ := spec.Surface["fn"].(string); strings.TrimSpace(fn) != "" {
			drawable++
		}
	}
	for _, el := range spec.Elements {
		if kind, _ := el["type"].(string); strings.TrimSpace(kind) == "" {
			continue
		}
		if pts, ok := el["points"].([]any); ok && len(pts) == 0 {
			empty++
			continue
		}
		drawable++
	}
	return empty, drawable
}

// graphHasParamLink 判断 graph 里是否引用了 params_schema 的任一参数名。
//
// 有效写法只有两种：数值字段写成 "$参数名"；表达式（curve.fn / surface.fn）里直接用参数名。
func graphHasParamLink(graph json.RawMessage, schema map[string]model.ParamDef) bool {
	raw := graphInteractiveFields(graph)
	if strings.TrimSpace(raw) == "" || len(schema) == 0 {
		return false
	}
	for name := range schema {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if strings.Contains(raw, `"$`+name+`"`) || containsBareIdentifier(raw, name) {
			return true
		}
	}
	return false
}

// containsBareIdentifier 判断 s 中是否出现独立的标识符 name（前后都不是字母/数字/下划线）。
func containsBareIdentifier(s, name string) bool {
	isWordByte := func(b byte) bool {
		return b == '_' || (b >= '0' && b <= '9') || (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
	}
	for from := 0; from < len(s); {
		i := strings.Index(s[from:], name)
		if i < 0 {
			return false
		}
		start := from + i
		end := start + len(name)
		beforeOK := start == 0 || !isWordByte(s[start-1])
		afterOK := end >= len(s) || !isWordByte(s[end])
		if beforeOK && afterOK {
			return true
		}
		from = start + 1
	}
	return false
}

// storeVersion 把本次生成的内容存档为「AI 版」。
//
// active 为 true（AI 版就是当前生效版本）时才把生效标记指到 AI 版；
// 种子版生效时只覆盖 AI 版存档，绝不改动种子版与生效状态。
// 失败不影响生成结果（版本存档是附加能力），仅记录日志。
func (s *ContentService) storeVersion(expID uint, modelName string, content *model.ExperimentContent, active bool) {
	if s.versionSvc == nil || content == nil {
		return
	}
	if err := s.versionSvc.SaveVersion(expID, model.ContentSourceAI, modelName, content, false); err != nil {
		zap.L().Warn("保存 AI 版内容失败", zap.Uint("experiment", expID), zap.Error(err))
		return
	}
	if !active {
		return
	}
	if err := s.versionSvc.MarkActive(expID, model.ContentSourceAI); err != nil {
		zap.L().Warn("标记 AI 版生效失败", zap.Uint("experiment", expID), zap.Error(err))
	}
}

// LoadVersionContent 读取某版本存档内容（source = seed | ai）。
func (s *ContentService) LoadVersionContent(expID uint, source string) (*model.ExperimentContent, error) {
	if s.versionSvc == nil {
		return nil, errors.New("版本服务未初始化")
	}
	return s.versionSvc.LoadVersionContent(expID, source)
}

// LoadAIVersionContent 读取某实验的 AI 版存档内容（合成语音以它为准）。
func (s *ContentService) LoadAIVersionContent(expID uint) (*model.ExperimentContent, error) {
	return s.LoadVersionContent(expID, model.ContentSourceAI)
}

// emptyCompletionError 在模型返回空正文时给出可操作的提示。
//
// 直接去解析空串只会得到 "unexpected end of JSON input"，对用户毫无指导意义。
// 最常见的原因是推理模型（DeepSeek-R1 / -reasoner 等）把「最大 Token」全用在思维链上，
// 正文被挤空 —— 我们只收正文（delta.content），所以一个字符都拿不到。
func emptyCompletionError() error {
	return errors.New(
		"大模型没有返回任何正文内容。常见原因：① 用的是推理模型（如 DeepSeek-R1 / -reasoner），" +
			"思维链把「最大 Token」吃光了，正文被挤掉 —— 把「最大 Token」调大（如 16384）后重试，" +
			"或改用非推理模型（如 deepseek-chat）；② 模型名 / BaseURL 配错，或该服务商不支持流式输出",
	)
}

// wrapParseError 给解析失败补上可诊断、可操作的信息。
//
// 解析层已经会尝试修复括号错配、尾随逗号、注释与截断（见 ai.ParseContent）。
// 仍然失败时：
//   - 把模型原始输出写进服务日志（便于事后定性是模型写坏了还是程序处理错了）；
//   - 把原文开头一小段附进错误信息，前端会显示在「生成失败」提示里。
func wrapParseError(err error, raw string) error {
	zap.L().Warn("模型输出无法解析为教学内容 JSON",
		zap.Error(err),
		zap.Int("raw_len", len(raw)),
		zap.String("raw_head", truncateRunes(raw, 4000)),
	)
	snippet := summarizeRawOutput(raw, 240)
	if snippet == "" {
		return fmt.Errorf("%w；已自动尝试修复括号/逗号/注释/截断，仍无法解析，请点「重新生成」再试一次", err)
	}
	return fmt.Errorf(
		"%w；已自动尝试修复括号/逗号/注释/截断，仍无法解析。模型输出开头：%s…（完整原文已写入服务日志）",
		err, snippet,
	)
}

// summarizeRawOutput 把模型输出压成单行摘要（便于在界面上显示）。
func summarizeRawOutput(raw string, limit int) string {
	flat := strings.Join(strings.Fields(raw), " ")
	rs := []rune(flat)
	if len(rs) <= limit {
		return flat
	}
	return string(rs[:limit])
}

// truncateRunes 按字符（而非字节）截断，避免切断多字节字符。
func truncateRunes(s string, limit int) string {
	rs := []rune(s)
	if len(rs) <= limit {
		return s
	}
	return string(rs[:limit])
}

// ListContentVersions 返回某实验的全部内容版本。
func (s *ContentService) ListContentVersions(expID uint) ([]VersionView, error) {
	if s.versionSvc == nil {
		return nil, nil
	}
	return s.versionSvc.ListVersions(expID)
}

// ActivateContentVersion 切换某实验的生效版本（种子版 / AI 版）。
func (s *ContentService) ActivateContentVersion(expID uint, source string) error {
	if s.versionSvc == nil {
		return errors.New("版本服务未初始化")
	}
	return s.versionSvc.ActivateVersion(expID, source)
}

// AIAudioDirParts 返回 AI 版音频的目录层级（相对 audioDir）：<id>/<voice>/ai。
//
// 合成语音一律写这里：种子配音存放于 <id>/<voice>/，AI 配音存放于 <id>/<voice>/ai/，
// 两者互不覆盖，保证「种子文稿 ↔ 种子配音」「AI 文稿 ↔ AI 配音」始终一一对应。
func (s *ContentService) AIAudioDirParts(expID uint, voice string) []string {
	return []string{strconv.FormatUint(uint64(expID), 10), voice, model.ContentSourceAI}
}

// ActiveSource 返回某实验当前生效版本的来源（seed / ai），查不到时按种子版处理。
func (s *ContentService) ActiveSource(expID uint) string {
	if s.versionSvc == nil {
		return model.ContentSourceSeed
	}
	return s.versionSvc.ActiveSource(expID)
}
