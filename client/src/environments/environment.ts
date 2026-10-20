// 开发环境配置：后端与前端分离运行（Angular dev server 4200 代理到 Go 8080）。
export const environment = {
  production: false,
  /** 后端 REST API 基地址 */
  apiBase: 'http://localhost:8080/api/v1',
  /** 后端根地址（讲解音频等静态资源使用） */
  serverBase: 'http://localhost:8080',
};
