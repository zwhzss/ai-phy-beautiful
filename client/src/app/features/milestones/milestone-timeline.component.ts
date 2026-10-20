import { Component, OnInit, signal, computed } from '@angular/core';
import { NgIf, NgFor, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Milestone } from '../../core/services/api.service';

type KindFilter = '' | 'law' | 'formula' | 'invention' | 'experiment';

/**
 * 时间线页（需求 FR-14）：
 * 按年代升序呈现全部里程碑，支持按类型筛选；卡片展示"公式–含义–年份–影响–人物"。
 */
@Component({
  selector: 'app-milestone-timeline',
  standalone: true,
  imports: [NgIf, NgFor, SlicePipe, RouterLink],
  template: `
    <div class="timeline-page">
      <header class="page-head">
        <h1>改变历史的物理 · 时间线</h1>
        <p>定律、公式、重大发明与关键实验 —— {{ milestones().length }} 个改变人类历史进程的物理里程碑，按年代排列。</p>
      </header>

      <!-- 类型筛选 -->
      <div class="kind-filter">
        <button class="chip" [class.active]="!kind()" (click)="setKind('')">全部（{{ milestones().length }}）</button>
        <button *ngFor="let k of kinds" class="chip kind-{{ k.value }}" [class.active]="kind() === k.value" (click)="setKind(k.value)">
          {{ k.label }}
        </button>
        <a class="figures-link" routerLink="/figures">⚛ 物理学家名录 →</a>
      </div>

      <!-- 年代轴概览 -->
      <div class="era-bar" *ngIf="filtered().length">
        <span class="era" *ngFor="let g of groups()">
          <span class="era-label">{{ g.label }}</span>
          <span class="era-count">{{ g.items.length }}</span>
        </span>
      </div>

      <!-- 里程碑列表 -->
      <div class="ms-list">
        <a *ngFor="let m of filtered()" class="ms-row" [routerLink]="['/milestones', m.slug]">
          <div class="ms-year-col">
            <span class="year">{{ formatYear(m.year) }}</span>
            <span class="kind-tag kind-{{ m.kind }}">{{ kindLabel(m.kind) }}</span>
          </div>
          <div class="ms-body">
            <h3>{{ m.title }}</h3>
            <p class="statement">{{ m.statement }}</p>
            <p class="impact"><b>历史影响：</b>{{ m.impact | slice:0:90 }}{{ m.impact.length > 90 ? '…' : '' }}</p>
            <div class="ms-foot">
              <span class="figure-chip" *ngFor="let f of m.figures">{{ f.name }}</span>
              <span class="certainty c-{{ m.certainty }}">{{ certaintyLabel(m.certainty) }}</span>
            </div>
          </div>
          <span class="arrow">›</span>
        </a>
        <div class="empty" *ngIf="!filtered().length">该类型暂无里程碑</div>
      </div>
    </div>
  `,
  styles: [`
    .timeline-page { max-width: 980px; margin: 0 auto; }
    .page-head h1 { color: #1a202c; margin-bottom: 0.4rem; }
    .page-head p { color: #718096; font-size: 0.95rem; margin-bottom: 1.3rem; }

    .kind-filter { display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center; margin-bottom: 1.2rem; }
    .chip { padding: 0.42rem 0.95rem; border: 1px solid #e2e8f0; background: #fff; color: #4a5568; border-radius: 18px; cursor: pointer; font-size: 0.84rem; }
    .chip.active { background: #667eea; border-color: #667eea; color: #fff; font-weight: 600; }
    .figures-link { margin-left: auto; font-size: 0.85rem; color: #667eea; text-decoration: none; }

    .era-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.4rem; }
    .era { display: inline-flex; align-items: center; gap: 0.35rem; background: #edf2f7; border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.78rem; color: #4a5568; }
    .era-count { background: #667eea; color: #fff; border-radius: 10px; padding: 0 0.45rem; font-size: 0.72rem; }

    .ms-list { display: flex; flex-direction: column; gap: 0.8rem; padding-bottom: 3rem; }
    .ms-row { display: flex; gap: 1.1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.2rem; text-decoration: none; transition: all 0.15s; align-items: flex-start; }
    .ms-row:hover { border-color: #a3bffa; box-shadow: 0 6px 16px rgba(102,126,234,0.14); transform: translateX(3px); }
    .ms-year-col { flex: 0 0 92px; display: flex; flex-direction: column; gap: 0.4rem; }
    .ms-year-col .year { font-weight: 700; color: #2d3748; font-size: 0.92rem; }
    .kind-tag { font-size: 0.7rem; padding: 0.12rem 0.5rem; border-radius: 4px; color: #fff; text-align: center; width: fit-content; }
    .kind-law { background: #667eea; } .kind-formula { background: #38b2ac; }
    .kind-invention { background: #ed8936; } .kind-experiment { background: #48bb78; }
    .ms-body { flex: 1; min-width: 0; }
    .ms-body h3 { color: #1a202c; font-size: 1.05rem; margin-bottom: 0.35rem; }
    .ms-body .statement { color: #4a5568; font-size: 0.87rem; line-height: 1.6; margin-bottom: 0.35rem; }
    .ms-body .impact { color: #718096; font-size: 0.8rem; line-height: 1.6; margin-bottom: 0.5rem; }
    .ms-body .impact b { color: #667eea; font-weight: 600; }
    .ms-foot { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; }
    .figure-chip { background: #edf2f7; color: #4a5568; font-size: 0.72rem; padding: 0.12rem 0.55rem; border-radius: 10px; }
    .certainty { font-size: 0.7rem; padding: 0.12rem 0.5rem; border-radius: 4px; border: 1px solid; }
    .c-observed { color: #276749; border-color: #9ae6b4; background: #f0fff4; }
    .c-theory-supported { color: #2b6cb0; border-color: #90cdf4; background: #ebf8ff; }
    .c-math-predicted { color: #744210; border-color: #f6e05e; background: #fffff0; }
    .c-philosophical { color: #553c9a; border-color: #d6bcfa; background: #faf5ff; }
    .c-sci-fi { color: #718096; border-color: #cbd5e0; background: #f7fafc; }
    .arrow { color: #a0aec0; font-size: 1.5rem; align-self: center; }
    .empty { text-align: center; color: #a0aec0; padding: 3rem; }
  `],
})
export class MilestoneTimelineComponent implements OnInit {
  milestones = signal<Milestone[]>([]);
  kind = signal<KindFilter>('');

  readonly kinds: { value: KindFilter; label: string }[] = [
    { value: 'law', label: '定律' },
    { value: 'formula', label: '公式' },
    { value: 'invention', label: '发明' },
    { value: 'experiment', label: '关键实验' },
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getMilestones({ pageSize: 200 }).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.milestones.set(resp.data.milestones ?? []);
        }
      },
      error: () => {},
    });
  }

  setKind(k: KindFilter): void {
    this.kind.set(k);
  }

  filtered = computed<Milestone[]>(() => {
    const k = this.kind();
    const list = this.milestones();
    return k ? list.filter((m) => m.kind === k) : list;
  });

  /** 按世纪分组（概览条）。 */
  groups = computed<{ label: string; items: Milestone[] }[]>(() => {
    const map = new Map<string, Milestone[]>();
    for (const m of this.filtered()) {
      const label = centuryLabel(m.year);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  });

  kindLabel(kind: string): string {
    const map: Record<string, string> = { law: '定律', formula: '公式', invention: '发明', experiment: '关键实验' };
    return map[kind] ?? kind;
  }

  certaintyLabel(c: string): string {
    const map: Record<string, string> = {
      observed: '已观测', 'theory-supported': '理论支持', 'math-predicted': '数学预言',
      philosophical: '哲学猜想', 'sci-fi': '科幻想象',
    };
    return map[c] ?? c;
  }

  formatYear(year: number): string {
    return year < 0 ? `前${-year}` : `${year}`;
  }
}

function centuryLabel(year: number): string {
  if (year <= 0) {
    const bc = Math.ceil((-year + 1) / 100);
    return `公元前 ${bc} 世纪`;
  }
  return `${Math.ceil(year / 100)} 世纪`;
}
