import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <header class="app-header">
        <div class="logo">
          <span class="logo-icon">⚛</span>
          <span class="logo-text">物理之美</span>
        </div>
        <nav class="app-nav">
          <a routerLink="/" routerLinkActive="active">首页</a>
          <a routerLink="/scale" routerLinkActive="active">尺度穿越</a>
          <a routerLink="/milestones" routerLinkActive="active">时间线</a>
          <a routerLink="/figures" routerLinkActive="active">物理学家</a>
          <a routerLink="/library" routerLinkActive="active">素材库</a>
          <a routerLink="/progress" routerLinkActive="active">学习进度</a>
          <a routerLink="/bookmarks" routerLinkActive="active">我的收藏</a>
          <a routerLink="/models" routerLinkActive="active">模型配置</a>
          <a routerLink="/admin" routerLinkActive="active" *ngIf="auth.isAdmin()">管理</a>
          <a routerLink="/review" routerLinkActive="active" *ngIf="auth.isAdmin()">审核</a>
          <a routerLink="/login" *ngIf="!isLoggedIn()" class="btn-login">登录</a>
          <a *ngIf="isLoggedIn()" class="btn-login" (click)="logout()">退出（{{ username }}）</a>
        </nav>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
      <footer class="app-footer">
        <p>物理之美 — 真实锚点 · 尺度穿越 · 抽象可视化 · 未知敬畏</p>
      </footer>
    </div>
  `,
  styles: [`
    .app-container { min-height: 100vh; display: flex; flex-direction: column; background: #f5f7fa; }
    .app-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 0 2rem; height: 64px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100;
    }
    .logo { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; font-weight: bold; }
    .logo-icon { font-size: 1.8rem; }
    .app-nav { display: flex; gap: 1.5rem; align-items: center; }
    .app-nav a { color: rgba(255,255,255,0.85); text-decoration: none; padding: 0.5rem 0; border-bottom: 2px solid transparent; transition: all 0.2s; cursor: pointer; }
    .app-nav a:hover, .app-nav a.active { color: white; border-bottom-color: white; }
    .btn-login { padding: 0.4rem 1rem; background: rgba(255,255,255,0.15); border-radius: 6px; border: 1px solid rgba(255,255,255,0.3); }
    .app-main { flex: 1; padding: 2rem; max-width: 1400px; margin: 0 auto; width: 100%; }
    .app-footer { background: #2d3748; color: rgba(255,255,255,0.6); text-align: center; padding: 1rem; font-size: 0.875rem; }
  `]
})
export class AppComponent implements OnInit {
  constructor(public auth: AuthService) {}

  ngOnInit(): void {}

  get username(): string {
    return this.auth.user()?.username ?? '';
  }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  logout(): void {
    this.auth.logoutAndRedirect();
  }
}
