import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, UserProgress } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="progress-page">
      <h1>学习进度</h1>

      <!-- 计入规则说明：让用户清楚「已学习」与「已完成」分别何时产生 -->
      <div class="rule-hint">
        <strong>计入规则</strong>
        <span>打开任意实验即记为「已学习」；把该实验的语音讲解播放到最后一句，自动记为「已完成」。</span>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ total() }}</span>
          <span class="stat-label">已学习</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ completed() }}</span>
          <span class="stat-label">已完成</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ pct() }}%</span>
          <span class="stat-label">完成率</span>
        </div>
      </div>

      <div class="progress-list">
        <div *ngFor="let p of progresses()" class="progress-item">
          <div class="progress-info">
            <a [routerLink]="['/experiment', getExperimentSlug(p)]" class="progress-title">{{ getExperimentTitle(p) }}</a>
            <div class="progress-meta">
              <span *ngIf="p.experiment?.category?.name" class="progress-cat">{{ p.experiment!.category!.name }}</span>
              <span class="progress-time">最近学习 {{ formatDate(p.last_access) }}</span>
            </div>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar" [style.width.%]="getProgressPercent(p)"></div>
          </div>
          <span class="progress-badge" [class.completed]="p.completed">{{ p.completed ? '✓ 已完成' : '学习中' }}</span>
        </div>

        <div *ngIf="progresses().length === 0" class="empty-state">
          <p>{{ notice() || '还没有学习记录，去首页探索实验吧！' }}</p>
          <a routerLink="/" class="btn btn-primary">开始学习</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .progress-page { max-width: 900px; margin: 0 auto; }
    .progress-page h1 { font-size: 1.75rem; margin-bottom: 1rem; }
    .rule-hint { background: #ebf4ff; border-left: 3px solid #667eea; color: #2a4365; font-size: 0.8rem; line-height: 1.6; padding: 0.65rem 0.9rem; border-radius: 6px; margin-bottom: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .rule-hint strong { color: #4c51bf; }
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .stat-value { display: block; font-size: 2rem; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 0.875rem; color: #718096; }
    .progress-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .progress-item { background: white; padding: 1rem 1.25rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 1rem; }
    .progress-info { flex: 1; min-width: 0; }
    .progress-title { font-weight: 600; color: #2d3748; text-decoration: none; }
    .progress-title:hover { color: #667eea; }
    .progress-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.2rem; }
    .progress-cat { font-size: 0.7rem; color: #667eea; background: #ebf4ff; padding: 0.1rem 0.45rem; border-radius: 8px; }
    .progress-time { font-size: 0.75rem; color: #a0aec0; }
    .progress-bar-wrap { width: 120px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
    .progress-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.3s; }
    .progress-badge { font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 12px; white-space: nowrap; background: #edf2f7; color: #4a5568; }
    .progress-badge.completed { background: #c6f6d5; color: #22543d; }
    .empty-state { text-align: center; padding: 3rem; color: #a0aec0; }
    .empty-state p { margin-bottom: 1rem; }
  `]
})
export class ProgressComponent implements OnInit {
  progresses = signal<UserProgress[]>([]);
  total = signal(0);
  completed = signal(0);
  pct = signal(0);
  /** 未登录或加载失败时的提示文案 */
  notice = signal('');

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadProgress();
  }

  /** 加载当前用户的学习进度并计算统计值。 */
  loadProgress(): void {
    if (!this.auth.isLoggedIn()) {
      this.notice.set('请先登录后查看学习进度');
      this.progresses.set([]);
      this.total.set(0);
      this.completed.set(0);
      this.pct.set(0);
      return;
    }
    this.notice.set('');
    this.api.getUserProgress().subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          const items = resp.data;
          const done = items.filter((p) => p.completed).length;
          this.progresses.set(items);
          this.total.set(items.length);
          this.completed.set(done);
          this.pct.set(items.length > 0 ? Math.round((done * 100) / items.length) : 0);
        }
      },
      error: () => {
        this.notice.set('加载学习进度失败，请稍后重试');
        this.progresses.set([]);
        this.total.set(0);
        this.completed.set(0);
        this.pct.set(0);
      },
    });
  }

  /** 实验标题：后端已预加载 experiment，缺失时回退显示编号。 */
  getExperimentTitle(p: UserProgress): string {
    return p.experiment?.title ?? `实验 #${p.experiment_id}`;
  }

  /** 实验路由参数：前端路由按 slug 匹配（/experiment/:slug）。 */
  getExperimentSlug(p: UserProgress): string {
    return p.experiment?.slug ?? String(p.experiment_id);
  }

  /** 进度条宽度：已完成 100%，否则按已播放句数估算。 */
  getProgressPercent(p: UserProgress): number {
    if (p.completed) return 100;
    return Math.min(90, Math.round((p.current_line / 10) * 100));
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  }
}
