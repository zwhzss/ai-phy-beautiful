import { Component, OnInit, signal, computed } from '@angular/core';
import { NgIf, NgFor, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, ScaleNode } from '../../core/services/api.service';

type AxisKey = 'length' | 'time' | 'speed';

interface AxisMeta {
  label: string;
  unit: string;
  min: number; // log10 下界
  max: number; // log10 上界
  hint: string;
}

/**
 * 尺度穿越页（需求 FR-2）：
 * 对数刻度尺 + 锚点节点 + 当前读数。拖动滑块沿轴穿越，最近节点高亮。
 */
@Component({
  selector: 'app-scale',
  standalone: true,
  imports: [NgIf, NgFor, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="scale-page">
      <header class="page-head">
        <h1>尺度穿越</h1>
        <p>从普朗克长度到可观测宇宙，沿对数尺度轴拖动穿越 —— 每一次穿越都标注当前尺度与最近的锚点。</p>
      </header>

      <div class="axis-tabs">
        <button *ngFor="let a of axisKeys" class="tab" [class.active]="axis() === a" (click)="switchAxis(a)">
          {{ axisMeta[a].label }}
        </button>
      </div>

      <!-- 当前读数 -->
      <section class="readout">
        <div class="readout-value">
          <div class="value-label">当前尺度</div>
          <div class="value-num">10<sup>{{ cursor() | number:'1.1-1' }}</sup> <span class="unit">{{ axisMeta[axis()].unit }}</span></div>
          <div class="value-approx">≈ {{ formatValue() }}</div>
        </div>
        <div class="readout-node" *ngIf="nearestNode() as node">
          <div class="value-label">最近锚点</div>
          <div class="node-name">{{ node.name }}</div>
          <div class="node-desc">{{ node.description }}</div>
        </div>
      </section>

      <!-- 对数刻度尺 -->
      <section class="ruler">
        <input type="range" class="slider" [min]="axisMeta[axis()].min" [max]="axisMeta[axis()].max" step="0.1"
               [ngModel]="cursor()" (ngModelChange)="cursor.set(+$event)" />
        <div class="ticks">
          <div class="tick" *ngFor="let t of ticks()" [style.left.%]="tickPercent(t)">
            <span class="tick-label">10<sup>{{ t }}</sup></span>
          </div>
        </div>
      </section>

      <!-- 锚点节点 -->
      <section class="nodes">
        <h2>锚点节点（{{ nodes().length }}）</h2>
        <div class="node-list">
          <button *ngFor="let n of nodes()" class="node-card" [class.active]="nearestNode()?.slug === n.slug" (click)="focusNode(n)">
            <span class="node-value">10<sup>{{ log10(n.scale_value) | number:'1.1-1' }}</sup> {{ axisMeta[axis()].unit }}</span>
            <span class="node-title">{{ n.name }}</span>
            <span class="node-text">{{ n.description }}</span>
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .scale-page { max-width: 1100px; margin: 0 auto; }
    .page-head h1 { color: #1a202c; margin-bottom: 0.4rem; }
    .page-head p { color: #718096; font-size: 0.95rem; margin-bottom: 1.4rem; }
    .axis-tabs { display: flex; gap: 0.6rem; margin-bottom: 1.2rem; }
    .tab { padding: 0.5rem 1.2rem; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; cursor: pointer; font-size: 0.9rem; color: #4a5568; }
    .tab.active { background: #667eea; border-color: #667eea; color: #fff; font-weight: 600; }

    .readout { display: grid; grid-template-columns: 1fr 1.6fr; gap: 1rem; margin-bottom: 1.4rem; }
    .readout-value, .readout-node { background: linear-gradient(160deg, #0f172a, #1e293b); border: 1px solid #334155; border-radius: 12px; padding: 1.1rem 1.3rem; color: #e2e8f0; }
    .value-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
    .value-num { font-size: 2rem; font-weight: 700; color: #f1f5f9; }
    .value-num sup { font-size: 1.1rem; color: #818cf8; }
    .value-num .unit { font-size: 1rem; color: #94a3b8; font-weight: 400; }
    .value-approx { font-size: 0.9rem; color: #94a3b8; margin-top: 0.3rem; }
    .node-name { font-size: 1.3rem; font-weight: 700; color: #a5b4fc; }
    .node-desc { font-size: 0.85rem; color: #94a3b8; margin-top: 0.4rem; line-height: 1.6; }

    .ruler { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.6rem 1.6rem 2.2rem; margin-bottom: 1.8rem; position: relative; }
    .slider { width: 100%; accent-color: #667eea; height: 6px; }
    .ticks { position: relative; height: 34px; margin-top: 0.8rem; }
    .tick { position: absolute; transform: translateX(-50%); font-size: 0.72rem; color: #718096; text-align: center; }
    .tick::before { content: ''; display: block; width: 1px; height: 8px; background: #cbd5e0; margin: 0 auto 2px; }
    .tick-label sup { font-size: 0.62rem; }

    .nodes h2 { font-size: 1.05rem; color: #2d3748; margin-bottom: 0.8rem; }
    .node-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.7rem; }
    .node-card { text-align: left; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.8rem 0.9rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.25rem; transition: all 0.15s; }
    .node-card:hover { border-color: #a3bffa; }
    .node-card.active { border-color: #667eea; background: #ebf4ff; box-shadow: 0 4px 12px rgba(102,126,234,0.18); }
    .node-card .node-value { font-size: 0.75rem; color: #667eea; font-weight: 600; }
    .node-card .node-value sup { font-size: 0.62rem; }
    .node-card .node-title { font-weight: 600; color: #2d3748; font-size: 0.92rem; }
    .node-card .node-text { font-size: 0.75rem; color: #a0aec0; line-height: 1.5; }
  `],
})
export class ScaleComponent implements OnInit {
  axis = signal<AxisKey>('length');
  nodes = signal<ScaleNode[]>([]);
  cursor = signal(-10);

  readonly axisKeys: AxisKey[] = ['length', 'time', 'speed'];
  readonly axisMeta: Record<AxisKey, AxisMeta> = {
    length: { label: '长度轴', unit: 'm', min: -35, max: 27, hint: '普朗克长度 → 可观测宇宙' },
    time: { label: '时间轴', unit: 's', min: -43, max: 18, hint: '普朗克时间 → 宇宙年龄' },
    speed: { label: '速度轴', unit: 'm/s', min: -5, max: 9, hint: '分子热运动 → 真空光速' },
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadNodes();
  }

  switchAxis(axis: AxisKey): void {
    this.axis.set(axis);
    this.cursor.set(Math.round((this.axisMeta[axis].min + this.axisMeta[axis].max) / 2));
    this.loadNodes();
  }

  loadNodes(): void {
    this.api.getScaleNodes(this.axis()).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.nodes.set(resp.data);
        }
      },
      error: () => {},
    });
  }

  /** 当前刻度位置对应的锚点节点（log 距离最近）。 */
  nearestNode = computed<ScaleNode | null>(() => {
    const list = this.nodes();
    if (!list.length) return null;
    const cur = this.cursor();
    let best = list[0];
    let bestDist = Math.abs(this.log10(best.scale_value) - cur);
    for (const n of list) {
      const d = Math.abs(this.log10(n.scale_value) - cur);
      if (d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    return best;
  });

  focusNode(n: ScaleNode): void {
    this.cursor.set(Math.round(this.log10(n.scale_value) * 10) / 10);
  }

  /** 每 5 个数量级一个刻度。 */
  ticks = computed<number[]>(() => {
    const { min, max } = this.axisMeta[this.axis()];
    const out: number[] = [];
    const start = Math.ceil(min / 5) * 5;
    for (let e = start; e <= max; e += 5) out.push(e);
    return out;
  });

  tickPercent(t: number): number {
    const { min, max } = this.axisMeta[this.axis()];
    return ((t - min) / (max - min)) * 100;
  }

  log10(v: number): number {
    if (v <= 0) return 0;
    return Math.log10(v);
  }

  /** 当前值的直观表示（如 1.7 m、3×10⁸ m）。 */
  formatValue(): string {
    const exp = Math.round(this.cursor() * 10) / 10;
    const mant = Math.pow(10, this.cursor() - Math.floor(this.cursor()));
    const m = Math.round(mant * 100) / 100;
    const frac = this.cursor() - Math.floor(this.cursor());
    if (Math.abs(frac) < 0.05) {
      return `10^${Math.round(this.cursor())} ${this.axisMeta[this.axis()].unit}`;
    }
    return `${m} × 10^${Math.floor(this.cursor())} ${this.axisMeta[this.axis()].unit}`;
  }
}
