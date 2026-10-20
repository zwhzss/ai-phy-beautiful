package desktop

import (
	"bytes"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"
)

// 回归：素材库图片走 /phy-assets/*（后端静态目录），必须被代理到内嵌后端。
// 此前该前缀不在代理名单里，请求落到「回退 index.html」分支，<img> 拿到 HTML，
// 卡片齐全但图全空 —— 安装版（Wails 单进程）特有，dev（4200 前端直连 8080）看不出来。
func TestHandlerProxiesBackendStaticPrefixes(t *testing.T) {
	jpegBody := append([]byte{0xff, 0xd8, 0xff, 0xe0}, []byte("fake-jpeg-payload")...)

	var gotPath string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write(jpegBody)
	}))
	defer backend.Close()

	port := serverPort(t, backend.URL)
	be := &Backend{Port: port}
	handler, err := be.Handler(testFrontend(), "web")
	if err != nil {
		t.Fatalf("组装 Handler 失败: %v", err)
	}

	for _, path := range []string{"/phy-assets/image/cmb.jpg", "/audio/1/yunxi/1.mp3", "/api/v1/assets"} {
		gotPath = ""
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

		if rec.Code != http.StatusOK {
			t.Errorf("%s: 状态码 = %d，期望 200（响应体 %q）", path, rec.Code, rec.Body.String())
			continue
		}
		if gotPath != path {
			t.Errorf("%s: 没走到内嵌后端（后端收到 %q）", path, gotPath)
		}
		if !bytes.Equal(rec.Body.Bytes(), jpegBody) {
			t.Errorf("%s: 响应体不是后端内容，而是 %q", path, rec.Body.String())
		}
	}
}

// SPA 客户端路由（/assets、/milestones/... 等）仍要回退 index.html，
// 内嵌产物必须优先返回，不能被代理规则抢走。
func TestHandlerServesSPAAndEmbeddedFiles(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	defer backend.Close()

	be := &Backend{Port: serverPort(t, backend.URL)}
	handler, err := be.Handler(testFrontend(), "web")
	if err != nil {
		t.Fatalf("组装 Handler 失败: %v", err)
	}

	// 内嵌产物（Angular 的 /assets/ 目录）直接命中，不走代理。
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/assets/app.js", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "console.log(1)" {
		t.Errorf("/assets/app.js: 状态码 %d 响应体 %q，期望内嵌产物", rec.Code, rec.Body.String())
	}

	// 客户端路由回退 index.html。
	for _, path := range []string{"/", "/assets-library", "/milestones/relativity"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "index") {
			t.Errorf("%s: 状态码 %d 响应体 %q，期望回退 index.html", path, rec.Code, rec.Body.String())
		}
	}
}

func TestProxyBackendPrefixes(t *testing.T) {
	proxied := []string{"/api/v1/assets", "/audio/1/yunxi/1.mp3", "/phy-assets/image/cmb.jpg"}
	for _, p := range proxied {
		if !proxyBackend(p) {
			t.Errorf("%s 应代理给内嵌后端", p)
		}
	}
	local := []string{"/", "/assets/app.js", "/phy-assets", "/favicon.ico", "/milestones/relativity"}
	for _, p := range local {
		if proxyBackend(p) {
			t.Errorf("%s 不该代理（应由内嵌前端处理）", p)
		}
	}
}

// testFrontend 构造一个最小内嵌前端：index.html + Angular 的 /assets 目录。
func testFrontend() fs.FS {
	return fstest.MapFS{
		"web/index.html":    {Data: []byte("<html>index</html>")},
		"web/assets/app.js": {Data: []byte("console.log(1)")},
	}
}

// serverPort 从 httptest 服务地址里取出端口，喂给 Backend（Handler 只按端口建反向代理）。
func serverPort(t *testing.T, rawURL string) int {
	t.Helper()
	idx := strings.LastIndex(rawURL, ":")
	if idx < 0 {
		t.Fatalf("无法从 %q 解析端口", rawURL)
	}
	port, err := strconv.Atoi(rawURL[idx+1:])
	if err != nil {
		t.Fatalf("无法从 %q 解析端口: %v", rawURL, err)
	}
	return port
}
