// Package desktop 为桌面端（Wails）提供进程内启动后端与组装 webview 入口的能力。
//
// 之所以放在 server 模块内，是因为 Go 的 internal 包只能被同一模块导入：
// 桌面端是一个独立模块（desktop/go.mod），必须通过本公开包间接复用 internal 业务代码。
package desktop

import (
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/router"
	"github.com/ai-phy-beautiful/server/internal/service"
)

// Backend 表示已在进程内启动的后端服务。
type Backend struct {
	// Port 为实际监听的本地端口（由系统分配，避免与用户其他服务冲突）。
	Port int
	// DataDir 为数据目录（数据库与音频所在位置）。
	DataDir string
	// DBPath 为 SQLite 文件绝对路径。
	DBPath string

	// stopOnce 保证 Stop 只执行一次（OnShutdown 与 main 收尾都会调用）。
	stopOnce sync.Once
}

// Stop 优雅关闭内嵌后端：关闭数据库连接。
//
// 桌面端关闭窗口时调用，避免 SQLite 留下未刷新的辅助文件或文件句柄；
// 进行中的讲解音频解压会随进程退出而终止，已完成的文件会被保留，下次启动自动续跑。
func (b *Backend) Stop() {
	if b == nil {
		return
	}
	b.stopOnce.Do(func() {
		db := repository.GetDB()
		if db == nil {
			return
		}
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
}

// DefaultDataDir 返回桌面端默认数据目录：<用户配置目录>/phy-beauty。
func DefaultDataDir() string {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "phy-beauty")
}

// StartBackend 在独立 goroutine 中启动 Gin 服务，并等待其就绪。
//
// dataDir 为空时使用 DefaultDataDir()。数据库、音频与可选配置都落在该目录，
// 避免安装目录（Program Files）不可写的问题。
func StartBackend(dataDir string) (*Backend, error) {
	if strings.TrimSpace(dataDir) == "" {
		dataDir = DefaultDataDir()
	}
	if err := os.MkdirAll(filepath.Join(dataDir, "audio"), 0o755); err != nil {
		return nil, fmt.Errorf("创建数据目录失败: %w", err)
	}

	// GUI 进程没有控制台：把 stdout/stderr 落到数据目录，否则启动错误无处可查
	//（曾出现后端静默失败、界面只报"注册失败"而日志全无的情况）。
	if lf, lerr := os.OpenFile(filepath.Join(dataDir, "startup.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); lerr == nil {
		os.Stdout = lf
		os.Stderr = lf
		fmt.Printf("\n[phy-beauty] 启动 %s，数据目录 %s\n", time.Now().Format(time.RFC3339), dataDir)
	}

	// 持有 listener 直到交给 Gin（RunListener）：先关再听会留下端口空闲窗口，
	// 被其他进程抢走即导致后端静默失败（本机 8080 常被其他项目占用的教训）。
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("申请本地端口失败: %w", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	dbPath := filepath.Join(dataDir, "phy-beauty.db")
	setenv("APP_ENV", "production")
	setenv("SERVER_PORT", fmt.Sprintf("%d", port))
	setenv("DB_PATH", dbPath)
	setenv("AUDIO_DIR", filepath.Join(dataDir, "audio"))
	// 素材资产目录：安装版工作目录在 Program Files（只读），必须显式落到可写数据目录，
	// 否则 buildRouter 里按相对路径创建 data/assets 会 Access denied，导致后端整体起不来。
	setenv("ASSETS_DIR", filepath.Join(dataDir, "assets"))
	// 可选：用户可在数据目录放 config.yaml 覆盖默认配置（不存在则用内置默认值）。
	setenv("APP_CONFIG", filepath.Join(dataDir, "config.yaml"))

	// 分步计时：GUI 启动没有控制台，把各阶段耗时写进 startup.log 便于回答"启动为什么慢"。
	mark := func(stage string, since time.Time) {
		fmt.Fprintf(os.Stderr, "[timing] %s: %v\n", stage, time.Since(since).Round(time.Millisecond))
	}
	tStart := time.Now()

	cfg, err := config.Load()
	if err != nil {
		_ = ln.Close()
		return nil, fmt.Errorf("加载配置失败: %w", err)
	}
	if err := service.InitDB(cfg); err != nil {
		_ = ln.Close()
		return nil, fmt.Errorf("初始化数据库失败: %w", err)
	}
	mark("InitDB(建表+种子600展项)", tStart)

	// 首次运行：把内置讲解稿件写入数据库（很快，同步执行）。
	tScripts := time.Now()
	if exps, lines, err := EnsureNarrationScripts(); err != nil {
		fmt.Fprintf(os.Stderr, "讲解稿件初始化失败: %v\n", err)
	} else if exps > 0 {
		fmt.Printf("讲解稿件初始化：%d 个实验 / %d 行台词\n", exps, lines)
	}
	mark("EnsureNarrationScripts(讲解稿)", tScripts)

	// 稿件入库之后再补一次种子版文稿自愈：InitDB 里的基线快照早于这一步，
	// 老库里因此可能存在「存档文稿为空、库里有台词」的展项（前端显示"还没有讲解稿"）。
	tRepair := time.Now()
	if fixed, err := RepairSeedNarrations(); err != nil {
		fmt.Fprintf(os.Stderr, "种子版文稿自愈失败: %v\n", err)
	} else if fixed > 0 {
		fmt.Printf("种子版文稿自愈：回填 %d 个展项\n", fixed)
	}
	mark("RepairSeedNarrations(种子版文稿自愈)", tRepair)

	// 音频归档约数百 MB，放到后台解压，避免阻塞窗口显示。
	go func() {
		if _, found, err := EnsureNarrationAudio(dataDir); err != nil {
			fmt.Fprintf(os.Stderr, "讲解音频初始化失败: %v\n", err)
		} else if !found {
			fmt.Println("未找到讲解音频归档，跳过音频初始化（可在管理后台用 TTS 生成）")
		}
	}()

	// 素材资产（图片/数据集）体积很小，同样在后台解压；缺失时资料页只有元数据没有图。
	go func() {
		if _, found, err := EnsureMaterialAssets(dataDir); err != nil {
			fmt.Fprintf(os.Stderr, "素材资产初始化失败: %v\n", err)
		} else if !found {
			fmt.Println("未找到素材资产归档，跳过素材初始化")
		}
	}()

	go func() {
		if err := router.StartWithListener(cfg, ln); err != nil {
			fmt.Fprintf(os.Stderr, "后端服务退出: %v\n", err)
		}
	}()

	be := &Backend{Port: port, DataDir: dataDir, DBPath: dbPath}
	tReady := time.Now()
	if err := be.waitReady(20 * time.Second); err != nil {
		mark("waitReady(就绪轮询,超时=失败)", tReady)
		return be, err
	}
	mark("router.Start+waitReady(后端就绪)", tReady)
	mark("StartBackend 总耗时", tStart)
	return be, nil
}

// waitReady 轮询健康接口，确认后端已可服务请求。
func (b *Backend) waitReady(timeout time.Duration) error {
	target := fmt.Sprintf("http://127.0.0.1:%d/api/v1/categories", b.Port)
	client := &http.Client{Timeout: 1500 * time.Millisecond}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := client.Get(target)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("等待后端就绪超时（%s）", target)
}

// backendPrefixes 是必须反向代理给内嵌后端的路径前缀。
//
// 内嵌前端只带 SPA 自己的产物，后端另有静态目录：/audio（讲解音频）与
// /phy-assets（真实素材库图片/数据集）。这些前缀必须列在这里，否则请求会落到
// 「未命中内嵌文件 → 回退 index.html」分支，图片拿到一坨 HTML 而整页空白
// （素材元数据来自 /api/v1/assets，走代理，所以卡片齐全但图全空，很有迷惑性）。
// 后端新增静态路由时也要同步加进来。
var backendPrefixes = []string{"/api/", "/audio/", "/phy-assets/"}

// proxyBackend 判断该路径是否应由内嵌后端处理。
func proxyBackend(path string) bool {
	for _, p := range backendPrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// Handler 组装 webview 的唯一入口处理器：
//
//	backendPrefixes 前缀 → 反向代理到内嵌后端（前端因此与后端同源，无需 CORS）
//	命中静态资源         → 直接返回内嵌文件
//	其余路径             → 回退 index.html（支持 Angular 客户端路由）
//
// webRoot 是内嵌资源中的前端根目录名（例如 "frontend/dist"）。
func (b *Backend) Handler(assets fs.FS, webRoot string) (http.Handler, error) {
	sub, err := fs.Sub(assets, webRoot)
	if err != nil {
		return nil, fmt.Errorf("定位内嵌前端目录 %s 失败: %w", webRoot, err)
	}
	indexHTML, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		return nil, fmt.Errorf("内嵌前端缺少 index.html: %w", err)
	}

	target, err := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", b.Port))
	if err != nil {
		return nil, err
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	// -1 表示收到数据立即 flush：否则 SSE 流式响应会被代理缓冲，
	// 前端就无法实时看到 AI 的逐段输出（只能等全部结束一次性显示）。
	proxy.FlushInterval = -1
	// 保留原始 Content-Type，避免被改写后失去 SSE 语义。
	proxy.ModifyResponse = func(resp *http.Response) error {
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, perr error) {
		http.Error(w, "后端服务不可用: "+perr.Error(), http.StatusBadGateway)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if proxyBackend(path) {
			proxy.ServeHTTP(w, r)
			return
		}
		if clean := strings.TrimPrefix(path, "/"); clean != "" {
			if f, openErr := sub.Open(clean); openErr == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(indexHTML)
	}), nil
}

func setenv(key, value string) {
	if err := os.Setenv(key, value); err != nil {
		fmt.Fprintf(os.Stderr, "设置环境变量 %s 失败: %v\n", key, err)
	}
}
