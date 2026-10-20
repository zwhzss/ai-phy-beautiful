import { Component, OnInit, signal, computed } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Figure } from '../../core/services/api.service';

/** 物理学家名录（需求 FR-14 人物主线）。 */
@Component({
  selector: 'app-figures',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink],
  template: `
    <div class="figures-page">
      <header class="page-head">
        <h1>物理学家</h1>
        <p>改变人类历史进程的头脑 —— {{ filtered().length }} 位，按生年排列；点按查看其贡献与关联里程碑。</p>
        <div class="search-row">
          <input type="text" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="搜索姓名 / 贡献 / 国籍..." class="search" />
          <a class="timeline-link" routerLink="/milestones">⏳ 时间线 →</a>
        </div>
      </header>

      <div class="fig-grid">
        <a *ngFor="let f of filtered()" class="fig-card" [routerLink]="['/figures', f.slug]">
          <div class="fig-avatar">{{ f.name.charAt(0) }}</div>
          <div class="fig-info">
            <h3>{{ f.name }}</h3>
            <div class="fig-meta">{{ f.name_en }} · {{ f.born }}–{{ f.died || '今' }}</div>
            <div class="fig-nationality" *ngIf="f.nationality">{{ f.nationality }}</div>
            <p>{{ f.contribution }}</p>
            <span class="nobel" *ngIf="f.nobel">🏆 {{ f.nobel }}</span>
          </div>
        </a>
      </div>
      <div class="empty" *ngIf="!filtered().length">未找到相关人物</div>
    </div>
  `,
  styles: [`
    .figures-page { max-width: 1100px; margin: 0 auto; }
    .page-head h1 { color: #1a202c; margin-bottom: 0.4rem; }
    .page-head p { color: #718096; font-size: 0.95rem; margin-bottom: 1rem; }
    .search-row { display: flex; gap: 0.8rem; align-items: center; margin-bottom: 1.4rem; }
    .search { flex: 1; max-width: 420px; padding: 0.6rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.92rem; }
    .search:focus { outline: none; border-color: #667eea; }
    .timeline-link { font-size: 0.85rem; color: #667eea; text-decoration: none; }

    .fig-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding-bottom: 3rem; }
    .fig-card { display: flex; gap: 0.9rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.1rem; text-decoration: none; transition: all 0.15s; }
    .fig-card:hover { border-color: #a3bffa; box-shadow: 0 6px 16px rgba(102,126,234,0.14); transform: translateY(-2px); }
    .fig-avatar { flex: 0 0 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; }
    .fig-info h3 { color: #1a202c; font-size: 1.02rem; margin-bottom: 0.15rem; }
    .fig-meta { color: #a0aec0; font-size: 0.75rem; margin-bottom: 0.15rem; }
    .fig-nationality { display: inline-block; background: #edf2f7; color: #4a5568; font-size: 0.7rem; padding: 0.08rem 0.45rem; border-radius: 8px; margin-bottom: 0.35rem; }
    .fig-info p { color: #718096; font-size: 0.83rem; line-height: 1.6; margin: 0 0 0.4rem; }
    .nobel { display: inline-block; font-size: 0.72rem; color: #975a16; background: #fefcbf; border-radius: 4px; padding: 0.1rem 0.45rem; }
    .empty { text-align: center; color: #a0aec0; padding: 3rem; }
  `],
})
export class FiguresComponent implements OnInit {
  query = signal('');
  private all = signal<Figure[]>([]);

  filtered = computed<Figure[]>(() => {
    const q = this.query().trim();
    const list = this.all();
    if (!q) return list;
    const lower = q.toLowerCase();
    return list.filter(
      (f) =>
        f.name.includes(q) ||
        (f.name_en ?? '').toLowerCase().includes(lower) ||
        (f.nationality ?? '').includes(q) ||
        f.contribution.includes(q),
    );
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getFigures().subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.all.set(resp.data);
        }
      },
      error: () => {},
    });
  }
}
