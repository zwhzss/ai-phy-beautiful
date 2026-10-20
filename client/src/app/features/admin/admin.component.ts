import { Component, OnInit, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, AdminStats } from '../../core/services/api.service';
import { ContentPanelComponent } from './content-panel.component';
import { ExperimentsPanelComponent } from './experiments-panel.component';

type AdminTab = 'overview' | 'models' | 'content' | 'data';

/**
 * 管理后台外壳：概览统计 + 内容生产 / 实验与讲解。
 * 注意：大模型配置统一放在导航栏的「模型配置」页（/models），此处不再重复提供入口。
 *
 * 对应需求 4（AI 生成教学内容）、需求 5（画面配置大模型）、需求 6（语音合成）
 * 与实验/讲解的数据维护。
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, ContentPanelComponent, ExperimentsPanelComponent],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h1>管理后台</h1>
        <div class="header-actions">
          <a routerLink="/" class="btn-back">返回主页</a>
          <button (click)="logout()" class="btn-back">退出登录</button>
        </div>
      </div>

      <!-- 标签导航 -->
      <nav class="tabs">
        <button *ngFor="let t of tabs" class="tab" [class.active]="tab() === t.id" (click)="tab.set(t.id)">
          {{ t.label }}
        </button>
      </nav>

      <!-- 概览 -->
      <div *ngIf="tab() === 'overview'">
        <div class="stats-grid" *ngIf="stats()">
          <div class="stat-card"><span class="stat-value">{{ stats()!.experiments }}</span><span class="stat-label">实验总数</span></div>
          <div class="stat-card"><span class="stat-value">{{ stats()!.categories }}</span><span class="stat-label">分类数</span></div>
          <div class="stat-card"><span class="stat-value">{{ stats()!.narrations }}</span><span class="stat-label">讲解条数</span></div>
          <div class="stat-card"><span class="stat-value">{{ stats()!.ai_models }}</span><span class="stat-label">大模型配置</span></div>
          <div class="stat-card"><span class="stat-value">{{ stats()!.audio_lines_yunxi }}</span><span class="stat-label">云希音频</span></div>
          <div class="stat-card"><span class="stat-value">{{ stats()!.audio_lines_xiaoxiao }}</span><span class="stat-label">晓晓音频</span></div>
        </div>

        <div class="cards">
          <div class="card">
            <h3>内容生成进度</h3>
            <div class="bar-row" *ngFor="let s of statusRows()">
              <span class="bar-label">{{ s.label }}</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="s.percent" [style.background]="s.color"></div></div>
              <span class="bar-value">{{ s.count }}</span>
            </div>
          </div>

          <div class="card">
            <h3>各难度实验数</h3>
            <div class="bar-row" *ngFor="let d of difficultyRows()">
              <span class="bar-label">{{ d.label }}</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="d.percent" style="background: #667eea"></div></div>
              <span class="bar-value">{{ d.count }}</span>
            </div>
          </div>
        </div>

        <div class="card actions-card">
          <h3>数据初始化</h3>
          <p class="desc">从内置种子数据填充/更新 376 个实验与 31 个分类（已存在的内容不会被覆盖）。</p>
          <button (click)="seedExperiments()" class="btn-action btn-seed" [disabled]="seeding()">
            {{ seeding() ? '填充中…' : '🌱 填充实验数据' }}
          </button>
          <div class="notice" *ngIf="message()">{{ message() }}</div>
        </div>
      </div>

      <!-- 内容生产 -->
      <content-panel *ngIf="tab() === 'content'"></content-panel>

      <!-- 实验与讲解 -->
      <experiments-panel *ngIf="tab() === 'data'"></experiments-panel>
    </div>
  `,
  styles: [`
    .admin-page { max-width: 1400px; margin: 0 auto; }
    .admin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .admin-header h1 { font-size: 1.5rem; color: #2d3748; }
    .header-actions { display: flex; gap: 0.6rem; }
    .btn-back { padding: 0.45rem 0.95rem; background: #fff; color: #4a5568; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; font-size: 0.85rem; cursor: pointer; }
    .tabs { display: flex; gap: 0.4rem; margin-bottom: 1.25rem; border-bottom: 1px solid #e2e8f0; }
    .tab { padding: 0.6rem 1.1rem; background: none; border: none; border-bottom: 2px solid transparent; color: #718096; font-size: 0.9rem; cursor: pointer; }
    .tab.active { color: #667eea; border-bottom-color: #667eea; font-weight: 600; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .stat-card { background: #fff; border-radius: 12px; padding: 1.1rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stat-value { display: block; font-size: 1.6rem; font-weight: 700; color: #667eea; }
    .stat-label { font-size: 0.78rem; color: #718096; }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
    @media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
    .card { background: #fff; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card h3 { font-size: 0.95rem; color: #2d3748; margin-bottom: 0.9rem; }
    .bar-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
    .bar-label { width: 90px; font-size: 0.78rem; color: #4a5568; }
    .bar-track { flex: 1; height: 10px; background: #edf2f7; border-radius: 5px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }
    .bar-value { width: 46px; text-align: right; font-size: 0.78rem; color: #718096; }
    .actions-card .desc { font-size: 0.8rem; color: #718096; margin-bottom: 0.9rem; }
    .btn-action { padding: 0.6rem 1.2rem; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; }
    .btn-seed { background: linear-gradient(135deg, #48bb78, #38a169); color: #fff; }
    .btn-seed:disabled { opacity: 0.6; cursor: default; }
    .notice { margin-top: 0.9rem; padding: 0.6rem 1rem; background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; color: #2a4365; font-size: 0.85rem; }
  `]
})
export class AdminComponent implements OnInit {
  readonly tabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'overview', label: '概览' },
    { id: 'content', label: '内容生产' },
    { id: 'data', label: '实验与讲解' },
  ];
  private readonly statusMeta: Array<[string, string, string]> = [
    ['ready', '已就绪', '#48bb78'],
    ['pending', '待生成', '#ed8936'],
    ['generating', '生成中', '#4299e1'],
    ['failed', '失败', '#f56565'],
  ];
  private readonly difficultyMeta: Array<[string, string]> = [
    ['basic', '小学'],
    ['intro', '初中'],
    ['intermediate', '高中'],
    ['advanced', '大学'],
    ['professional', '研究生'],
    ['academic', '学术级'],
  ];

  tab = signal<AdminTab>('overview');
  stats = signal<AdminStats | null>(null);
  seeding = signal(false);
  message = signal('');

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.api.getAdminStats().subscribe({
      next: (resp) => {
        if (resp.code === 0) this.stats.set(resp.data ?? null);
      },
      error: (err) => this.message.set(`统计加载失败：${err?.error?.message ?? err.message ?? '请确认管理员权限'}`),
    });
  }

  statusRows(): Array<{ label: string; count: number; percent: number; color: string }> {
    const s = this.stats();
    const total = Math.max(1, s?.experiments ?? 1);
    return this.statusMeta.map(([key, label, color]) => {
      const count = s?.content_status?.[key] ?? 0;
      return { label, count, percent: (count / total) * 100, color };
    });
  }

  difficultyRows(): Array<{ label: string; count: number; percent: number }> {
    const s = this.stats();
    const total = Math.max(1, s?.experiments ?? 1);
    return this.difficultyMeta.map(([key, label]) => {
      const count = s?.by_difficulty?.[key] ?? 0;
      return { label, count, percent: (count / total) * 100 };
    });
  }

  seedExperiments(): void {
    this.seeding.set(true);
    this.message.set('');
    this.api.seedExperiments().subscribe({
      next: (resp) => {
        this.seeding.set(false);
        if (resp.code === 0 && resp.data) {
          this.message.set(
            `种子数据已应用：分类 ${resp.data.categories} 个，新建实验 ${resp.data.experiments_created} 个，更新 ${resp.data.experiments_updated} 个，共 ${resp.data.total} 个`,
          );
        } else {
          this.message.set(resp.message ?? '填充失败');
        }
        this.loadStats();
      },
      error: (err) => {
        this.seeding.set(false);
        this.message.set(`填充失败：${err?.error?.message ?? err.message}`);
      },
    });
  }

  logout(): void {
    localStorage.removeItem('mb_token');
    localStorage.removeItem('mb_user');
    this.router.navigate(['/login']);
  }
}
