// Package seed 提供《架构设计.md》定义的实验目录种子数据。
//
// 目录由 cmd/seedgen 从架构文档自动提取（见 internal/seed/data/experiments.json），
// 通过 go:embed 嵌入二进制，保证离线初始化与可重复执行。
package seed

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

// 目录数据分文件维护（物理之美重建版；原数学清单与定理文件归档于 internal/seed/legacy/）：
//   - experiments.json     物理展项与分类目录（主批 45 展项）
//   - experiments-b.json   滚动扩充批次 B（+67 展项）
//   - experiments-c.json   滚动扩充批次 C（+73 展项）
//   - experiments-d.json   滚动扩充批次 D（+75 展项，展项向 600 推进）
//   - experiments-e.json   滚动扩充批次 E（+70 展项：天体观测 + 经典实验复现）
//   - experiments-f.json   滚动扩充批次 F（+68 展项：生物物理与医学成像 + 材料科学）
//   - experiments-g.json   滚动扩充批次 G（+68 展项：开放问题与科学史 + 基础分类补缺）
//   - experiments-h.json   滚动扩充批次 H（+67 展项：考研核心专题）
//   - experiments-i.json   滚动扩充批次 I（+67 展项：数学物理方法，总数达 600）
//
//go:embed data/experiments.json
//go:embed data/experiments-b.json
//go:embed data/experiments-c.json
//go:embed data/experiments-d.json
//go:embed data/experiments-e.json
//go:embed data/experiments-f.json
//go:embed data/experiments-g.json
//go:embed data/experiments-h.json
//go:embed data/experiments-i.json
var catalogFS embed.FS

// catalogFiles 是参与合并的目录文件（顺序即合并顺序）。
var catalogFiles = []string{
	"data/experiments.json",
	"data/experiments-b.json",
	"data/experiments-c.json",
	"data/experiments-d.json",
	"data/experiments-e.json",
	"data/experiments-f.json",
	"data/experiments-g.json",
	"data/experiments-h.json",
	"data/experiments-i.json",
}

// Category 是种子分类。
type Category struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Level       string `json:"level"`
	OrderIndex  int    `json:"order_index"`
	Description string `json:"description"`
	ThemeSlug   string `json:"theme_slug"` // 所属板块（themes.json）
}

// Experiment 是种子实验条目。
type Experiment struct {
	Number       string `json:"number"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	CategorySlug string `json:"category_slug"`
	Difficulty   string `json:"difficulty"`
	Level        string `json:"level"`
	Description  string `json:"description"`
	Concept      string `json:"concept"`
	VizComponent string `json:"viz_component"`
	// Certainty 可选：五级确定性标签，缺省为 theory-supported（教学仿真默认是理论模型）
	Certainty string `json:"certainty"`
}

// Catalog 是完整的种子目录。
type Catalog struct {
	Categories  []Category     `json:"categories"`
	Experiments []Experiment   `json:"experiments"`
	Stats       map[string]int `json:"stats"`
}

// Result 汇总一次初始化的结果。
type Result struct {
	Categories         int `json:"categories"`
	ExperimentsCreated int `json:"experiments_created"`
	ExperimentsUpdated int `json:"experiments_updated"`
	Total              int `json:"total"`
}

// Load 解析并合并内嵌的全部目录数据。
func Load() (*Catalog, error) {
	var c Catalog
	for _, name := range catalogFiles {
		data, err := catalogFS.ReadFile(name)
		if err != nil {
			continue // 允许可选文件缺失（后续批次尚未创建）
		}
		var one Catalog
		if err := json.Unmarshal(data, &one); err != nil {
			return nil, fmt.Errorf("解析内嵌目录 %s 失败: %w", name, err)
		}
		c.Categories = append(c.Categories, one.Categories...)
		c.Experiments = append(c.Experiments, one.Experiments...)
	}
	if len(c.Experiments) == 0 {
		return nil, fmt.Errorf("内嵌目录为空，请检查 internal/seed/data 下的种子文件")
	}
	return &c, nil
}

// Apply 幂等地把目录写入数据库。
//
// 分类按 slug 更新；实验按 slug 更新"目录字段"（标题/编号/难度/概念/可视化组件等），
// 已经由 AI 生成的教学内容（描述、公式、历史、讲解）不会被覆盖。
func Apply(db *gorm.DB) (*Result, error) {
	catalog, err := Load()
	if err != nil {
		return nil, err
	}
	res := &Result{}

	// 板块 slug→ID（themes 须先由 applyThemes 写入，见 ApplyWithTx）
	themeIDBySlug := map[string]uint{}
	var themeRows []model.Theme
	if err := db.Find(&themeRows).Error; err != nil {
		return nil, fmt.Errorf("查询板块失败: %w", err)
	}
	for _, t := range themeRows {
		themeIDBySlug[t.Slug] = t.ID
	}
	catThemeID := map[string]uint{} // 分类 slug → 板块 ID（供展项挂靠）

	catIDBySlug := map[string]uint{}
	for _, c := range catalog.Categories {
		// 兼容旧分类：若历史数据使用被本方案重命名的 slug，这里不处理，
		// 仅按 slug upsert，避免破坏已有引用。
		cat := model.Category{
			Name:        c.Name,
			Slug:        c.Slug,
			Level:       c.Level,
			OrderIndex:  c.OrderIndex,
			Description: c.Description,
			ThemeID:     themeIDBySlug[c.ThemeSlug],
		}
		var existing model.Category
		err := db.Where("slug = ?", c.Slug).First(&existing).Error
		switch {
		case err == nil:
			existing.Name = cat.Name
			existing.Level = cat.Level
			existing.OrderIndex = cat.OrderIndex
			existing.Description = cat.Description
			existing.ThemeID = cat.ThemeID
			if err := db.Save(&existing).Error; err != nil {
				return nil, fmt.Errorf("更新分类 %s 失败: %w", c.Slug, err)
			}
			catIDBySlug[c.Slug] = existing.ID
			catThemeID[c.Slug] = existing.ThemeID
		case err == gorm.ErrRecordNotFound:
			if err := db.Create(&cat).Error; err != nil {
				return nil, fmt.Errorf("创建分类 %s 失败: %w", c.Slug, err)
			}
			catIDBySlug[c.Slug] = cat.ID
			catThemeID[c.Slug] = cat.ThemeID
		default:
			return nil, fmt.Errorf("查询分类 %s 失败: %w", c.Slug, err)
		}
		res.Categories++
	}

	now := time.Now()
	for _, e := range catalog.Experiments {
		catID, ok := catIDBySlug[e.CategorySlug]
		if !ok {
			return nil, fmt.Errorf("实验 %s 引用了未知分类 %s", e.Slug, e.CategorySlug)
		}

		var existing model.Experiment
		err := db.Where("slug = ?", e.Slug).First(&existing).Error
		switch {
		case err == gorm.ErrRecordNotFound:
			certainty := e.Certainty
			if certainty == "" {
				certainty = "theory-supported" // 教学仿真默认：由理论模型驱动
			}
			exp := model.Experiment{
				Slug:          e.Slug,
				Title:         e.Title,
				Number:        e.Number,
				Concept:       e.Concept,
				CategoryID:    catID,
				ThemeID:       catThemeID[e.CategorySlug],
				Difficulty:    e.Difficulty,
				Level:         e.Level,
				Description:   e.Description,
				VizComponent:  e.VizComponent,
				Certainty:     certainty,
				ParamsSchema:  "{}",
				Formulas:      "[]",
				HistoryInfo:   "{}",
				AppHooks:      "[]",
				Prerequisites: "[]",
				ContentStatus: "pending",
			}
			if err := db.Create(&exp).Error; err != nil {
				return nil, fmt.Errorf("创建实验 %s 失败: %w", e.Slug, err)
			}
			res.ExperimentsCreated++
		case err != nil:
			return nil, fmt.Errorf("查询实验 %s 失败: %w", e.Slug, err)
		default:
			// 只刷新目录字段，保留 AI 生成内容。
			updates := map[string]any{
				"title":         e.Title,
				"number":        e.Number,
				"concept":       e.Concept,
				"category_id":   catID,
				"theme_id":      catThemeID[e.CategorySlug],
				"difficulty":    e.Difficulty,
				"level":         e.Level,
				"viz_component": e.VizComponent,
				"updated_at":    now,
			}
			if e.Certainty != "" {
				updates["certainty"] = e.Certainty
			}
			if strings.TrimSpace(existing.Description) == "" {
				updates["description"] = e.Description
			}
			if err := db.Model(&model.Experiment{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
				return nil, fmt.Errorf("更新实验 %s 失败: %w", e.Slug, err)
			}
			res.ExperimentsUpdated++
		}
	}
	res.Total = len(catalog.Experiments)
	return res, nil
}

// ApplyWithTx 在事务中应用目录（失败时不留下半成品数据）。
//
// 顺序保证：板块（themes）→ 分类/展项 → 尺度锚点 → 物理学家/里程碑（依赖前序 ID）。
func ApplyWithTx(db *gorm.DB) (*Result, error) {
	var res *Result
	err := db.Transaction(func(tx *gorm.DB) error {
		if _, err := applyThemes(tx); err != nil {
			return err
		}
		r, err := Apply(tx)
		if err != nil {
			return err
		}
		res = r
		if err := applyScaleNodes(tx); err != nil {
			return err
		}
		if err := applyAssets(tx); err != nil {
			return err
		}
		return applyPhysicsEntities(tx)
	})
	return res, err
}
