package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/ai"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
)

// ContentVersionService 管理教学内容的版本存档（种子版 / AI 版共存）。
type ContentVersionService struct {
	db             *gorm.DB
	narrationRepo  *repository.NarrationRepo
	experimentRepo *repository.ExperimentRepo
}

func NewContentVersionService() *ContentVersionService {
	return &ContentVersionService{
		db:             repository.GetDB(),
		narrationRepo:  repository.NewNarrationRepo(),
		experimentRepo: repository.NewExperimentRepo(),
	}
}

// VersionView 是返回给前端的版本摘要（不含 payload 全文）。
type VersionView struct {
	ID           uint      `json:"id"`
	ExperimentID uint      `json:"experiment_id"`
	Source       string    `json:"source"`
	SourceLabel  string    `json:"source_label"`
	IsActive     bool      `json:"is_active"`
	ModelName    string    `json:"model_name"`
	Sections     int       `json:"sections"`
	Lines        int       `json:"lines"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func sourceLabel(src string) string {
	if src == model.ContentSourceSeed {
		return "种子版"
	}
	if src == model.ContentSourceAI {
		return "AI 版"
	}
	return src
}

// SaveVersion 幂等地写入某个来源的版本（同来源覆盖），并把 payload 应用为生效内容。
//
// active=true 时同步把 experiments + narrations 更新为该版本，保证渲染与音频链路一致。
func (s *ContentVersionService) SaveVersion(expID uint, source, modelName string, content *model.ExperimentContent, active bool) error {
	raw, err := json.Marshal(content)
	if err != nil {
		return err
	}

	var ver model.ContentVersion
	err = s.db.Where("experiment_id = ? AND source = ?", expID, source).First(&ver).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		ver = model.ContentVersion{ExperimentID: expID, Source: source}
	}
	ver.ModelName = modelName
	ver.Payload = string(raw)
	if ver.ID == 0 {
		if err := s.db.Create(&ver).Error; err != nil {
			return err
		}
	} else if err := s.db.Save(&ver).Error; err != nil {
		return err
	}

	if active {
		return s.ActivateVersion(expID, source)
	}
	return nil
}

// LoadVersionContent 读取某来源版本的存档并解析为教学内容。
// 该版本不存在或解析失败时返回错误。
func (s *ContentVersionService) LoadVersionContent(expID uint, source string) (*model.ExperimentContent, error) {
	var ver model.ContentVersion
	if err := s.db.Where("experiment_id = ? AND source = ?", expID, source).First(&ver).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("该实验还没有「%s」内容", sourceLabel(source))
		}
		return nil, err
	}
	var content model.ExperimentContent
	if err := json.Unmarshal([]byte(ver.Payload), &content); err != nil {
		return nil, fmt.Errorf("%s 版本内容解析失败: %w", sourceLabel(source), err)
	}
	return &content, nil
}

// ListVersions 返回某实验的所有版本摘要。
func (s *ContentVersionService) ListVersions(expID uint) ([]VersionView, error) {
	var vers []model.ContentVersion
	if err := s.db.Where("experiment_id = ?", expID).Order("source").Find(&vers).Error; err != nil {
		return nil, err
	}
	out := make([]VersionView, 0, len(vers))
	for i := range vers {
		v := &vers[i]
		sections, lines := 0, 0
		var c model.ExperimentContent
		if json.Unmarshal([]byte(v.Payload), &c) == nil {
			sections = len(c.Narration.Sections)
			for _, sec := range c.Narration.Sections {
				lines += len(sec.Lines)
			}
		}
		out = append(out, VersionView{
			ID:           v.ID,
			ExperimentID: v.ExperimentID,
			Source:       v.Source,
			SourceLabel:  sourceLabel(v.Source),
			IsActive:     v.IsActive,
			ModelName:    v.ModelName,
			Sections:     sections,
			Lines:        lines,
			UpdatedAt:    v.UpdatedAt,
		})
	}
	return out, nil
}

// ActivateVersion 把指定来源的版本设为生效内容：重写 experiments 的教学字段与 narrations 讲解稿。
//
// 这里自行落库（不依赖 ContentService），避免两个服务循环依赖。
func (s *ContentVersionService) ActivateVersion(expID uint, source string) error {
	var ver model.ContentVersion
	if err := s.db.Where("experiment_id = ? AND source = ?", expID, source).First(&ver).Error; err != nil {
		return fmt.Errorf("该实验还没有「%s」内容，无法切换", sourceLabel(source))
	}
	exp, err := s.experimentRepo.GetByID(expID)
	if err != nil {
		return errors.New("实验不存在")
	}
	var content model.ExperimentContent
	if err := json.Unmarshal([]byte(ver.Payload), &content); err != nil {
		return fmt.Errorf("版本内容解析失败: %w", err)
	}
	if err := s.applyContent(exp, source, &content); err != nil {
		return err
	}
	if err := s.db.Model(&model.ContentVersion{}).
		Where("experiment_id = ?", expID).
		Update("is_active", false).Error; err != nil {
		return err
	}
	return s.db.Model(&model.ContentVersion{}).
		Where("experiment_id = ? AND source = ?", expID, source).
		Update("is_active", true).Error
}

// applyContent 把一份教学内容写入 experiments（教学字段）与 narrations（讲解稿）。
func (s *ContentVersionService) applyContent(exp *model.Experiment, source string, content *model.ExperimentContent) error {
	fields := map[string]any{
		"content_status": "ready",
		"content_error":  "",
	}
	// generated_at 跟着版本走：种子版没有「AI 生成时间」，
	// 若不清空，切回种子版后界面仍会显示上一版 AI 的生成时间。
	if source == model.ContentSourceSeed {
		fields["generated_at"] = nil
	}
	// description 同样必须无条件写入：某版本简介为空时若跳过赋值，
	// 切换版本后会残留上一版的简介（与 graph / params_schema 同一类问题）。
	fields["description"] = strings.TrimSpace(content.Description)
	marshal := func(v any, fallback string) string {
		if raw, err := json.Marshal(v); err == nil {
			return string(raw)
		}
		return fallback
	}
	fields["formulas"] = marshal(content.Formulas, "[]")
	fields["history_info"] = marshal(content.HistoryInfo, "{}")
	fields["app_hooks"] = marshal(content.AppHooks, "[]")
	fields["prerequisites"] = marshal(content.Prerequisites, "[]")
	// graph 与 params_schema 必须「无条件」写入（为空也要写 = 清空）：
	// 种子版内容没有这两个字段，若只在非空时赋值，切换回种子版时就会残留
	// 上一版（AI 版）写入的值，导致 AI 图形遮挡种子渲染器
	//（种子的可视化由 viz_component 对应的 JS 组件绘制，与 graph 无关）。
	fields["graph"] = ""
	if len(content.Graph) > 0 {
		fields["graph"] = string(content.Graph)
	}
	fields["related_experiments"] = marshal(content.Related, "[]")
	fields["params_schema"] = "{}"
	if len(content.ParamsSchema) > 0 {
		fields["params_schema"] = marshal(content.ParamsSchema, "{}")
	}
	if err := s.experimentRepo.UpdateFields(exp.ID, fields); err != nil {
		return err
	}

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
				anim = marshal(line.Animation, "{}")
			} else if section.Title != "" {
				anim = fmt.Sprintf(`{"action":"highlight","params":{"section":%q}}`, section.Title)
			}
			// 音频 URL 按版本来源重建：种子版 <id>/<voice>/x.mp3，
			// AI 版 <id>/<voice>/ai/x.mp3。两版配音各自独立，切换版本即切换配音。
			audioPrefix := filepath.ToSlash(filepath.Join(strconv.FormatUint(uint64(exp.ID), 10), ai.VoiceYunxi))
			audioPrefixX := filepath.ToSlash(filepath.Join(strconv.FormatUint(uint64(exp.ID), 10), ai.VoiceXiaoxiao))
			if source == model.ContentSourceAI {
				audioPrefix += "/ai"
				audioPrefixX += "/ai"
			}
			rows = append(rows, model.Narration{
				SectionID:     sectionID,
				SectionTitle:  section.Title,
				LineIndex:     index,
				LineID:        lineID,
				Text:          text,
				AnimationCfg:  anim,
				AudioYunxi:    fmt.Sprintf("/audio/%s/%s.mp3", audioPrefix, lineID),
				AudioXiaoxiao: fmt.Sprintf("/audio/%s/%s.mp3", audioPrefixX, lineID),
			})
			index++
		}
	}
	// 必须无条件调用：ReplaceForExperiment 内部会先删除该实验的全部旧行，
	// 再写入新行。若因 rows 为空而跳过调用，上一版（行数更多）的讲解稿
	// 就会残留 —— 这正是「文稿与音频必须一一对应」被破坏的根源。
	if err := s.narrationRepo.ReplaceForExperiment(exp.ID, rows); err != nil {
		return err
	}
	return nil
}

// IsEmptyPayload 判断版本是否为空（种子尚未写入时使用）。
func IsEmptyPayload(payload string) bool {
	t := strings.TrimSpace(payload)
	return t == "" || t == "{}" || t == "null"
}

// MarkActive 只更新生效标记，不重写 experiments / narrations（内容已是该版本时使用）。
func (s *ContentVersionService) MarkActive(expID uint, source string) error {
	if err := s.db.Model(&model.ContentVersion{}).
		Where("experiment_id = ?", expID).
		Update("is_active", false).Error; err != nil {
		return err
	}
	return s.db.Model(&model.ContentVersion{}).
		Where("experiment_id = ? AND source = ?", expID, source).
		Update("is_active", true).Error
}

// EnsureSeedVersion 为尚无种子版本的实验，从当前库内容导出并写入「种子版」存档。
//
// 目的是让 AI 生成之前的原始教学内容有据可查，从而支持切回种子版。
// 已存在种子版时直接跳过（幂等）。
func (s *ContentVersionService) EnsureSeedVersion(expID uint) error {
	var count int64
	if err := s.db.Model(&model.ContentVersion{}).
		Where("experiment_id = ? AND source = ?", expID, model.ContentSourceSeed).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := s.createSeedVersion(expID)
	return err
}

// createSeedVersion 从当前库状态快照一份「种子版」存档。
func (s *ContentVersionService) createSeedVersion(expID uint) (*model.ContentVersion, error) {
	payload, err := s.buildSeedPayload(expID)
	if err != nil {
		return nil, err
	}
	ver := model.ContentVersion{
		ExperimentID: expID,
		Source:       model.ContentSourceSeed,
		Payload:      payload,
		IsActive:     true,
	}
	if err := s.db.Create(&ver).Error; err != nil {
		return nil, err
	}
	return &ver, nil
}

// buildSeedPayload 按当前 experiments / narrations 组装种子版存档 JSON（不落库）。
func (s *ContentVersionService) buildSeedPayload(expID uint) (string, error) {
	exp, err := s.experimentRepo.GetByID(expID)
	if err != nil {
		return "", err
	}
	narrations, err := s.narrationRepo.ListByExperiment(expID)
	if err != nil {
		return "", err
	}

	// 从当前库状态组装一份 ExperimentContent（与原 ExperimentContent JSON 结构一致）
	content := model.ExperimentContent{
		Description: exp.Description,
	}
	if exp.Formulas != "" {
		_ = json.Unmarshal([]byte(exp.Formulas), &content.Formulas)
	}
	if exp.HistoryInfo != "" {
		_ = json.Unmarshal([]byte(exp.HistoryInfo), &content.HistoryInfo)
	}
	if exp.AppHooks != "" {
		_ = json.Unmarshal([]byte(exp.AppHooks), &content.AppHooks)
	}
	if exp.ParamsSchema != "" {
		_ = json.Unmarshal([]byte(exp.ParamsSchema), &content.ParamsSchema)
	}
	if exp.Graph != "" {
		content.Graph = json.RawMessage(exp.Graph)
	}
	if exp.Prerequisites != "" {
		_ = json.Unmarshal([]byte(exp.Prerequisites), &content.Prerequisites)
	}
	if exp.RelatedExperiments != "" {
		_ = json.Unmarshal([]byte(exp.RelatedExperiments), &content.Related)
	}

	// 讲解稿按 section 归组
	type sec struct {
		id    string
		title string
		lines []model.NarrationLine
	}
	order := make([]string, 0, 8)
	byID := map[string]*sec{}
	for i := range narrations {
		n := &narrations[i]
		item, ok := byID[n.SectionID]
		if !ok {
			item = &sec{id: n.SectionID, title: n.SectionTitle}
			byID[n.SectionID] = item
			order = append(order, n.SectionID)
		}
		item.lines = append(item.lines, model.NarrationLine{ID: n.LineID, Text: n.Text})
	}
	for _, id := range order {
		item := byID[id]
		content.Narration.Sections = append(content.Narration.Sections, model.NarrationSection{
			ID: item.id, Title: item.title, Lines: item.lines,
		})
	}

	payload, err := json.Marshal(content)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

// BackfillEmptySeedNarrations 修复「种子版存档里的文稿是空的」这类残留存档。
//
// 背景（真实缺陷）：种子版基线是「启动时快照」且只建一次，而 600 个展项的稿件是
// 分批进入内置种子文件的。若某次启动时某展项的稿件还没进种子，快照就会把
// 「空文稿」永久固化 —— 之后稿件补齐了，narrations 表有台词，但种子版存档仍是空的，
// 前端「📄 文稿（种子版）」于是显示不出来（AI 版还没生成，等于该展项完全没稿）。
//
// 因此这里做一次自愈：只挑「种子版存档文稿为空、而当前 narrations 确有台词」的实验，
// 用最近一次种子导入后的库内容重建存档；已有文稿的存档（含用户/AI 修改过的）一律不动。
// 幂等：修好之后再跑不会有任何改动。
//
// 注意有意的取舍：若该实验的 narrations 已被 AI 版覆盖并生效，回填会把 AI 台词写进
// 种子版存档。这种情况只会发生在本就没有任何稿件的展项上（空基线），
// 而「有稿」比「严格保留空快照」有用得多。
//
// 代价受控：先用一条 SQL 粗筛出「payload 里没有台词」的候选，再逐个精确解析，
// 因此正常库（全都有稿）每次启动只多一次很便宜的查询。
func (s *ContentVersionService) BackfillEmptySeedNarrations() (int, error) {
	var vers []model.ContentVersion
	if err := s.db.
		Where("source = ?", model.ContentSourceSeed).
		Where("payload IS NULL OR trim(payload) = '' OR instr(payload, ?) = 0 OR instr(payload, ?) = 0",
			`"narration"`, `"lines"`).
		Find(&vers).Error; err != nil {
		return 0, err
	}

	fixed := 0
	for i := range vers {
		v := &vers[i]
		if seedPayloadNarrationLines(v.Payload) > 0 {
			continue // 存档里已有文稿，不动
		}
		// 没有台词可回填时保持原样，避免把存档越改越差
		var count int64
		if err := s.db.Model(&model.Narration{}).
			Where("experiment_id = ?", v.ExperimentID).Count(&count).Error; err != nil {
			continue
		}
		if count == 0 {
			continue
		}

		fresh, err := s.buildSeedPayload(v.ExperimentID)
		if err != nil {
			continue
		}
		if seedPayloadNarrationLines(fresh) == 0 {
			continue // 重建出来依旧没稿（异常中间态）：保留原存档
		}
		if err := s.db.Model(&model.ContentVersion{}).
			Where("id = ?", v.ID).
			Updates(map[string]any{"payload": fresh, "updated_at": time.Now()}).Error; err != nil {
			return fixed, err
		}
		fixed++
	}
	return fixed, nil
}

// seedPayloadNarrationLines 统计种子版存档 payload 里的台词行数。
// payload 为空或解析失败一律按 0 处理（视为「没有文稿」）。
func seedPayloadNarrationLines(payload string) int {
	if strings.TrimSpace(payload) == "" {
		return 0
	}
	var content model.ExperimentContent
	if err := json.Unmarshal([]byte(payload), &content); err != nil {
		return 0
	}
	lines := 0
	for _, section := range content.Narration.Sections {
		lines += len(section.Lines)
	}
	return lines
}

// EnsureAllSeedVersions 为库中所有实验补齐「种子版」基线（幂等，已存在则跳过）。
//
// 返回本次新增的版本数。首次启动时会把当前库中的教学内容快照为种子版，
// 之后 AI 生成的内容作为独立版本存档，两者互不覆盖。
func (s *ContentVersionService) EnsureAllSeedVersions() (int, error) {
	var ids []uint
	if err := s.experimentRepo.AllIDs(&ids); err != nil {
		return 0, err
	}
	created := 0
	for _, id := range ids {
		// 已有任意版本说明该实验已建档，跳过（避免覆盖已存档的种子版）
		var count int64
		if err := s.db.Model(&model.ContentVersion{}).
			Where("experiment_id = ?", id).Count(&count).Error; err != nil {
			continue
		}
		if count > 0 {
			continue
		}
		if err := s.EnsureSeedVersion(id); err != nil {
			continue
		}
		created++
	}
	return created, nil
}

// ActiveSource 返回某实验当前生效版本的来源（seed / ai）。
func (s *ContentVersionService) ActiveSource(expID uint) string {
	var ver model.ContentVersion
	if err := s.db.Where("experiment_id = ? AND is_active = ?", expID, true).First(&ver).Error; err == nil {
		return ver.Source
	}
	return model.ContentSourceSeed
}
