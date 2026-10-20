package seed

import (
	"embed"
	"encoding/json"
	"fmt"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

// 物理之美新增种子（《架构设计.md》§7.1/§4）：
//   - themes.json        10 个知识板块
//   - scale_nodes.json   尺度轴锚点（长度/时间/速度）
//   - figures.json       物理学家
//   - milestones.json    里程碑（定律/公式/发明/关键实验）
//
//go:embed data/themes.json
//go:embed data/scale_nodes.json
//go:embed data/figures.json
//go:embed data/figures-b.json
//go:embed data/figures-c.json
//go:embed data/figures-d.json
//go:embed data/milestones.json
//go:embed data/milestones-b.json
//go:embed data/milestones-c.json
//go:embed data/milestones-d.json
//go:embed data/assets.json
var physicsFS embed.FS

type themeSeed struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	OrderIndex  int    `json:"order_index"`
}

type scaleNodeSeed struct {
	Axis        string  `json:"axis"`
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	ScaleValue  float64 `json:"scale_value"`
	Description string  `json:"description"`
	OrderIndex  int     `json:"order_index"`
}

type figureSeed struct {
	Slug         string `json:"slug"`
	Name         string `json:"name"`
	NameEn       string `json:"name_en"`
	Born         int    `json:"born"`
	Died         int    `json:"died"`
	Nationality  string `json:"nationality"`
	Contribution string `json:"contribution"`
	Nobel        string `json:"nobel"`
	Bio          string `json:"bio"`
}

type milestoneSeed struct {
	Slug            string   `json:"slug"`
	Kind            string   `json:"kind"`
	Title           string   `json:"title"`
	Year            int      `json:"year"`
	Statement       string   `json:"statement"`
	Latex           string   `json:"latex"`
	Meaning         string   `json:"meaning"`
	Conditions      string   `json:"conditions"`
	Impact          string   `json:"impact"`
	SourceRef       string   `json:"source_ref"`
	Certainty       string   `json:"certainty"`
	Difficulty      string   `json:"difficulty"`
	Level           string   `json:"level"`
	ThemeSlug       string   `json:"theme_slug"`
	OrderIndex      int      `json:"order_index"`
	FigureSlugs     []string `json:"figure_slugs"`
	ExperimentSlugs []string `json:"experiment_slugs"`
}

type assetSeed struct {
	Slug        string   `json:"slug"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	RelPath     string   `json:"rel_path"`
	SourceOrg   string   `json:"source_org"`
	SourceURL   string   `json:"source_url"`
	License     string   `json:"license"`
	Credit      string   `json:"credit"`
	Year        int      `json:"year"`
	Certainty   string   `json:"certainty"`
	ScaleValue  *float64 `json:"scale_value"`
}

func readPhysicsJSON(name string, out any) error {
	data, err := physicsFS.ReadFile(name)
	if err != nil {
		return fmt.Errorf("读取物理种子 %s 失败: %w", name, err)
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("解析物理种子 %s 失败: %w", name, err)
	}
	return nil
}

// applyThemes 幂等写入板块，返回 slug→ID 映射。
func applyThemes(db *gorm.DB) (map[string]uint, error) {
	var wrapper struct {
		Themes []themeSeed `json:"themes"`
	}
	if err := readPhysicsJSON("data/themes.json", &wrapper); err != nil {
		return nil, err
	}
	ids := map[string]uint{}
	for _, t := range wrapper.Themes {
		var existing model.Theme
		err := db.Where("slug = ?", t.Slug).First(&existing).Error
		switch {
		case err == nil:
			existing.Name = t.Name
			existing.Description = t.Description
			existing.OrderIndex = t.OrderIndex
			if err := db.Save(&existing).Error; err != nil {
				return nil, fmt.Errorf("更新板块 %s 失败: %w", t.Slug, err)
			}
			ids[t.Slug] = existing.ID
		case err == gorm.ErrRecordNotFound:
			theme := model.Theme{Slug: t.Slug, Name: t.Name, Description: t.Description, OrderIndex: t.OrderIndex}
			if err := db.Create(&theme).Error; err != nil {
				return nil, fmt.Errorf("创建板块 %s 失败: %w", t.Slug, err)
			}
			ids[t.Slug] = theme.ID
		default:
			return nil, fmt.Errorf("查询板块 %s 失败: %w", t.Slug, err)
		}
	}
	return ids, nil
}

// applyScaleNodes 幂等写入尺度轴锚点。
func applyScaleNodes(db *gorm.DB) error {
	var wrapper struct {
		Nodes []scaleNodeSeed `json:"nodes"`
	}
	if err := readPhysicsJSON("data/scale_nodes.json", &wrapper); err != nil {
		return err
	}
	for _, n := range wrapper.Nodes {
		var existing model.ScaleNode
		err := db.Where("slug = ?", n.Slug).First(&existing).Error
		switch {
		case err == nil:
			existing.Axis = n.Axis
			existing.Name = n.Name
			existing.ScaleValue = n.ScaleValue
			existing.Description = n.Description
			existing.OrderIndex = n.OrderIndex
			if err := db.Save(&existing).Error; err != nil {
				return fmt.Errorf("更新尺度节点 %s 失败: %w", n.Slug, err)
			}
		case err == gorm.ErrRecordNotFound:
			node := model.ScaleNode{
				Axis: n.Axis, Slug: n.Slug, Name: n.Name, ScaleValue: n.ScaleValue,
				Description: n.Description, OrderIndex: n.OrderIndex,
			}
			if err := db.Create(&node).Error; err != nil {
				return fmt.Errorf("创建尺度节点 %s 失败: %w", n.Slug, err)
			}
		default:
			return fmt.Errorf("查询尺度节点 %s 失败: %w", n.Slug, err)
		}
	}
	return nil
}

// applyAssets 幂等写入素材资产元数据（文件本体位于 data/assets/，由归档或人工采集）。
func applyAssets(db *gorm.DB) error {
	var wrapper struct {
		Assets []assetSeed `json:"assets"`
	}
	if err := readPhysicsJSON("data/assets.json", &wrapper); err != nil {
		return err
	}
	for _, a := range wrapper.Assets {
		var existing model.Asset
		err := db.Where("slug = ?", a.Slug).First(&existing).Error
		switch {
		case err == nil:
			existing.Kind = a.Kind
			existing.Title = a.Title
			existing.Description = a.Description
			existing.RelPath = a.RelPath
			existing.SourceOrg = a.SourceOrg
			existing.SourceURL = a.SourceURL
			existing.License = a.License
			existing.Credit = a.Credit
			existing.Year = a.Year
			existing.Certainty = a.Certainty
			existing.ScaleValue = a.ScaleValue
			if err := db.Save(&existing).Error; err != nil {
				return fmt.Errorf("更新素材 %s 失败: %w", a.Slug, err)
			}
		case err == gorm.ErrRecordNotFound:
			asset := model.Asset{
				Slug: a.Slug, Kind: a.Kind, Title: a.Title, Description: a.Description,
				RelPath: a.RelPath, SourceOrg: a.SourceOrg, SourceURL: a.SourceURL,
				License: a.License, Credit: a.Credit, Year: a.Year,
				Certainty: a.Certainty, ScaleValue: a.ScaleValue,
			}
			if err := db.Create(&asset).Error; err != nil {
				return fmt.Errorf("创建素材 %s 失败: %w", a.Slug, err)
			}
		default:
			return fmt.Errorf("查询素材 %s 失败: %w", a.Slug, err)
		}
	}
	return nil
}

// applyPhysicsEntities 幂等写入物理学家与里程碑（含关联）。
func applyPhysicsEntities(db *gorm.DB) error {
	var figWrapper struct {
		Figures []figureSeed `json:"figures"`
	}
	// 分批加载：第一批 37 位 + 第二批 22 位 + 第三批 17 位 + 第四批 16 位
	for _, name := range []string{"data/figures.json", "data/figures-b.json", "data/figures-c.json", "data/figures-d.json"} {
		var w struct {
			Figures []figureSeed `json:"figures"`
		}
		if err := readPhysicsJSON(name, &w); err != nil {
			return err
		}
		figWrapper.Figures = append(figWrapper.Figures, w.Figures...)
	}
	figIDBySlug := map[string]uint{}
	for _, f := range figWrapper.Figures {
		var existing model.Figure
		err := db.Where("slug = ?", f.Slug).First(&existing).Error
		switch {
		case err == nil:
			existing.Name = f.Name
			existing.NameEn = f.NameEn
			existing.Born = f.Born
			existing.Died = f.Died
			existing.Nationality = f.Nationality
			existing.Contribution = f.Contribution
			existing.Nobel = f.Nobel
			existing.Bio = f.Bio
			if err := db.Save(&existing).Error; err != nil {
				return fmt.Errorf("更新物理学家 %s 失败: %w", f.Slug, err)
			}
			figIDBySlug[f.Slug] = existing.ID
		case err == gorm.ErrRecordNotFound:
			fig := model.Figure{
				Slug: f.Slug, Name: f.Name, NameEn: f.NameEn, Born: f.Born, Died: f.Died,
				Nationality: f.Nationality, Contribution: f.Contribution, Nobel: f.Nobel, Bio: f.Bio,
			}
			if err := db.Create(&fig).Error; err != nil {
				return fmt.Errorf("创建物理学家 %s 失败: %w", f.Slug, err)
			}
			figIDBySlug[f.Slug] = fig.ID
		default:
			return fmt.Errorf("查询物理学家 %s 失败: %w", f.Slug, err)
		}
	}

	// 板块 slug→ID（里程碑 theme_id）
	themeIDBySlug := map[string]uint{}
	var themes []model.Theme
	if err := db.Find(&themes).Error; err != nil {
		return fmt.Errorf("查询板块失败: %w", err)
	}
	for _, t := range themes {
		themeIDBySlug[t.Slug] = t.ID
	}

	var msWrapper struct {
		Milestones []milestoneSeed `json:"milestones"`
	}
	// 分批加载：第一批 32 条 + 第二批 34 条 + 第三批 34 条 + 第四批 20 条
	for _, name := range []string{"data/milestones.json", "data/milestones-b.json", "data/milestones-c.json", "data/milestones-d.json"} {
		var w struct {
			Milestones []milestoneSeed `json:"milestones"`
		}
		if err := readPhysicsJSON(name, &w); err != nil {
			return err
		}
		msWrapper.Milestones = append(msWrapper.Milestones, w.Milestones...)
	}
	for _, m := range msWrapper.Milestones {
		var existing model.Milestone
		err := db.Where("slug = ?", m.Slug).First(&existing).Error
		row := model.Milestone{
			Slug: m.Slug, Kind: m.Kind, Title: m.Title, Year: m.Year,
			Statement: m.Statement, Latex: m.Latex, Meaning: m.Meaning, Conditions: m.Conditions,
			Impact: m.Impact, SourceRef: m.SourceRef, Certainty: m.Certainty,
			Difficulty: m.Difficulty, Level: m.Level, ThemeID: themeIDBySlug[m.ThemeSlug],
			ReviewStatus: "published", OrderIndex: m.OrderIndex,
		}
		var milestone model.Milestone
		switch {
		case err == nil:
			row.ID = existing.ID
			milestone = row
			if err := db.Save(&milestone).Error; err != nil {
				return fmt.Errorf("更新里程碑 %s 失败: %w", m.Slug, err)
			}
		case err == gorm.ErrRecordNotFound:
			milestone = row
			if err := db.Create(&milestone).Error; err != nil {
				return fmt.Errorf("创建里程碑 %s 失败: %w", m.Slug, err)
			}
		default:
			return fmt.Errorf("查询里程碑 %s 失败: %w", m.Slug, err)
		}

		// 关联物理学家
		var figs []model.Figure
		for _, fs := range m.FigureSlugs {
			if id, ok := figIDBySlug[fs]; ok {
				figs = append(figs, model.Figure{ID: id})
			}
		}
		if err := db.Model(&milestone).Association("Figures").Replace(figs); err != nil {
			return fmt.Errorf("关联里程碑 %s 人物失败: %w", m.Slug, err)
		}

		// 关联展项
		var exps []model.Experiment
		for _, es := range m.ExperimentSlugs {
			var exp model.Experiment
			if err := db.Where("slug = ?", es).First(&exp).Error; err == nil {
				exps = append(exps, model.Experiment{ID: exp.ID})
			}
		}
		if err := db.Model(&milestone).Association("Experiments").Replace(exps); err != nil {
			return fmt.Errorf("关联里程碑 %s 展项失败: %w", m.Slug, err)
		}
	}
	return nil
}
