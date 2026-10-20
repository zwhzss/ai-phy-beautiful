// 通用归档解压工具：讲解音频与素材资产归档共用。
//
// 两条不变式：
//   - 原子落盘：先写同目录临时文件、字节数校验通过后改名，中断不会留下 0 字节
//     或半截文件被后续 "已存在" 判断误认为完成；
//   - 完成标记只有在全部条目成功后才写入，中断后下次启动重新扫描并增量补齐。
package seed

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// markerFingerprint 生成归档指纹。
//
// 指纹由「条目数 + 归档字节数 + 归档内清单字节数」组成：清单由内容决定，
// 因此归档升级（新增或替换文件）后指纹必然变化，从而触发重新扫描；
// 而扫描过程对已存在且大小一致的文件直接跳过，只解压增量部分。
func markerFingerprint(zr *zip.Reader, archivePath, manifestName string) string {
	archiveBytes := int64(0)
	if info, err := os.Stat(archivePath); err == nil {
		archiveBytes = info.Size()
	}
	manifestBytes := int64(0)
	if manifestName != "" {
		for _, f := range zr.File {
			if f.Name == manifestName {
				manifestBytes = int64(f.UncompressedSize64)
				break
			}
		}
	}
	return fmt.Sprintf("v2 files=%d size=%d manifest=%d\n", len(zr.File), archiveBytes, manifestBytes)
}

// markerMatches 判断完成标记是否与当前归档指纹一致。
func markerMatches(marker, fingerprint string) bool {
	data, err := os.ReadFile(marker)
	if err != nil {
		return false
	}
	return string(data) == fingerprint
}

// writeMarkerAtomic 先写临时文件再改名，避免写到一半留下损坏的标记文件。
func writeMarkerAtomic(marker, content string) error {
	dir := filepath.Dir(marker)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("写完成标记失败: %w", err)
	}
	tmp, err := os.CreateTemp(dir, "."+filepath.Base(marker)+".*")
	if err != nil {
		return fmt.Errorf("写完成标记失败: %w", err)
	}
	name := tmp.Name()
	if _, err := tmp.WriteString(content); err != nil {
		_ = tmp.Close()
		_ = os.Remove(name)
		return fmt.Errorf("写完成标记失败: %w", err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(name)
		return fmt.Errorf("写完成标记失败: %w", err)
	}
	if err := os.Rename(name, marker); err != nil {
		_ = os.Remove(name)
		return fmt.Errorf("写完成标记失败: %w", err)
	}
	return nil
}

// extractOne 原子解压单个归档条目到 dst（同目录临时文件 + 原子改名）。
func extractOne(f *zip.File, dst string) error {
	dir := filepath.Dir(dst)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	in, err := f.Open()
	if err != nil {
		return err
	}
	defer in.Close()

	tmp, err := os.CreateTemp(dir, "."+filepath.Base(dst)+".*.part")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	written, copyErr := io.Copy(tmp, in)
	closeErr := tmp.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(tmpName)
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	}
	if written == 0 || written != int64(f.UncompressedSize64) {
		_ = os.Remove(tmpName)
		return fmt.Errorf("解压字节数不符：%d != %d", written, f.UncompressedSize64)
	}
	if err := os.Rename(tmpName, dst); err != nil {
		_ = os.Remove(tmpName)
		return err
	}
	return nil
}

// safeArchiveRelPath 校验归档内相对路径：不允许绝对路径、盘符与 .. 穿越。
func safeArchiveRelPath(name string) (string, bool) {
	clean := strings.TrimPrefix(strings.TrimPrefix(name, "./"), `.\`)
	if clean == "" || strings.HasSuffix(clean, "/") {
		return "", false
	}
	if strings.Contains(clean, `\`) || strings.Contains(clean, ":") {
		return "", false
	}
	for _, part := range strings.Split(clean, "/") {
		if part == "" || part == "." || part == ".." {
			return "", false
		}
	}
	return clean, true
}
