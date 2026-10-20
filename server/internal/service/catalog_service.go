package service

import (
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"gorm.io/gorm"
)

// CatalogService 提供物理之美板块 / 尺度轴 / 里程碑 / 物理学家的查询（《架构设计.md》§8）。
type CatalogService struct {
	db *gorm.DB
}

func NewCatalogService() *CatalogService {
	return &CatalogService{db: repository.GetDB()}
}

// ListThemes 返回全部板块（按 order_index）。
func (s *CatalogService) ListThemes() ([]model.Theme, error) {
	var themes []model.Theme
	err := s.db.Order("order_index ASC, id ASC").Find(&themes).Error
	return themes, err
}

// ListScaleNodes 返回尺度轴锚点；axis 为空时返回全部轴。
func (s *CatalogService) ListScaleNodes(axis string) ([]model.ScaleNode, error) {
	q := s.db
	if axis != "" {
		q = q.Where("axis = ?", axis)
	}
	var nodes []model.ScaleNode
	err := q.Order("scale_value ASC").Find(&nodes).Error
	return nodes, err
}

// MilestoneQuery 里程碑列表筛选条件。
type MilestoneQuery struct {
	Kind       string
	ThemeSlug  string
	Difficulty string
	Q          string
	Page       int
	PageSize   int
}

// ListMilestones 分页查询里程碑（按年代升序，附关联人物与展项）。
func (s *CatalogService) ListMilestones(mq MilestoneQuery) ([]model.Milestone, int64, error) {
	q := s.db.Model(&model.Milestone{})
	if mq.Kind != "" {
		q = q.Where("kind = ?", mq.Kind)
	}
	if mq.Difficulty != "" {
		q = q.Where("difficulty = ?", mq.Difficulty)
	}
	if mq.ThemeSlug != "" {
		q = q.Where("theme_id IN (SELECT id FROM themes WHERE slug = ?)", mq.ThemeSlug)
	}
	if mq.Q != "" {
		term := "%" + mq.Q + "%"
		q = q.Where("title LIKE ? OR statement LIKE ? OR impact LIKE ?", term, term, term)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (mq.Page - 1) * mq.PageSize
	var list []model.Milestone
	err := q.Preload("Figures").Preload("Experiments").
		Order("year ASC, order_index ASC").Offset(offset).Limit(mq.PageSize).Find(&list).Error
	return list, total, err
}

// GetMilestone 按 slug 查询里程碑详情。
func (s *CatalogService) GetMilestone(slug string) (*model.Milestone, error) {
	var m model.Milestone
	err := s.db.Preload("Figures").Preload("Experiments").
		Where("slug = ?", slug).First(&m).Error
	return &m, err
}

// ListAssets 返回素材元数据；kind/q 支持类型与关键词筛选。
func (s *CatalogService) ListAssets(kind, q string) ([]model.Asset, error) {
	db := s.db
	if kind != "" {
		db = db.Where("kind = ?", kind)
	}
	if q != "" {
		term := "%" + q + "%"
		db = db.Where("title LIKE ? OR description LIKE ? OR source_org LIKE ?", term, term, term)
	}
	var list []model.Asset
	err := db.Order("kind ASC, year DESC, id ASC").Find(&list).Error
	return list, err
}

// GetAsset 按 slug 查询素材元数据。
func (s *CatalogService) GetAsset(slug string) (*model.Asset, error) {
	var a model.Asset
	err := s.db.Where("slug = ?", slug).First(&a).Error
	return &a, err
}

// ListFigures 返回物理学家（按生年）；q 支持姓名/贡献模糊搜索。
func (s *CatalogService) ListFigures(q string) ([]model.Figure, error) {
	db := s.db
	if q != "" {
		term := "%" + q + "%"
		db = db.Where("name LIKE ? OR name_en LIKE ? OR contribution LIKE ?", term, term, term)
	}
	var list []model.Figure
	err := db.Order("born ASC, id ASC").Find(&list).Error
	return list, err
}

// GetFigure 按 slug 查询人物详情（附关联里程碑）。
func (s *CatalogService) GetFigure(slug string) (*model.Figure, error) {
	var f model.Figure
	err := s.db.Preload("Milestones").Where("slug = ?", slug).First(&f).Error
	return &f, err
}

// MilestoneScript 是里程碑讲解稿件（结构对齐 NarrationScript，顶层键 milestone_id）。
type MilestoneScript struct {
	MilestoneID   uint            `json:"milestone_id"`
	Slug          string          `json:"slug"`
	Title         string          `json:"title"`
	TotalLines    int             `json:"total_lines"`
	TotalDuration int             `json:"total_duration_ms"`
	HasAudio      bool            `json:"has_audio"`
	Sections      []ScriptSection `json:"sections"`
}

// GetMilestoneScript 按里程碑 slug 组装讲解稿件；无稿件返回空结构（total_lines=0，前端据此提示）。
func (s *CatalogService) GetMilestoneScript(slug string) (*MilestoneScript, error) {
	var m model.Milestone
	if err := s.db.Where("slug = ?", slug).First(&m).Error; err != nil {
		return nil, err
	}
	var rows []model.MilestoneNarration
	if err := s.db.Where("milestone_id = ?", m.ID).Order("line_index ASC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	script := &MilestoneScript{
		MilestoneID: m.ID,
		Slug:        m.Slug,
		Title:       m.Title,
		Sections:    []ScriptSection{},
	}
	secIdx := map[string]int{}
	for _, n := range rows {
		sid := n.SectionID
		if sid == "" {
			sid = "content"
		}
		title := n.SectionTitle
		if title == "" {
			title = sectionTitleFallback(sid)
		}
		if _, ok := secIdx[sid]; !ok {
			secIdx[sid] = len(script.Sections)
			script.Sections = append(script.Sections, ScriptSection{ID: sid, Title: title, Lines: []ScriptLine{}})
		}
		i := secIdx[sid]
		script.Sections[i].Lines = append(script.Sections[i].Lines, ScriptLine{
			ID: n.ID, SectionID: sid, LineID: n.LineID, LineIndex: n.LineIndex,
			Text: n.Text, AudioYunxi: n.AudioYunxi, AudioXiaoxiao: n.AudioXiaoxiao,
			DurationMs: n.DurationMs, Animation: map[string]any{},
		})
		script.TotalLines++
		script.TotalDuration += n.DurationMs
		if n.AudioYunxi != "" || n.AudioXiaoxiao != "" {
			script.HasAudio = true
		}
	}
	return script, nil
}
