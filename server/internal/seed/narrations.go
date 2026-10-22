// 讲解稿件的内置种子与音频归档导入。
//
// 安装后首次运行即可自动获得 359 个实验的现成讲解（稿件 + 双音色音频），
// 无需联网、无需手工导入。稿件来自原型项目 mathviz，经 slug 映射后按本系统结构组织。
package seed

import (
	"archive/zip"
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/gorm"
)

//go:embed data/narrations.json
var narrationSeedRaw []byte

//go:embed data/narrations-theorems.json
var narrationTheoremsRaw []byte

//go:embed data/narrations-theorems-3.json
var narrationTheorems3Raw []byte

//go:embed data/narrations-theorems-4.json
var narrationTheorems4Raw []byte

//go:embed data/narrations-theorems-5.json
var narrationTheorems5Raw []byte

//go:embed data/narrations-theorems-6.json
var narrationTheorems6Raw []byte

//go:embed data/narrations-theorems-7.json
var narrationTheorems7Raw []byte

//go:embed data/narrations-theorems-2.json
var narrationTheorems2Raw []byte

//go:embed data/narrations-phy.json
var narrationPhyRaw []byte

//go:embed data/narrations-phy-b.json
var narrationPhyBRaw []byte

//go:embed data/narrations-phy-c.json
var narrationPhyCRaw []byte

//go:embed data/narrations-phy-d.json
var narrationPhyDRaw []byte

//go:embed data/narrations-phy-e.json
var narrationPhyERaw []byte

//go:embed data/narrations-phy-f.json
var narrationPhyFRaw []byte

//go:embed data/narrations-phy-g.json
var narrationPhyGRaw []byte

//go:embed data/narrations-phy-experiments-g.json
var narrationPhyExpGRaw []byte

//go:embed data/narrations-phy-experiments-h.json
var narrationPhyExpHRaw []byte

//go:embed data/narrations-phy-experiments-i.json
var narrationPhyExpIRaw []byte

// narrationLine 种子稿件中的一句台词。
type narrationLine struct {
	SectionID    string `json:"section_id"`
	SectionTitle string `json:"section_title"`
	LineIndex    int    `json:"line_index"`
	LineID       string `json:"line_id"`
	Text         string `json:"text"`
	DurationMs   int    `json:"duration_ms"`
}

// narrationScript 一个实验的完整稿件。键为实验 slug。
type narrationScript struct {
	Source string          `json:"source"`
	Lines  []narrationLine `json:"lines"`
}

var (
	narrationOnce sync.Once
	narrationData map[string]narrationScript
	narrationErr  error
)

func narrationScripts() (map[string]narrationScript, error) {
	narrationOnce.Do(func() {
		narrationData = map[string]narrationScript{}
		if err := json.Unmarshal(narrationSeedRaw, &narrationData); err != nil {
			narrationErr = fmt.Errorf("解析内置讲解稿件失败: %w", err)
			return
		}
		// 数学史里程碑定理的稿件单独维护，与主稿件合并
		for _, raw := range [][]byte{narrationTheoremsRaw, narrationTheorems2Raw, narrationTheorems3Raw, narrationTheorems4Raw, narrationTheorems5Raw, narrationTheorems6Raw, narrationTheorems7Raw} {
			var extra map[string]narrationScript
			if err := json.Unmarshal(raw, &extra); err != nil {
				narrationErr = fmt.Errorf("解析数学史讲解稿件失败: %w", err)
				return
			}
			for slug, script := range extra {
				narrationData[slug] = script
			}
		}
		// 物理之美展项讲解种子（narrations-phy[a-g].json + narrations-phy-experiments[g-i].json，覆盖滚动扩充的全部展项）
		for _, raw := range [][]byte{narrationPhyRaw, narrationPhyBRaw, narrationPhyCRaw, narrationPhyDRaw, narrationPhyERaw, narrationPhyFRaw, narrationPhyGRaw, narrationPhyExpGRaw, narrationPhyExpHRaw, narrationPhyExpIRaw} {
			var phy map[string]narrationScript
			if err := json.Unmarshal(raw, &phy); err != nil {
				narrationErr = fmt.Errorf("解析物理讲解稿件失败: %w", err)
				return
			}
			for slug, script := range phy {
				narrationData[slug] = script
			}
		}
	})
	return narrationData, narrationErr
}

// SeedNarrationLineIDs 返回内置展项稿件的 slug → line_id 集合。
//
// 发布打包用它作为"这句讲解必须有音频"的基准：首次运行时数据库就是按这份稿件
// 建库的，而开发库里可能还有本地 AI 版内容生成的额外台词，那些不属于发布内容。
func SeedNarrationLineIDs() (map[string]map[string]bool, error) {
	return lineIDsBySlug(narrationScripts())
}

func lineIDsBySlug(scripts map[string]narrationScript, err error) (map[string]map[string]bool, error) {
	if err != nil {
		return nil, err
	}
	out := make(map[string]map[string]bool, len(scripts))
	for slug, s := range scripts {
		set := make(map[string]bool, len(s.Lines))
		for _, l := range s.Lines {
			set[l.LineID] = true
		}
		out[slug] = set
	}
	return out, nil
}

// NarrationStats 返回内置稿件的规模（实验数、台词行数）。
func NarrationStats() (experiments, lines int) {
	scripts, err := narrationScripts()
	if err != nil {
		return 0, 0
	}
	for _, s := range scripts {
		experiments++
		lines += len(s.Lines)
	}
	return experiments, lines
}

// ImportNarrations 把内置讲解稿件写入数据库。
//
// skipExisting 为 true 时跳过已有讲解的实验，避免覆盖用户/AI 生成的内容（默认行为）。
// 音频路径按本系统约定写入：/audio/<experiment_id>/<voice>/<line_id>.mp3
func ImportNarrations(db *gorm.DB, skipExisting bool) (experiments, lines int, err error) {
	scripts, err := narrationScripts()
	if err != nil {
		return 0, 0, fmt.Errorf("解析内置讲解稿件失败: %w", err)
	}

	// 一次性取出 slug → id，避免逐条查询
	var exps []model.Experiment
	if err := db.Select("id", "slug").Find(&exps).Error; err != nil {
		return 0, 0, err
	}
	idBySlug := make(map[string]uint, len(exps))
	for _, e := range exps {
		idBySlug[e.Slug] = e.ID
	}

	existing := map[uint]bool{}
	if skipExisting {
		var ids []uint
		if err := db.Model(&model.Narration{}).Distinct("experiment_id").Pluck("experiment_id", &ids).Error; err != nil {
			return 0, 0, err
		}
		for _, id := range ids {
			existing[id] = true
		}
	}

	for slug, script := range scripts {
		expID, ok := idBySlug[slug]
		if !ok || expID == 0 {
			continue // 该 slug 在当前数据库中不存在
		}
		if existing[expID] {
			continue
		}
		records := make([]model.Narration, 0, len(script.Lines))
		for _, l := range script.Lines {
			base := filepath.ToSlash(filepath.Join(strconv.FormatUint(uint64(expID), 10), "yunxi", l.LineID+".mp3"))
			baseX := filepath.ToSlash(filepath.Join(strconv.FormatUint(uint64(expID), 10), "xiaoxiao", l.LineID+".mp3"))
			records = append(records, model.Narration{
				ExperimentID:  expID,
				SectionID:     l.SectionID,
				SectionTitle:  l.SectionTitle,
				LineIndex:     l.LineIndex,
				LineID:        l.LineID,
				Text:          l.Text,
				DurationMs:    l.DurationMs,
				AudioYunxi:    "/audio/" + base,
				AudioXiaoxiao: "/audio/" + baseX,
			})
		}
		if len(records) == 0 {
			continue
		}
		if err := db.CreateInBatches(records, 100).Error; err != nil {
			return experiments, lines, fmt.Errorf("写入 %s 讲解失败: %w", slug, err)
		}
		experiments++
		lines += len(records)
	}
	return experiments, lines, nil
}

// narrationArchiveManifest 是归档内清单文件的名字。
const narrationArchiveManifest = "manifest.json"

// narrationArchiveManifestDoc 是归档清单（由 cmd/audio-pack 生成）。
//
// Entries 逐文件给出落盘目录：归档内只有 slug，但目录既可能是展项目录（<experiment_id>）
// 也可能是里程碑目录（ms<milestone_id>），而且有 21 个 slug 两者同名。
// 只按 slug 反查 id 会把里程碑音频写进展项目录，导致 /audio/ms<id>/... 404。
type narrationArchiveManifestDoc struct {
	Version int `json:"version"`
	Entries []struct {
		Path string `json:"path"`
		Dir  string `json:"dir"`
		Kind string `json:"kind"`
		Size int64  `json:"size"`
	} `json:"entries"`
}

var (
	manifestOnce sync.Once
	manifestDir  map[string]string // 归档内路径 → 落盘目录
	manifestErr  error
)

// loadArchiveDirMap 读取归档清单，返回「归档内路径 → 落盘目录」映射。
// 归档内没有清单（旧格式归档）时返回空映射，调用方回退到按 slug 反查实验 id。
func loadArchiveDirMap(zr *zip.Reader) (map[string]string, error) {
	manifestOnce.Do(func() {
		manifestDir = map[string]string{}
		var mf *zip.File
		for _, f := range zr.File {
			if f.Name == narrationArchiveManifest {
				mf = f
				break
			}
		}
		if mf == nil {
			return // 旧归档：无清单，走兼容路径
		}
		rc, err := mf.Open()
		if err != nil {
			manifestErr = fmt.Errorf("读取音频归档清单失败: %w", err)
			return
		}
		defer rc.Close()
		var doc narrationArchiveManifestDoc
		if err := json.NewDecoder(rc).Decode(&doc); err != nil {
			manifestErr = fmt.Errorf("解析音频归档清单失败: %w", err)
			return
		}
		for _, e := range doc.Entries {
			if e.Path != "" && e.Dir != "" {
				manifestDir[e.Path] = e.Dir
			}
		}
	})
	return manifestDir, manifestErr
}

// ExtractNarrationAudio 把音频归档解压到 <dataDir>/audio。
//
// 落盘位置优先取归档清单里的显式目录（<experiment_id> 或 ms<milestone_id>），
// 旧格式归档（无清单）才退化为「按 slug 反查实验 id」。
//
// 幂等且可增量续跑：
//   - 目标文件已存在且大小一致 → 跳过；
//   - 清单文件与归档本身都参与指纹，归档升级（新增/替换音频）后会自动补齐；
//   - 只有全部条目成功落盘才写完成标记，中断后下次启动会继续补齐。
func ExtractNarrationAudio(db *gorm.DB, archivePath, dataDir string, force bool) (int, error) {
	marker := filepath.Join(dataDir, ".narration-audio.ok")
	if _, err := os.Stat(archivePath); err != nil {
		return 0, fmt.Errorf("音频归档不存在: %s", archivePath)
	}

	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return 0, fmt.Errorf("打开音频归档失败: %w", err)
	}
	defer zr.Close()

	dirByPath, err := loadArchiveDirMap(&zr.Reader)
	if err != nil {
		return 0, err
	}

	// 指纹 = 归档条目数 + 归档字节数 + 归档内清单字节数。
	// 清单由音频内容决定，因此「音频变了但文件数/总字节恰好没变」也能识别出来。
	fingerprint := markerFingerprint(&zr.Reader, archivePath, narrationArchiveManifest)
	if !force && markerMatches(marker, fingerprint) {
		return 0, nil
	}

	var exps []model.Experiment
	if err := db.Select("id", "slug").Find(&exps).Error; err != nil {
		return 0, err
	}
	idBySlug := make(map[string]uint, len(exps))
	for _, e := range exps {
		idBySlug[e.Slug] = e.ID
	}

	audioRoot := filepath.Join(dataDir, "audio")
	written := 0
	for _, f := range zr.File {
		rel := strings.Split(strings.TrimPrefix(f.Name, "./"), "/")
		if len(rel) != 3 || rel[2] == "" || strings.Contains(rel[2], "/") {
			continue // 清单文件与目录条目
		}
		dir, ok := dirByPath[f.Name]
		if !ok {
			// 旧格式归档：按 slug 反查实验 id
			expID, found := idBySlug[rel[0]]
			if !found || expID == 0 {
				continue // 该 slug 在当前数据库中不存在
			}
			dir = strconv.FormatUint(uint64(expID), 10)
		}
		if dir == "" || !isSafeArchiveDir(dir) {
			continue // 防御：清单里的目录名不合法
		}
		// 归档路径可能带消歧前缀（同名 slug 的同名 line_id，里程碑侧存为
		// <ms-id>.<line>.mp3）。落盘时要还原成前端请求的文件名 <line>.mp3。
		fileName := stripArchiveDisambiguation(dir, rel[2])
		if fileName == "" {
			continue
		}
		dst := filepath.Join(audioRoot, dir, rel[1], fileName)
		if !force {
			if info, err := os.Stat(dst); err == nil && info.Size() == int64(f.UncompressedSize64) && info.Size() > 0 {
				continue // 已存在且大小一致
			}
		}
		if err := extractOne(f, dst); err != nil {
			// 出错时不写完成标记：下次启动重新扫描并补齐（已完成的文件会被跳过）。
			return written, fmt.Errorf("解压 %s 失败: %w", f.Name, err)
		}
		written++
	}

	if err := writeMarkerAtomic(marker, fingerprint); err != nil {
		return written, err
	}
	return written, nil
}

// stripArchiveDisambiguation 去掉归档内为消歧加的文件名前缀，得到落盘文件名。
//
// 归档内同名 slug 的同名 line_id 会出现两条不同音频，里程碑侧命名为
// <ms-id>.<line>.mp3（例如 ms13.intro-1.mp3）；落盘目录已经是 ms13，
// 文件名必须还原为 intro-1.mp3，否则前端按 /audio/ms13/yunxi/intro-1.mp3 取不到。
func stripArchiveDisambiguation(dir, name string) string {
	prefix := dir + "."
	if strings.HasPrefix(name, prefix) {
		rest := strings.TrimPrefix(name, prefix)
		if rest != "" && !strings.Contains(rest, "/") {
			return rest
		}
	}
	if name == "" || strings.Contains(name, "/") {
		return ""
	}
	return name
}

// isSafeArchiveDir 校验清单给出的落盘目录名，避免路径穿越。
// 只接受两类：全数字（展项目录 <experiment_id>）与 ms+数字（里程碑目录）。
func isSafeArchiveDir(dir string) bool {
	if dir == "" {
		return false
	}
	if strings.HasPrefix(dir, "ms") {
		digits := dir[2:]
		if digits == "" {
			return false
		}
		for _, r := range digits {
			if r < '0' || r > '9' {
				return false
			}
		}
		return true
	}
	for _, r := range dir {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// ExtractMaterialAssets 把素材资产归档（图片/数据集）解压到 assetsDir。
//
// 归档内路径就是素材相对路径（image/xxx.jpg、dataset/xxx.csv），与 seed/data/assets.json
// 的 rel_path、以及 /phy-assets 静态路由的目录结构一致，因此原样落盘即可。
//
// 与讲解音频一样幂等：已存在且大小一致的文件跳过，全部成功后才写完成标记，
// 中断后下次启动会增量补齐。归档不存在时返回 (0, nil)。
func ExtractMaterialAssets(archivePath, assetsDir string, force bool) (int, error) {
	marker := filepath.Join(assetsDir, ".phy-assets.ok")
	if _, err := os.Stat(archivePath); err != nil {
		return 0, nil // 未随包分发素材：不是错误
	}

	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return 0, fmt.Errorf("打开素材归档失败: %w", err)
	}
	defer zr.Close()

	fingerprint := markerFingerprint(&zr.Reader, archivePath, "")
	if !force && markerMatches(marker, fingerprint) {
		return 0, nil
	}

	written := 0
	for _, f := range zr.File {
		rel, ok := safeArchiveRelPath(f.Name)
		if !ok {
			continue // 目录条目或不安全路径
		}
		dst := filepath.Join(assetsDir, filepath.FromSlash(rel))
		if !force {
			if info, err := os.Stat(dst); err == nil && info.Size() == int64(f.UncompressedSize64) && info.Size() > 0 {
				continue
			}
		}
		if err := extractOne(f, dst); err != nil {
			// 出错不写标记：下次启动重新扫描补齐
			return written, fmt.Errorf("解压素材 %s 失败: %w", f.Name, err)
		}
		written++
	}

	if err := writeMarkerAtomic(marker, fingerprint); err != nil {
		return written, err
	}
	return written, nil
}
