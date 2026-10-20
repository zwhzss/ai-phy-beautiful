import { Component, OnInit, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Experiment } from '../../core/services/api.service';

/**
 * 审核工作台（管理端，需求 FR-9 /《架构设计》§9 状态机）：
 * 提交 → 顾问通过 → 发布，每步留痕；发布前校验确定性标签（QA-1）。
 */
@Component({
  selector: 'app-review-workbench',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink],
  template: `
    <div class="review-page">
      <header class="page-head">
        <h1>内容审核工作台</h1>
        <p>状态机：draft →（提交）advisor-review →（通过）asset-ready →（发布）published；每步写入 content_reviews 留痕，发布前校验确定性标签（QA-1）。</p>
        <div class="toolbar">
          <input type="text" [(ngModel)]="filter" placeholder="筛选标题…" class="search" />
          <span class="stat">共 {{ filtered().length }} 项</span>
        </div>
      </header>

      <table class="tbl">
        <thead>
          <tr>
            <th>编号</th><th>标题</th><th>确定性标签</th><th>审核状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let e of filtered()">
            <td class="num">{{ e.number }}</td>
            <td class="title">
              <a [routerLink]="['/experiment', e.slug]">{{ e.title }}</a>
            </td>
            <td><span class="certainty c-{{ e.certainty }}">{{ certaintyLabel(e.certainty) }}</span></td>
            <td><span class="status s-{{ e.review_status }}">{{ statusLabel(e.review_status) }}</span></td>
            <td class="actions">
              <button *ngIf="e.review_status === 'draft'" (click)="act(e, 'submit')">提交审核</button>
              <button *ngIf="e.review_status === 'advisor-review'" (click)="act(e, 'approve')">顾问通过</button>
              <button *ngIf="e.review_status === 'advisor-review'" class="danger" (click)="act(e, 'reject')">退回</button>
              <button *ngIf="e.review_status === 'asset-ready' || e.review_status === 'render-ready'" (click)="act(e, 'publish')">发布</button>
              <span *ngIf="e.review_status === 'published'" class="done">✓ 已发布</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="log" *ngIf="lastLog()">
        <h3>最近操作</h3>
        <p>{{ lastLog() }}</p>
      </div>
    </div>
  `,
  styles: [`
    .review-page { max-width: 1000px; margin: 0 auto; padding-bottom: 3rem; }
    .page-head h1 { color: #1a202c; margin-bottom: 0.4rem; }
    .page-head p { color: #718096; font-size: 0.88rem; margin-bottom: 1rem; line-height: 1.7; }
    .toolbar { display: flex; gap: 0.8rem; align-items: center; margin-bottom: 1rem; }
    .search { padding: 0.5rem 0.9rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; width: 260px; }
    .stat { font-size: 0.85rem; color: #718096; }
    .tbl { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .tbl th { text-align: left; background: #f7fafc; color: #4a5568; font-size: 0.8rem; padding: 0.7rem 0.9rem; border-bottom: 1px solid #e2e8f0; }
    .tbl td { padding: 0.65rem 0.9rem; border-bottom: 1px solid #edf2f7; font-size: 0.88rem; color: #2d3748; }
    .num { color: #a0aec0; font-family: Consolas, monospace; }
    .title a { color: #667eea; text-decoration: none; }
    .title a:hover { text-decoration: underline; }
    .certainty { font-size: 0.72rem; padding: 0.12rem 0.5rem; border-radius: 4px; border: 1px solid; }
    .c-observed { color: #276749; border-color: #9ae6b4; background: #f0fff4; }
    .c-theory-supported { color: #2b6cb0; border-color: #90cdf4; background: #ebf8ff; }
    .c-math-predicted { color: #744210; border-color: #f6e05e; background: #fffff0; }
    .c-philosophical { color: #553c9a; border-color: #d6bcfa; background: #faf5ff; }
    .c-sci-fi { color: #718096; border-color: #cbd5e0; background: #f7fafc; }
    .status { font-size: 0.75rem; padding: 0.15rem 0.55rem; border-radius: 10px; font-weight: 600; }
    .s-draft { background: #edf2f7; color: #4a5568; }
    .s-advisor-review { background: #fefcbf; color: #744210; }
    .s-asset-ready { background: #bee3f8; color: #2a4365; }
    .s-render-ready { background: #c6f6d5; color: #22543d; }
    .s-published { background: #c6f6d5; color: #276749; }
    .actions button { padding: 0.3rem 0.75rem; margin-right: 0.4rem; border: 1px solid #667eea; background: #667eea; color: #fff; border-radius: 6px; cursor: pointer; font-size: 0.78rem; }
    .actions button:hover { background: #5a67d8; }
    .actions button.danger { border-color: #e53e3e; background: #fff5f5; color: #c53030; }
    .done { color: #276749; font-size: 0.8rem; }
    .log { margin-top: 1.2rem; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.9rem 1.1rem; }
    .log h3 { font-size: 0.85rem; color: #667eea; margin-bottom: 0.4rem; }
    .log p { font-size: 0.85rem; color: #4a5568; margin: 0; }
  `],
})
export class ReviewWorkbenchComponent implements OnInit {
  experiments = signal<Experiment[]>([]);
  filter = '';
  private log = signal('');

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getAdminExperiments({ page: 1, pageSize: 100 }).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.experiments.set(resp.data.experiments ?? []);
        }
      },
      error: () => {},
    });
  }

  filtered(): Experiment[] {
    const q = this.filter.trim();
    const list = this.experiments();
    return q ? list.filter((e) => e.title.includes(q) || (e.number ?? '').includes(q)) : list;
  }

  act(exp: Experiment, action: 'submit' | 'approve' | 'reject' | 'publish'): void {
    this.api.reviewExperiment(exp.id, action).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.log.set(
            `#${exp.number}《${exp.title}》${this.actionLabel(action)} → ${this.statusLabel(resp.data.review_status)}`,
          );
          this.load();
        } else {
          this.log.set(`操作失败：${resp.message ?? '未知错误'}`);
        }
      },
      error: (err) => this.log.set(`操作失败：${err?.error?.message ?? '网络错误'}`),
    });
  }

  lastLog(): string {
    return this.log();
  }

  statusLabel(s?: string): string {
    const map: Record<string, string> = {
      draft: '草稿', 'advisor-review': '待顾问审核', 'asset-ready': '素材就绪',
      'render-ready': '渲染就绪', published: '已发布',
    };
    return map[s ?? ''] ?? s ?? '';
  }

  actionLabel(a: string): string {
    const map: Record<string, string> = { submit: '提交审核', approve: '顾问通过', reject: '退回', publish: '发布' };
    return map[a] ?? a;
  }

  certaintyLabel(c?: string): string {
    const map: Record<string, string> = {
      observed: '已观测', 'theory-supported': '理论支持', 'math-predicted': '数学预言',
      philosophical: '哲学猜想', 'sci-fi': '科幻想象',
    };
    return map[c ?? ''] ?? c ?? '';
  }
}
