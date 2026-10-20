// 命令 audio-pack 把讲解音频目录打包成随安装包分发的 narrations-audio.zip。
//
// 归档结构（默认）：
//
//	<narration-slug>/<voice>/<line_id>.mp3
//
// 首次启动时由 server/internal/seed.ExtractNarrationAudio 解压到
// <数据目录>/audio/<dir>/<voice>/<line_id>.mp3。
//
// 为什么归档里还要写 manifest.json：
//
//  1. 归档内只有 slug，落盘目录却既可能是展项目录（<experiment_id>）也可能是里程碑目录
//     （ms<milestone_id>）。有 21 个 slug 两者同名（例：mass-energy-equivalence 既是
//     实验 126 又是里程碑 ms13）。仅凭运行时数据库反查 slug → id 会把里程碑音频写进
//     展项目录，前端请求 /audio/ms13/... 就 404。
//  2. 同名 slug 的两侧即使 line_id 相同，台词文本也不同（是两段不同的讲解），
//     因此同一句 line_id 会有两份内容不同的音频。里程碑侧改用
//     <slug>/<voice>/<ms-id>.<line_id>.mp3 消除归档内路径冲突，落盘位置由清单给出。
//
// 清单里逐文件记录落盘目录，解压时按清单直取，结果与打包机一致、与运行库的 id 无关。
//
// 用法：
//
//	go run ./cmd/audio-pack -db <sqlite> -audio <音频目录> -out <zip 路径> [-report <json>]
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
	"strconv"
	"strings"
	"sync"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	manifestName = "manifest.json"
	manifestVer  = 1

	kindExperiment = "experiment"
	kindMilestone  = "milestone"
)

// dbRow 是一行讲解（展项或里程碑）的查询结果。
type dbRow struct {
	ID     uint
	Slug   string
	LineID string
}

// packEntry 是归档中的一个音频条目。
type packEntry struct {
	Slug    string
	LineID  string
	Voice   string
	Dir     string // 落盘目录：<experiment_id> 或 ms<milestone_id>
	Kind    string
	Archive string // 归档内路径
	SrcPath string
	Size    int64
}

// packUnit 是一个讲解单元：同 kind + slug 的台词集合，共用一个数据目录。
type packUnit struct {
	Kind   string
	Slug   string
	Dir    string
	LineID []string
}

// entryManifest 是清单里单个音频条目的记录。
type entryManifest struct {
	Path string `json:"path"`
	Dir  string `json:"dir"`
	Kind string `json:"kind"`
	Size int64  `json:"size"`
}

// manifest 是归档清单。
type manifest struct {
	Version    int             `json:"version"`
	Layout     string          `json:"layout"`
	SlugCount  int             `json:"slug_count"`
	FileCount  int             `json:"file_count"`
	TotalBytes int64           `json:"total_bytes"`
	Collisions []string        `json:"slug_collisions,omitempty"`
	Entries    []entryManifest `json:"entries"`
}

func main() {
	dbPath := flag.String("db", "", "SQLite 数据库路径（提供 slug → 目录映射）")
	audioDir := flag.String("audio", "", "音频根目录")
	outPath := flag.String("out", "", "输出 zip 路径")
	reportPath := flag.String("report", "", "可选：把打包报告写入该 JSON 文件")
	verifyOnly := flag.String("verify", "", "只校验已存在的归档（不重新打包）")
	voicesFlag := flag.String("voice", "yunxi,xiaoxiao", "音色列表")
	strict := flag.Bool("strict", true, "存在缺失/零字节文件时报错退出")
	flag.Parse()

	if *verifyOnly != "" {
		if err := verifyArchive(*verifyOnly); err != nil {
			fmt.Fprintf(os.Stderr, "归档校验失败: %v\n", err)
			os.Exit(1)
		}
		return
	}

	if *dbPath == "" || *audioDir == "" || *outPath == "" {
		fmt.Fprintln(os.Stderr, "必须指定 -db、-audio 与 -out")
		os.Exit(2)
	}
	voices := splitCSV(*voicesFlag)
	if len(voices) == 0 {
		fmt.Fprintln(os.Stderr, "音色列表不能为空")
		os.Exit(2)
	}

	db, err := gorm.Open(sqlite.Open(*dbPath+"?mode=ro"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "打开数据库失败: %v\n", err)
		os.Exit(1)
	}

	var exps []dbRow
	if err := db.Raw(`SELECT e.id AS id, e.slug AS slug, n.line_id AS line_id
		FROM narrations n JOIN experiments e ON e.id = n.experiment_id`).Scan(&exps).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询展项讲解失败: %v\n", err)
		os.Exit(1)
	}
	var mss []dbRow
	if err := db.Raw(`SELECT m.id AS id, m.slug AS slug, n.line_id AS line_id
		FROM milestone_narrations n JOIN milestones m ON m.id = n.milestone_id`).Scan(&mss).Error; err != nil {
		fmt.Fprintf(os.Stderr, "查询里程碑讲解失败: %v\n", err)
		os.Exit(1)
	}

	expDirBySlug := map[string]string{}
	for _, r := range exps {
		expDirBySlug[r.Slug] = strconv.FormatUint(uint64(r.ID), 10)
	}
	msDirBySlug := map[string]string{}
	for _, r := range mss {
		msDirBySlug[r.Slug] = "ms" + strconv.FormatUint(uint64(r.ID), 10)
	}

	collisionSet := map[string]bool{}
	for slug := range msDirBySlug {
		if _, ok := expDirBySlug[slug]; ok {
			collisionSet[slug] = true
		}
	}
	collisions := make([]string, 0, len(collisionSet))
	for s := range collisionSet {
		collisions = append(collisions, s)
	}
	sort.Strings(collisions)

	// ---- 组装讲解单元 ----
	//
	// 展项与里程碑各自独立成单元（kind + slug）。同名 slug 两侧即使是同一 line_id，
	// 台词文本也不同（例如 mass-energy-equivalence 的 intro-1：展项与里程碑是两段不同讲解），
	// 因此两侧都必须各自打包自己的音频，不能合并去重。
	linesByKey := map[string][]string{}
	order := []string{}
	for _, r := range exps {
		k := kindExperiment + "\x00" + r.Slug
		if _, ok := linesByKey[k]; !ok {
			order = append(order, k)
		}
		linesByKey[k] = append(linesByKey[k], r.LineID)
	}
	for _, r := range mss {
		k := kindMilestone + "\x00" + r.Slug
		if _, ok := linesByKey[k]; !ok {
			order = append(order, k)
		}
		linesByKey[k] = append(linesByKey[k], r.LineID)
	}

	var units []packUnit
	for _, k := range order {
		parts := strings.SplitN(k, "\x00", 2)
		kind, slug := parts[0], parts[1]
		dir := expDirBySlug[slug]
		if kind == kindMilestone {
			dir = msDirBySlug[slug]
		}
		units = append(units, packUnit{
			Kind: kind, Slug: slug, Dir: dir,
			LineID: dedupStrings(linesByKey[k]),
		})
	}
	// 先按 slug，再让展项排在里程碑之前：同名 slug 的消歧命名依赖这个次序
	sort.SliceStable(units, func(i, j int) bool {
		if units[i].Slug != units[j].Slug {
			return units[i].Slug < units[j].Slug
		}
		if units[i].Kind != units[j].Kind {
			return units[i].Kind == kindExperiment
		}
		return false
	})

	// ---- 解析每个音频的来源与归档路径 ----
	var entries []packEntry
	var missing []string
	var zeroByte []string
	var renamed []string
	usedArchive := map[string]string{} // 归档路径 → 落盘目录（检测覆盖）

	for _, u := range units {
		for _, v := range voices {
			for _, line := range u.LineID {
				abs := filepath.Join(*audioDir, u.Dir, v, line+".mp3")
				info, statErr := os.Stat(abs)
				if statErr != nil {
					missing = append(missing, filepath.ToSlash(filepath.Join(u.Dir, v, line+".mp3")))
					continue
				}
				if info.Size() == 0 {
					zeroByte = append(zeroByte, filepath.ToSlash(filepath.Join(u.Dir, v, line+".mp3")))
					continue
				}
				// 归档路径默认 <slug>/<voice>/<line>.mp3；同名 slug 的同名 line_id
				// 在里程碑侧改用 <slug>/<voice>/<ms-dir>.<line>.mp3 消歧，
				// 解压时按清单把两侧分别落回 <experiment_id> 与 ms<milestone_id>。
				archive := u.Slug + "/" + v + "/" + line + ".mp3"
				if prev, taken := usedArchive[archive]; taken && prev != u.Dir {
					archive = u.Slug + "/" + v + "/" + u.Dir + "." + line + ".mp3"
					renamed = append(renamed, fmt.Sprintf("%s → %s", u.Slug+"/"+v+"/"+line+".mp3", archive))
				}
				if prev, taken := usedArchive[archive]; taken && prev != u.Dir {
					missing = append(missing, fmt.Sprintf("归档路径冲突: %s（%s vs %s）", archive, prev, u.Dir))
					continue
				}
				usedArchive[archive] = u.Dir
				entries = append(entries, packEntry{
					Slug:    u.Slug,
					LineID:  line,
					Voice:   v,
					Dir:     u.Dir,
					Kind:    u.Kind,
					Archive: archive,
					SrcPath: abs,
					Size:    info.Size(),
				})
			}
		}
	}

	sort.Strings(missing)
	sort.Strings(zeroByte)
	if len(missing) > 0 || len(zeroByte) > 0 {
		fmt.Fprintf(os.Stderr, "音频不完整：缺失 %d，零字节 %d\n", len(missing), len(zeroByte))
		printLimited(os.Stderr, "缺失", missing)
		printLimited(os.Stderr, "零字节", zeroByte)
		if *strict {
			os.Exit(1)
		}
		fmt.Fprintln(os.Stderr, "（-strict=false：继续打包现有文件）")
	}

	sort.Slice(entries, func(i, j int) bool { return entries[i].Archive < entries[j].Archive })

	var totalBytes int64
	for _, e := range entries {
		totalBytes += e.Size
	}
	slugSeen := map[string]bool{}
	for _, e := range entries {
		slugSeen[e.Slug] = true
	}

	fmt.Printf("音频目录 : %s\n输出归档 : %s\n", *audioDir, *outPath)
	fmt.Printf("讲解单元 : 展项 %d 个 / 里程碑 %d 个（同名 slug %d 个）\n",
		len(expDirBySlug), len(msDirBySlug), len(collisions))
	fmt.Printf("音色     : %v\n", voices)
	fmt.Printf("待打包   : %d 个文件 / %.1f MB\n", len(entries), float64(totalBytes)/1024/1024)
	if len(collisions) > 0 {
		fmt.Printf("同名处理 : 归档共用 <slug>/，落盘按清单区分 <experiment_id> 与 ms<id>；\n"+
			"           两侧同 line_id 但文本不同，里程碑侧按 <ms-id>.<line>.mp3 消歧（%d 个）\n",
			len(renamed))
		printLimited(os.Stdout, "  同名", collisions)
	}
	fmt.Println()

	// ---- 并发读文件并计算 SHA256 ----
	type hashResult struct {
		idx  int
		sum  string
		err  error
		size int64
	}
	hashes := make([]string, len(entries))
	sizes := make([]int64, len(entries))
	jobs := make(chan int)
	results := make(chan hashResult, len(entries))
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				sum, n, err := hashFile(entries[idx].SrcPath)
				results <- hashResult{idx: idx, sum: sum, err: err, size: n}
			}
		}()
	}
	go func() {
		for i := range entries {
			jobs <- i
		}
		close(jobs)
	}()
	go func() {
		wg.Wait()
		close(results)
	}()

	done := 0
	var hashErrs []string
	for r := range results {
		if r.err != nil {
			hashErrs = append(hashErrs, fmt.Sprintf("%s: %v", entries[r.idx].Archive, r.err))
			continue
		}
		hashes[r.idx] = r.sum
		sizes[r.idx] = r.size
		done++
		if done%2000 == 0 {
			fmt.Printf("  已校验 %d / %d\n", done, len(entries))
		}
	}
	if len(hashErrs) > 0 {
		fmt.Fprintf(os.Stderr, "读取音频失败 %d 个：\n", len(hashErrs))
		printLimited(os.Stderr, "  读取失败", hashErrs)
		os.Exit(1)
	}

	// ---- 清单（内容不变 → 指纹不变）----
	entryMans := make([]entryManifest, 0, len(entries))
	digests := make([]map[string]any, 0, len(entries))
	for i, e := range entries {
		entryMans = append(entryMans, entryManifest{Path: e.Archive, Dir: e.Dir, Kind: e.Kind, Size: sizes[i]})
		digests = append(digests, map[string]any{"path": e.Archive, "size": sizes[i], "sha256": hashes[i]})
	}
	mf := manifest{
		Version:    manifestVer,
		Layout:     "slug/voice/line.mp3",
		SlugCount:  len(slugSeen),
		FileCount:  len(entries),
		TotalBytes: totalBytes,
		Collisions: collisions,
		Entries:    entryMans,
	}
	manifestRaw, err := json.Marshal(mf)
	if err != nil {
		fmt.Fprintf(os.Stderr, "生成清单失败: %v\n", err)
		os.Exit(1)
	}
	sum := sha256.Sum256(manifestRaw)
	fingerprint := hex.EncodeToString(sum[:])
	fmt.Printf("清单指纹 : %s\n\n", fingerprint)

	// ---- 写归档 ----
	if err := os.MkdirAll(filepath.Dir(*outPath), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "创建输出目录失败: %v\n", err)
		os.Exit(1)
	}
	tmpZip := *outPath + ".tmp"
	_ = os.Remove(tmpZip)
	f, err := os.Create(tmpZip)
	if err != nil {
		fmt.Fprintf(os.Stderr, "创建归档失败: %v\n", err)
		os.Exit(1)
	}
	zw := zip.NewWriter(f)

	writeCount := 0
	fail := func(format string, args ...any) {
		fmt.Fprintf(os.Stderr, format+"\n", args...)
		_ = zw.Close()
		_ = f.Close()
		_ = os.Remove(tmpZip)
		os.Exit(1)
	}

	for i, e := range entries {
		hdr := &zip.FileHeader{Name: e.Archive, Method: zip.Store} // mp3 已压缩，Store 更快
		hdr.SetMode(0o644)
		w, err := zw.CreateHeader(hdr)
		if err != nil {
			fail("写入归档条目 %s 失败: %v", e.Archive, err)
		}
		src, err := os.Open(e.SrcPath)
		if err != nil {
			fail("打开 %s 失败: %v", e.SrcPath, err)
		}
		n, err := io.Copy(w, src)
		_ = src.Close()
		if err != nil {
			fail("写入 %s 失败: %v", e.Archive, err)
		}
		if n != e.Size || n != sizes[i] {
			fail("写入 %s 字节数不符：%d != %d", e.Archive, n, e.Size)
		}
		writeCount++
	}

	// 清单最后写：解压完所有音频才需要它
	full := map[string]any{
		"version":     manifestVer,
		"layout":      mf.Layout,
		"fingerprint": fingerprint,
		"slug_count":  mf.SlugCount,
		"file_count":  mf.FileCount,
		"total_bytes": mf.TotalBytes,
		"collisions":  mf.Collisions,
		"entries":     mf.Entries,
		"files":       digests,
	}
	mhdr := &zip.FileHeader{Name: manifestName, Method: zip.Deflate}
	mhdr.SetMode(0o644)
	mw, err := zw.CreateHeader(mhdr)
	if err != nil {
		fail("写入清单失败: %v", err)
	}
	if err := json.NewEncoder(mw).Encode(full); err != nil {
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
	if err := os.Rename(tmpZip, *outPath); err != nil {
		fail("归档改名失败: %v", err)
	}

	zipped := int64(0)
	if info, statErr := os.Stat(*outPath); statErr == nil {
		zipped = info.Size()
	}
	fmt.Printf("完成：%d 个音频 + 1 个清单 → %.1f MB（原始 %.1f MB）\n",
		writeCount, float64(zipped)/1024/1024, float64(totalBytes)/1024/1024)

	if *reportPath != "" {
		rep := map[string]any{
			"archive":         *outPath,
			"archive_bytes":   zipped,
			"fingerprint":     fingerprint,
			"slug_count":      mf.SlugCount,
			"file_count":      writeCount,
			"total_bytes":     totalBytes,
			"voices":          voices,
			"experiments":     len(expDirBySlug),
			"milestones":      len(msDirBySlug),
			"slug_collisions": nonNil(collisions),
			"renamed":         nonNil(renamed),
			"missing_files":   nonNil(missing),
			"zero_byte":       nonNil(zeroByte),
			"audio_dir":       *audioDir,
			"db":              *dbPath,
		}
		buf, _ := json.MarshalIndent(rep, "", "  ")
		if err := os.WriteFile(*reportPath, buf, 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "写报告失败: %v\n", err)
		} else {
			fmt.Printf("报告 -> %s\n", *reportPath)
		}
	}
}

// nonNil 把 nil 切片规整成空切片。
//
// 否则 json.Marshal 会把 nil 写成 null，读取方（PowerShell 等）需要额外区分
// null 与 []，很容易误判成"有缺失文件"而让构建失败。
func nonNil(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}

// verifyArchive 自检已生成的归档：清单与条目一一对应、落盘路径唯一、内容哈希一致。
//
// 安装前跑一遍可以确认"解压后每条讲解都能取到自己的音频"，而不用真的装一次。
func verifyArchive(zipPath string) error {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("打开归档失败: %w", err)
	}
	defer zr.Close()

	var doc struct {
		Version     int    `json:"version"`
		Fingerprint string `json:"fingerprint"`
		SlugCount   int    `json:"slug_count"`
		FileCount   int    `json:"file_count"`
		TotalBytes  int64  `json:"total_bytes"`
		Collisions  []string
		Entries     []struct {
			Path string `json:"path"`
			Dir  string `json:"dir"`
			Kind string `json:"kind"`
			Size int64  `json:"size"`
		} `json:"entries"`
		Files []struct {
			Path   string `json:"path"`
			Size   int64  `json:"size"`
			SHA256 string `json:"sha256"`
		} `json:"files"`
	}

	audio := map[string]*zip.File{}
	slugs := map[string]bool{}
	for _, f := range zr.File {
		if f.Name == manifestName {
			rc, err := f.Open()
			if err != nil {
				return fmt.Errorf("读取清单失败: %w", err)
			}
			decErr := json.NewDecoder(rc).Decode(&doc)
			_ = rc.Close()
			if decErr != nil {
				return fmt.Errorf("解析清单失败: %w", decErr)
			}
			continue
		}
		audio[f.Name] = f
		if parts := strings.Split(f.Name, "/"); len(parts) > 0 {
			slugs[parts[0]] = true
		}
	}
	if doc.Version == 0 {
		return fmt.Errorf("归档缺少 %s（旧格式：解压只能靠 slug 猜目录，里程碑音频会落错位置）", manifestName)
	}

	problems := []string{}
	if len(doc.Entries) != len(audio) {
		problems = append(problems, fmt.Sprintf("清单条目 %d != 归档音频 %d", len(doc.Entries), len(audio)))
	}

	// 每个归档条目都必须被清单声明，且落盘路径唯一
	dest := map[string]string{}
	declared := map[string]bool{}
	for _, e := range doc.Entries {
		declared[e.Path] = true
		if _, ok := audio[e.Path]; !ok {
			problems = append(problems, "清单里有、归档里没有: "+e.Path)
			continue
		}
		if !isSafeDir(e.Dir) {
			problems = append(problems, fmt.Sprintf("落盘目录不合法: %s -> %s", e.Path, e.Dir))
			continue
		}
		if e.Kind == kindMilestone && !strings.HasPrefix(e.Dir, "ms") {
			problems = append(problems, fmt.Sprintf("里程碑落点不是 ms<id>: %s -> %s", e.Path, e.Dir))
		}
		if e.Kind == kindExperiment && strings.HasPrefix(e.Dir, "ms") {
			problems = append(problems, fmt.Sprintf("展项落点却是 ms<id>: %s -> %s", e.Path, e.Dir))
		}
		parts := strings.SplitN(e.Path, "/", 2)
		name := parts[len(parts)-1]
		if prefix := e.Dir + "."; strings.HasPrefix(name, prefix) {
			name = strings.TrimPrefix(name, prefix)
		}
		key := e.Dir + "/" + name
		if prev, ok := dest[key]; ok && prev != e.Path {
			problems = append(problems, fmt.Sprintf("落盘冲突: %s 同时来自 %s 与 %s", key, prev, e.Path))
		}
		dest[key] = e.Path
	}
	for name := range audio {
		if !declared[name] {
			problems = append(problems, "归档里有、清单里没有: "+name)
		}
	}

	// 抽样校验内容哈希（前 200 个）
	digest := map[string]string{}
	sizeByPath := map[string]int64{}
	for _, f := range doc.Files {
		digest[f.Path] = f.SHA256
		sizeByPath[f.Path] = f.Size
	}
	names := make([]string, 0, len(audio))
	for n := range audio {
		names = append(names, n)
	}
	sort.Strings(names)
	checked, mismatch := 0, 0
	for _, n := range names {
		if checked >= 200 {
			break
		}
		want, ok := digest[n]
		if !ok {
			continue
		}
		rc, err := audio[n].Open()
		if err != nil {
			problems = append(problems, "打开失败: "+n)
			mismatch++
			continue
		}
		h := sha256.New()
		size, copyErr := io.Copy(h, rc)
		_ = rc.Close()
		if copyErr != nil {
			problems = append(problems, "读取失败: "+n)
			mismatch++
			continue
		}
		if size != sizeByPath[n] || hex.EncodeToString(h.Sum(nil)) != want {
			problems = append(problems, "内容校验失败: "+n)
			mismatch++
		}
		checked++
	}

	info, _ := os.Stat(zipPath)
	fmt.Printf("=== 归档校验 ===\n归档        : %s\n", zipPath)
	if info != nil {
		fmt.Printf("体积        : %.1f MB\n", float64(info.Size())/1024/1024)
	}
	fmt.Printf("条目        : %d 个音频 + 1 个清单\n", len(audio))
	fmt.Printf("slug        : 清单 %d / 实际 %d\n", doc.SlugCount, len(slugs))
	fmt.Printf("落盘目标    : %d 个（唯一）\n", len(dest))
	fmt.Printf("同名 slug   : %d 个\n", len(doc.Collisions))
	fmt.Printf("sha256 抽查 : %d 个，失败 %d 个\n", checked, mismatch)
	fmt.Printf("清单指纹    : %s\n", doc.Fingerprint)

	if len(problems) > 0 {
		printLimited(os.Stderr, "问题", problems)
		return fmt.Errorf("发现 %d 个问题", len(problems))
	}
	fmt.Printf("结论        : 通过（结构、落点、内容均自洽）\n")
	return nil
}

// isSafeDir 校验落盘目录名：全数字（展项）或 ms+数字（里程碑）。
func isSafeDir(dir string) bool {
	if dir == "" {
		return false
	}
	digits := dir
	if strings.HasPrefix(dir, "ms") {
		digits = dir[2:]
	}
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

func printLimited(w *os.File, label string, items []string) {
	for i, s := range items {
		if i >= 10 {
			fmt.Fprintf(w, "  ... 其余 %d 个%s\n", len(items)-10, label)
			return
		}
		fmt.Fprintf(w, "  %s %s\n", label, s)
	}
}

func hashFile(path string) (string, int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(h.Sum(nil)), n, nil
}

// dedupStrings 去重并排序。
func dedupStrings(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}

func splitCSV(s string) []string {
	out := []string{}
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
