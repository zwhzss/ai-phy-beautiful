// 物理之美 · 桌面端入口（需求.txt 第 7 条：wails build + NSIS 打包，自带 webview）。
//
// 架构：
//  1. 内嵌前端构建产物（client 的 Angular 产物复制到 desktop/frontend/dist）；
//  2. 通过 server/pkg/desktop 在进程内启动既有的 Go/Gin 后端（本地随机高位端口），
//     数据库与音频落在 %APPDATA%\phy-beauty，避免安装目录不可写；
//  3. webview 的所有请求交给同一个 http.Handler：/api 与 /audio 反向代理给内嵌后端，
//     其余路径由内嵌静态资源服务，未知路径回退 index.html（SPA 路由）。
//
// 这样前端与后端同源，生产环境配置里的相对路径 `/api/v1` 天然可用。
package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"

	"github.com/ai-phy-beautiful/server/pkg/desktop"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// 内嵌前端产物（与 wails.json 中的前端目录保持一致）。
//
//go:embed all:frontend/dist
var assets embed.FS

// 内嵌资源中的前端根目录。
const webRoot = "frontend/dist"

// App 暴露给前端的少量原生能力。
type App struct {
	ctx     context.Context
	backend *desktop.Backend
	// startupErr 非 nil 表示内嵌后端启动失败：窗口仍会打开（方便查看界面与日志），
	// 就绪后弹窗告知用户，并指向 startup.log —— 避免"页面能开、API 全挂"却无任何提示。
	startupErr error
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.backend != nil {
		wailsruntime.LogInfo(ctx, fmt.Sprintf("物理之美已就绪，数据目录：%s", a.backend.DataDir))
	}
	if a.startupErr != nil {
		_, _ = wailsruntime.MessageDialog(ctx, wailsruntime.MessageDialogOptions{
			Type:    wailsruntime.ErrorDialog,
			Title:   "后端启动失败",
			Message: fmt.Sprintf("内嵌后端未能启动：注册、登录与内容加载将不可用。\n\n错误：%v\n\n排查日志：%%APPDATA%%\\phy-beauty\\startup.log\n多数情况下重启应用即可恢复；若反复出现，请附带该日志反馈。", a.startupErr),
			Buttons: []string{"知道了"},
		})
	}
}

// shutdown 在窗口关闭、应用退出前调用：优雅关闭内嵌后端（关闭数据库连接），
// 保证关闭窗口后不残留进程占用数据库文件。
func (a *App) shutdown(ctx context.Context) {
	if a.backend != nil {
		a.backend.Stop()
	}
}

// DataDir 返回数据目录（数据库与讲解音频所在位置）。
func (a *App) DataDir() string {
	if a.backend == nil {
		return ""
	}
	return a.backend.DataDir
}

// Version 返回应用版本号。
func (a *App) Version() string {
	return "1.0.0"
}

func main() {
	// 1) 在进程内启动后端（含数据库初始化、种子数据与静态路由）。
	backend, err := desktop.StartBackend(desktop.DefaultDataDir())
	if err != nil {
		// 后端异常时仍打开窗口，由界面显示错误，便于用户排查。
		// 注意：用 fmt 而非 log——log 包在初始化时已缓存旧的 os.Stderr（GUI 黑洞），
		// fmt 才能写进 StartBackend 重定向后的 startup.log。
		fmt.Fprintf(os.Stderr, "后端启动异常: %v\n", err)
	}

	// 2) 组装 webview 入口：优先使用反向代理 handler（同源 API），否则退回纯静态资源。
	assetOpts := &assetserver.Options{Assets: assets}
	if backend != nil {
		handler, herr := backend.Handler(assets, webRoot)
		if herr != nil {
			log.Fatalf("初始化静态资源失败: %v", herr)
		}
		assetOpts = &assetserver.Options{Handler: handler}
	}

	app := &App{backend: backend, startupErr: err}
	runErr := wails.Run(&options.App{
		Title:       "物理之美",
		Width:       1440,
		Height:      920,
		MinWidth:    1024,
		MinHeight:   680,
		AssetServer: assetOpts,
		OnStartup:   app.startup,
		OnShutdown:  app.shutdown,
		Bind:        []interface{}{app},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	// 窗口已关闭：先优雅收尾，再确保进程彻底退出（不留下占用数据库/音频的后台进程）。
	if backend != nil {
		backend.Stop()
	}
	if runErr != nil {
		log.Fatalf("启动桌面窗口失败: %v", runErr)
	}
	os.Exit(0)
}
