// 命令 assets-pack 把素材资产目录打包成随安装包分发的 phy-assets.zip。
//
// 归档内路径与素材相对路径一致（image/xxx.jpg、dataset/xxx.csv），
// 与 seed/data/assets.json 的 rel_path 及 /phy-assets 静态路由的目录结构对应；
// 首次启动由 seed.ExtractMaterialAssets 原样解压到 <数据目录>/assets。
//
// 用法：
//
//	go run ./cmd/assets-pack -src <server/data/assets> -out <zip 路径> [-report <json>]
package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func main() {
	src := flag.String("src", filepath.Join("data", "assets"), "素材资产根目录")
	out := flag.String("out", filepath.Join("..", "desktop", "assets", "phy-assets.zip"), "输出 zip 路径")
	reportPath := flag.String("report", "", "可选：把打包报告写入该 JSON 文件")
	strict := flag.Bool("strict", true, "目录为空时报错退出")
	flag.Parse()

	if _, err := os.Stat(*src); err != nil {
		fmt.Fprintf(os.Stderr, "素材目录不存在: %s\n", *src)
		os.Exit(1)
	}

	type item struct {
		Rel  string
		Abs  string
		Size int64
	}
	var items []item
	err := filepath.Walk(*src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		rel, rerr := filepath.Rel(*src, path)
		if rerr != nil {
			return rerr
		}
		rel = filepath.ToSlash(rel)
		if strings.HasPrefix(filepath.Base(rel), ".") {
			return nil // 跳过 .phy-assets.ok 之类的内部标记
		}
		items = append(items, item{Rel: rel, Abs: path, Size: info.Size()})
		return nil
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "遍历素材目录失败: %v\n", err)
		os.Exit(1)
	}
	if len(items) == 0 {
		msg := fmt.Sprintf("素材目录为空: %s", *src)
		if *strict {
			fmt.Fprintln(os.Stderr, msg)
			os.Exit(1)
		}
		fmt.Fprintln(os.Stderr, msg+"（继续生成空归档）")
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Rel < items[j].Rel })

	var total int64
	for _, it := range items {
		total += it.Size
	}
	fmt.Printf("素材目录 : %s\n输出归档 : %s\n待打包   : %d 个文件 / %.2f MB\n\n",
		*src, *out, len(items), float64(total)/1024/1024)

	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "创建输出目录失败: %v\n", err)
		os.Exit(1)
	}
	tmpZip := *out + ".tmp"
	_ = os.Remove(tmpZip)
	f, err := os.Create(tmpZip)
	if err != nil {
		fmt.Fprintf(os.Stderr, "创建归档失败: %v\n", err)
		os.Exit(1)
	}
	zw := zip.NewWriter(f)

	fail := func(format string, args ...any) {
		fmt.Fprintf(os.Stderr, format+"\n", args...)
		_ = zw.Close()
		_ = f.Close()
		_ = os.Remove(tmpZip)
		os.Exit(1)
	}

	type digest struct {
		Path   string `json:"path"`
		Size   int64  `json:"size"`
		SHA256 string `json:"sha256"`
	}
	digests := make([]digest, 0, len(items))

	for _, it := range items {
		hdr := &zip.FileHeader{Name: it.Rel, Method: zip.Deflate} // 图片/CSV 压缩有效
		hdr.SetMode(0o644)
		w, err := zw.CreateHeader(hdr)
		if err != nil {
			fail("写入归档条目 %s 失败: %v", it.Rel, err)
		}
		src, err := os.Open(it.Abs)
		if err != nil {
			fail("打开 %s 失败: %v", it.Abs, err)
		}
		h := sha256.New()
		n, err := io.Copy(io.MultiWriter(w, h), src)
		_ = src.Close()
		if err != nil {
			fail("写入 %s 失败: %v", it.Rel, err)
		}
		if n != it.Size {
			fail("写入 %s 字节数不符：%d != %d", it.Rel, n, it.Size)
		}
		digests = append(digests, digest{Path: it.Rel, Size: n, SHA256: hex.EncodeToString(h.Sum(nil))})
	}

	// 清单：给出文件清单与指纹，解压端据此判断是否需要重新解压
	manifestRaw, _ := json.Marshal(map[string]any{
		"version": 1,
		"files":   digests,
	})
	fingerprint := sha256.Sum256(manifestRaw)
	mhdr := &zip.FileHeader{Name: "manifest.json", Method: zip.Deflate}
	mhdr.SetMode(0o644)
	mw, err := zw.CreateHeader(mhdr)
	if err != nil {
		fail("写入清单失败: %v", err)
	}
	if err := json.NewEncoder(mw).Encode(map[string]any{
		"version":     1,
		"fingerprint": hex.EncodeToString(fingerprint[:]),
		"file_count":  len(digests),
		"total_bytes": total,
		"files":       digests,
	}); err != nil {
		fail("序列化清单失败: %v", err)
	}

	if err := zw.Close(); err != nil {
		fail("关闭归档失败: %v", err)
	}
	if err := f.Sync(); err != nil {
		fail("刷盘失败: %v", err)
	}
	if err := f.Close(); err != nil {
		fail("关闭文件失败: %v", err)
	}
	if err := os.Rename(tmpZip, *out); err != nil {
		fail("归档改名失败: %v", err)
	}

	zipped := int64(0)
	if info, statErr := os.Stat(*out); statErr == nil {
		zipped = info.Size()
	}
	fmt.Printf("完成：%d 个素材 → %.2f MB（原始 %.2f MB）\n", len(items), float64(zipped)/1024/1024, float64(total)/1024/1024)

	if *reportPath != "" {
		rep := map[string]any{
			"archive":       *out,
			"archive_bytes": zipped,
			"file_count":    len(items),
			"total_bytes":   total,
			"src":           *src,
			"files":         digests,
		}
		buf, _ := json.MarshalIndent(rep, "", "  ")
		if err := os.WriteFile(*reportPath, buf, 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "写报告失败: %v\n", err)
		} else {
			fmt.Printf("报告 -> %s\n", *reportPath)
		}
	}
}
