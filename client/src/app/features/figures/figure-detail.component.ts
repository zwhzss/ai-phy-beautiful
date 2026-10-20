import { Component, OnInit, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Figure } from '../../core/services/api.service';

/** 物理学家详情（贡献、诺奖、生平与关联里程碑）。 */
@Component({
  selector: 'app-figure-detail',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink],
  template: `
    <div class="fig-page" *ngIf="figure() as f">
      <a class="back" routerLink="/figures">← 返回名录</a>

      <header class="fig-head">
        <div class="avatar">{{ f.name.charAt(0) }}</div>
        <div>
          <h1>{{ f.name }}</h1>
          <div class="meta">
            <span *ngIf="f.name_en">{{ f.name_en }}</span>
            <span>{{ f.born }} – {{ f.died || '今' }}</span>
            <span *ngIf="f.nationality" class="nation">{{ f.nationality }}</span>
          </div>
        </div>
      </header>

      <section class="card nobel-card" *ngIf="f.nobel">
        <h2>诺贝尔奖</h2>
        <p>🏆 {{ f.nobel }}</p>
      </section>

      <section class="card">
        <h2>贡献</h2>
        <p class="contribution">{{ f.contribution }}</p>
        <p class="bio" *ngIf="f.bio">{{ f.bio }}</p>
      </section>

      <section class="card" *ngIf="f.milestones?.length">
        <h2>关联里程碑</h2>
        <a *ngFor="let m of f.milestones" class="ms-chip" [routerLink]="['/milestones', m.slug]">
          <span class="kind kind-{{ m.kind }}">{{ kindLabel(m.kind) }}</span>
          <span class="ms-title">{{ m.title }}</span>
          <span class="ms-year">{{ m.year < 0 ? '前' + (-m.year) : m.year }}</span>
        </a>
      </section>
    </div>

    <div class="loading" *ngIf="!figure() && !error()">加载中…</div>
    <div class="loading" *ngIf="error()">{{ error() }}</div>
  `,
  styles: [`
    .fig-page { max-width: 820px; margin: 0 auto; padding-bottom: 3rem; }
    .back { display: inline-block; color: #667eea; text-decoration: none; font-size: 0.88rem; margin-bottom: 1rem; }
    .fig-head { display: flex; gap: 1.1rem; align-items: center; margin-bottom: 1.3rem; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 700; }
    .fig-head h1 { color: #1a202c; font-size: 1.7rem; margin-bottom: 0.25rem; }
    .meta { display: flex; gap: 0.7rem; color: #a0aec0; font-size: 0.88rem; flex-wrap: wrap; align-items: center; }
    .nation { background: #edf2f7; color: #4a5568; padding: 0.1rem 0.55rem; border-radius: 10px; font-size: 0.78rem; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.2rem 1.4rem; margin-bottom: 1rem; }
    .card h2 { font-size: 0.95rem; color: #667eea; margin-bottom: 0.7rem; }
    .card p { color: #4a5568; line-height: 1.8; font-size: 0.94rem; margin: 0 0 0.5rem; }
    .nobel-card { background: #fffbeb; border-color: #f6e05e; }
    .nobel-card h2 { color: #975a16; }
    .contribution { font-size: 1.02rem !important; color: #2d3748 !important; }
    .bio { color: #718096 !important; font-size: 0.9rem !important; }
    .ms-chip { display: flex; align-items: center; gap: 0.6rem; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.55rem 0.8rem; text-decoration: none; margin-bottom: 0.5rem; }
    .ms-chip:hover { border-color: #a3bffa; }
    .ms-chip .kind { font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 4px; color: #fff; }
    .kind-law { background: #667eea; } .kind-formula { background: #38b2ac; }
    .kind-invention { background: #ed8936; } .kind-experiment { background: #48bb78; }
    .ms-chip .ms-title { flex: 1; color: #2d3748; font-size: 0.9rem; }
    .ms-chip .ms-year { color: #a0aec0; font-size: 0.8rem; }
    .loading { text-align: center; color: #a0aec0; padding: 4rem; }
  `],
})
export class FigureDetailComponent implements OnInit {
  figure = signal<Figure | null>(null);
  error = signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) return;
      this.figure.set(null);
      this.error.set('');
      this.api.getFigure(slug).subscribe({
        next: (resp) => {
          if (resp.code === 0 && resp.data) {
            this.figure.set(resp.data);
          } else {
            this.error.set('未找到该人物');
          }
        },
        error: () => this.error.set('加载失败，请确认后端服务已启动'),
      });
    });
  }

  kindLabel(kind: string): string {
    const map: Record<string, string> = { law: '定律', formula: '公式', invention: '发明', experiment: '关键实验' };
    return map[kind] ?? kind;
  }
}
