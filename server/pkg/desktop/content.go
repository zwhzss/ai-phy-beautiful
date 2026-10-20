// 桌面端首次运行时的讲解内容初始化：内置稿件入库 + 音频归档解压。
//
// 音频归档（assets/narrations-audio.zip，约 550 MB）由安装包装入程序目录，
// 首次启动时解压到用户数据目录并写入数据库讲解记录，之后启动自动跳过。
//
// 稿件入库很快（数千行），同步执行；音频解压较慢，由调用方放到后台执行。
package desktop

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/seed"
	"github.com/ai-phy-beautiful/server/internal/service"
)

// narrationArchiveName 音频归档相对程序目录的路径。
var narrationArchiveName = filepath.Join("assets", "narrations-audio.zip")

// assetsArchiveName 素材资产归档（图片/数据集）相对程序目录的路径。
var assetsArchiveName = filepath.Join("assets", "phy-assets.zip")

// EnsureNarrationScripts 把内置讲解稿件写入数据库（跳过已有讲解的实验，可安全重复调用）。
// 返回本次写入的实验数与台词行数。
func EnsureNarrationScripts() (experiments, lines int, err error) {
	db := repository.GetDB()
	if db == nil {
		return 0, 0, fmt.Errorf("数据库尚未初始化")
	}
	experiments, lines, err = seed.ImportNarrations(db, true)
	if err != nil {
		return 0, 0, err
	}
	if experiments > 0 {
		log.Printf("讲解稿件初始化：%d 个实验 / %d 行台词", experiments, lines)
	}
	return experiments, lines, nil
}

// RepairSeedNarrations 修复「种子版内容存档里文稿为空」的老库残留。
//
// 必须放在 EnsureNarrationScripts 之后：桌面端建库/建基线发生在 InitDB，
// 而稿件入库发生在那之后，两者顺序一旦倒过来，基线就会把空文稿固化下来。
// 这里再补一次自愈，保证无论顺序如何，「有稿的实验」其种子版存档必有稿。
func RepairSeedNarrations() (int, error) {
	db := repository.GetDB()
	if db == nil {
		return 0, fmt.Errorf("数据库尚未初始化")
	}
	fixed, err := service.NewContentVersionService().BackfillEmptySeedNarrations()
	if err != nil {
		return fixed, err
	}
	if fixed > 0 {
		log.Printf("种子版空文稿存档已回填：%d 个实验", fixed)
	}
	return fixed, nil
}

// EnsureNarrationAudio 解压内置音频归档到数据目录。
//
// 归档不存在（例如未随安装包分发）时返回 (0, false, nil)，不视为错误。
// 已解压过（存在标记文件）时直接返回。
func EnsureNarrationAudio(dataDir string) (files int, archiveFound bool, err error) {
	db := repository.GetDB()
	if db == nil {
		return 0, false, fmt.Errorf("数据库尚未初始化")
	}
	archive := findNarrationArchive()
	if archive == "" {
		return 0, false, nil
	}
	files, err = seed.ExtractNarrationAudio(db, archive, dataDir, false)
	if err != nil {
		return files, true, err
	}
	if files > 0 {
		log.Printf("讲解音频初始化：解压 %d 个文件（%s）", files, archive)
	}
	return files, true, nil
}

// EnsureMaterialAssets 解压内置素材资产归档到 <数据目录>/assets。
//
// 素材（图片/数据集）与讲解音频一样属于"安装即用"的内容：元数据由种子写入 assets 表，
// 文件本体必须落到 ASSETS_DIR，否则 /phy-assets/* 全 404、资料页只有空白。
// 归档不存在时返回 (0, false, nil)，不视为错误。
func EnsureMaterialAssets(dataDir string) (files int, archiveFound bool, err error) {
	archive := findArchive(assetsArchiveName, "PHY_ASSETS_ARCHIVE")
	if archive == "" {
		return 0, false, nil
	}
	assetsDir := filepath.Join(dataDir, "assets")
	files, err = seed.ExtractMaterialAssets(archive, assetsDir, false)
	if err != nil {
		return files, true, err
	}
	if files > 0 {
		log.Printf("素材资产初始化：解压 %d 个文件（%s）", files, archive)
	}
	return files, true, nil
}

// findNarrationArchive 依次在环境变量、程序目录下查找音频归档。
func findNarrationArchive() string {
	return findArchive(narrationArchiveName, "NARRATION_ARCHIVE")
}

// findArchive 依次在环境变量、程序目录下查找归档文件。
func findArchive(relName, envKey string) string {
	if p := strings.TrimSpace(os.Getenv(envKey)); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	cand := filepath.Join(filepath.Dir(exe), relName)
	if _, err := os.Stat(cand); err == nil {
		return cand
	}
	return ""
}
