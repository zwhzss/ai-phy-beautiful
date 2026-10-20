package seed

import (
	"archive/zip"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"

	"github.com/ai-phy-beautiful/server/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// buildArchive 构造测试用音频归档。
//
// files: 归档内路径 → 内容。manifestDirs 非 nil 时额外写入清单（路径 → 落盘目录）。
func buildArchive(t *testing.T, path string, files map[string]string, manifestDirs map[string]string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("创建测试归档失败: %v", err)
	}
	zw := zip.NewWriter(f)
	for name, body := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("写入归档条目 %s 失败: %v", name, err)
		}
		if _, err := w.Write([]byte(body)); err != nil {
			t.Fatalf("写入归档内容 %s 失败: %v", name, err)
		}
	}
	if manifestDirs != nil {
		type entry struct {
			Path string `json:"path"`
			Dir  string `json:"dir"`
		}
		list := []entry{}
		for p, d := range manifestDirs {
			list = append(list, entry{Path: p, Dir: d})
		}
		doc := map[string]any{"version": 1, "layout": "slug/voice/line.mp3", "entries": list}
		w, err := zw.Create(narrationArchiveManifest)
		if err != nil {
			t.Fatalf("写入清单失败: %v", err)
		}
		if err := json.NewEncoder(w).Encode(doc); err != nil {
			t.Fatalf("序列化清单失败: %v", err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("关闭归档失败: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("关闭文件失败: %v", err)
	}
}

func newTestDB(t *testing.T, exps []model.Experiment) *gorm.DB {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	if err := db.AutoMigrate(&model.Experiment{}); err != nil {
		t.Fatalf("迁移测试表失败: %v", err)
	}
	for i := range exps {
		if err := db.Create(&exps[i]).Error; err != nil {
			t.Fatalf("写入测试实验失败: %v", err)
		}
	}
	// Windows 上未关闭的连接会锁住 db 文件，导致 testing 的 TempDir 清理失败。
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// resetArchiveManifestCache 清掉包级 sync.Once 缓存，让每个用例都能重新加载清单。
func resetArchiveManifestCache() {
	manifestOnce = sync.Once{}
	manifestDir = nil
	manifestErr = nil
}

// TestExtractNarrationAudioUsesManifestDir 覆盖核心回归：
// 同一个 slug 既是展项又是里程碑时，两侧音频必须分别落到 <id> 与 ms<id>。
func TestExtractNarrationAudioUsesManifestDir(t *testing.T) {
	resetArchiveManifestCache()
	db := newTestDB(t, []model.Experiment{{Slug: "mass-energy-equivalence"}})
	var exp model.Experiment
	if err := db.Where("slug = ?", "mass-energy-equivalence").First(&exp).Error; err != nil {
		t.Fatalf("读取测试实验失败: %v", err)
	}
	expDir := filepath.Join(t.TempDir(), "data")
	archive := filepath.Join(t.TempDir(), "audio.zip")
	expID := strconv.FormatUint(uint64(exp.ID), 10)

	// 展项与里程碑同 slug、同 line_id，但音频内容不同
	files := map[string]string{
		"mass-energy-equivalence/yunxi/intro-1.mp3":      "experiment-audio",
		"mass-energy-equivalence/yunxi/ms13.intro-1.mp3": "milestone-audio",
		"mass-energy-equivalence/yunxi/statement-1.mp3":  "experiment-statement",
	}
	manifestDirs := map[string]string{
		"mass-energy-equivalence/yunxi/intro-1.mp3":      expID,
		"mass-energy-equivalence/yunxi/ms13.intro-1.mp3": "ms13",
		"mass-energy-equivalence/yunxi/statement-1.mp3":  expID,
	}
	buildArchive(t, archive, files, manifestDirs)

	written, err := ExtractNarrationAudio(db, archive, expDir, false)
	if err != nil {
		t.Fatalf("解压失败: %v", err)
	}
	if written != 3 {
		t.Fatalf("解压文件数 = %d，期望 3", written)
	}

	got, err := os.ReadFile(filepath.Join(expDir, "audio", expID, "yunxi", "intro-1.mp3"))
	if err != nil {
		t.Fatalf("展项音频未落盘: %v", err)
	}
	if string(got) != "experiment-audio" {
		t.Errorf("展项目录里的音频 = %q，期望 experiment-audio", string(got))
	}

	// 里程碑音频必须在 ms13 目录（这正是仅按 slug 反查 id 会搞错的地方），
	// 且文件名要去掉归档内的消歧前缀，还原为前端请求的 intro-1.mp3。
	got, err = os.ReadFile(filepath.Join(expDir, "audio", "ms13", "yunxi", "intro-1.mp3"))
	if err != nil {
		t.Fatalf("里程碑音频未落盘到 ms13: %v", err)
	}
	if string(got) != "milestone-audio" {
		t.Errorf("ms13 目录里的音频 = %q，期望 milestone-audio", string(got))
	}
	// 消歧前缀不能残留在磁盘上
	if _, err := os.Stat(filepath.Join(expDir, "audio", "ms13", "yunxi", "ms13.intro-1.mp3")); err == nil {
		t.Errorf("磁盘上残留了消歧前缀文件名 ms13.intro-1.mp3")
	}

	if _, err := os.Stat(filepath.Join(expDir, ".narration-audio.ok")); err != nil {
		t.Errorf("完成标记未写入: %v", err)
	}

	// 再次调用应直接跳过（幂等）
	resetArchiveManifestCache()
	written, err = ExtractNarrationAudio(db, archive, expDir, false)
	if err != nil {
		t.Fatalf("二次解压失败: %v", err)
	}
	if written != 0 {
		t.Errorf("二次解压 written = %d，期望 0（幂等）", written)
	}
}

// TestExtractNarrationAudioFillsInterruptedRun 覆盖「上次解压被中断」的续跑：
// 标记文件缺失时会重新扫描，已完成的文件跳过，只补缺失的。
func TestExtractNarrationAudioFillsInterruptedRun(t *testing.T) {
	resetArchiveManifestCache()
	db := newTestDB(t, []model.Experiment{{Slug: "doppler-effect"}})
	var exp model.Experiment
	if err := db.Where("slug = ?", "doppler-effect").First(&exp).Error; err != nil {
		t.Fatalf("读取测试实验失败: %v", err)
	}
	dataDir := filepath.Join(t.TempDir(), "data")
	archive := filepath.Join(t.TempDir(), "audio.zip")
	expID := strconv.FormatUint(uint64(exp.ID), 10)

	buildArchive(t, archive, map[string]string{
		"doppler-effect/yunxi/intro-1.mp3": "a",
		"doppler-effect/yunxi/intro-2.mp3": "b",
	}, map[string]string{
		"doppler-effect/yunxi/intro-1.mp3": expID,
		"doppler-effect/yunxi/intro-2.mp3": expID,
	})

	// 模拟中断：第一个文件已在位（大小一致），第二个缺失，且没有完成标记
	dst1 := filepath.Join(dataDir, "audio", expID, "yunxi", "intro-1.mp3")
	if err := os.MkdirAll(filepath.Dir(dst1), 0o755); err != nil {
		t.Fatalf("创建目录失败: %v", err)
	}
	if err := os.WriteFile(dst1, []byte("a"), 0o644); err != nil {
		t.Fatalf("预置文件失败: %v", err)
	}

	written, err := ExtractNarrationAudio(db, archive, dataDir, false)
	if err != nil {
		t.Fatalf("续跑解压失败: %v", err)
	}
	if written != 1 {
		t.Errorf("续跑写入 %d 个文件，期望 1（只补缺失的那个）", written)
	}
	if _, err := os.Stat(filepath.Join(dataDir, "audio", expID, "yunxi", "intro-2.mp3")); err != nil {
		t.Errorf("缺失文件未被补齐: %v", err)
	}
}

// TestExtractNarrationAudioLegacyArchive 旧格式归档（无清单）仍按 slug 反查实验 id。
func TestExtractNarrationAudioLegacyArchive(t *testing.T) {
	resetArchiveManifestCache()
	db := newTestDB(t, []model.Experiment{{Slug: "legacy-slug"}})
	var exp model.Experiment
	if err := db.Where("slug = ?", "legacy-slug").First(&exp).Error; err != nil {
		t.Fatalf("读取测试实验失败: %v", err)
	}
	dataDir := filepath.Join(t.TempDir(), "data")
	archive := filepath.Join(t.TempDir(), "audio.zip")

	buildArchive(t, archive, map[string]string{
		"legacy-slug/xiaoxiao/intro-1.mp3": "legacy",
	}, nil)

	written, err := ExtractNarrationAudio(db, archive, dataDir, false)
	if err != nil {
		t.Fatalf("旧格式解压失败: %v", err)
	}
	if written != 1 {
		t.Fatalf("旧格式解压文件数 = %d，期望 1", written)
	}
	p := filepath.Join(dataDir, "audio", strconv.FormatUint(uint64(exp.ID), 10), "xiaoxiao", "intro-1.mp3")
	if _, err := os.Stat(p); err != nil {
		t.Errorf("旧格式音频未落到实验目录: %v", err)
	}
}

// TestExtractNarrationAudioSkipsUnsafeManifestDir 清单里的目录名不合法时跳过，
// 不能借路径穿越写到数据目录之外。
func TestExtractNarrationAudioSkipsUnsafeManifestDir(t *testing.T) {
	resetArchiveManifestCache()
	db := newTestDB(t, []model.Experiment{{Slug: "unsafe-slug"}})
	dataDir := filepath.Join(t.TempDir(), "data")
	archive := filepath.Join(t.TempDir(), "audio.zip")

	buildArchive(t, archive, map[string]string{
		"unsafe-slug/yunxi/intro-1.mp3": "x",
	}, map[string]string{
		"unsafe-slug/yunxi/intro-1.mp3": "../../escaped",
	})

	written, err := ExtractNarrationAudio(db, archive, dataDir, false)
	if err != nil {
		t.Fatalf("解压失败: %v", err)
	}
	if written != 0 {
		t.Errorf("不安全目录被写入 %d 个文件，期望 0", written)
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(dataDir), "escaped")); err == nil {
		t.Errorf("发生了路径穿越：数据目录之外出现文件")
	}
}

func TestIsSafeArchiveDir(t *testing.T) {
	cases := map[string]bool{
		"1":       true,
		"126":     true,
		"ms13":    true,
		"ms1":     true,
		"":        false,
		"ms":      false,
		"msx":     false,
		"../x":    false,
		"a/b":     false,
		`a\b`:     false,
		"12ms34":  false,
		"126.mp3": false,
	}
	for in, want := range cases {
		if got := isSafeArchiveDir(in); got != want {
			t.Errorf("isSafeArchiveDir(%q) = %v，期望 %v", in, got, want)
		}
	}
}

// TestExtractMaterialAssets 素材归档按相对路径原样落盘，且幂等。
func TestExtractMaterialAssets(t *testing.T) {
	assetsDir := filepath.Join(t.TempDir(), "assets")
	archive := filepath.Join(t.TempDir(), "assets.zip")

	buildArchive(t, archive, map[string]string{
		"image/cmb.jpg":              "fake-jpeg-data",
		"dataset/balmer-series.csv":  "wavelength\n656.28\n",
	}, nil)

	written, err := ExtractMaterialAssets(archive, assetsDir, false)
	if err != nil {
		t.Fatalf("解压素材失败: %v", err)
	}
	if written != 2 {
		t.Fatalf("解压素材数 = %d，期望 2", written)
	}
	got, err := os.ReadFile(filepath.Join(assetsDir, "image", "cmb.jpg"))
	if err != nil {
		t.Fatalf("素材未落盘: %v", err)
	}
	if string(got) != "fake-jpeg-data" {
		t.Errorf("素材内容 = %q", string(got))
	}
	if _, err := os.Stat(filepath.Join(assetsDir, "dataset", "balmer-series.csv")); err != nil {
		t.Errorf("数据集未落盘: %v", err)
	}
	// 幂等：第二次应直接跳过
	written, err = ExtractMaterialAssets(archive, assetsDir, false)
	if err != nil {
		t.Fatalf("二次解压失败: %v", err)
	}
	if written != 0 {
		t.Errorf("二次解压 written = %d，期望 0", written)
	}
	// 归档不存在时不是错误
	if n, err := ExtractMaterialAssets(filepath.Join(t.TempDir(), "missing.zip"), assetsDir, false); err != nil || n != 0 {
		t.Errorf("归档缺失应返回 (0, nil)，实际 (%d, %v)", n, err)
	}
}

// TestExtractMaterialAssetsRejectsTraversal 归档条目不得写到目标目录之外。
func TestExtractMaterialAssetsRejectsTraversal(t *testing.T) {
	assetsDir := filepath.Join(t.TempDir(), "assets")
	archive := filepath.Join(t.TempDir(), "assets.zip")

	buildArchive(t, archive, map[string]string{
		"../escaped.txt":       "pwned",
		"image/ok.jpg":         "fine",
		"/absolute/evil.txt":   "pwned",
	}, nil)

	if _, err := ExtractMaterialAssets(archive, assetsDir, false); err != nil {
		t.Fatalf("解压失败: %v", err)
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(assetsDir), "escaped.txt")); err == nil {
		t.Errorf("发生了路径穿越：%s", filepath.Join(filepath.Dir(assetsDir), "escaped.txt"))
	}
	if _, err := os.Stat(filepath.Join(assetsDir, "image", "ok.jpg")); err != nil {
		t.Errorf("正常条目未落盘: %v", err)
	}
}

func TestSafeArchiveRelPath(t *testing.T) {
	cases := map[string]bool{
		"image/cmb.jpg":   true,
		"dataset/a.csv":   true,
		"./image/a.jpg":   true,
		"":                false,
		"image/":          false,
		"../a.txt":        false,
		"a/../../b.txt":   false,
		"/abs/a.txt":      false,
		`image\a.jpg`:     false,
		"c:/a.txt":        false,
		"image/./a.jpg":   false,
	}
	for in, want := range cases {
		_, ok := safeArchiveRelPath(in)
		if ok != want {
			t.Errorf("safeArchiveRelPath(%q) ok = %v，期望 %v", in, ok, want)
		}
	}
}
