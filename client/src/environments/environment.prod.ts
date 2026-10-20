// 生产 / 桌面端（Wails）环境配置：前端由 Go 进程直接托管，使用同源相对路径。
export const environment = {
  production: true,
  apiBase: '/api/v1',
  serverBase: '',
};
