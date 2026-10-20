import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';

export interface ParamConfig {
  type: 'range' | 'select' | 'number';
  min?: number;
  max?: number;
  step?: number;
  default?: number | string;
  options?: string[];
  label?: string;
}

@Component({
  selector: 'param-panel',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <div class="param-panel" *ngIf="schema && paramKeys.length > 0">
      <h3>参数调节</h3>
      <div *ngFor="let key of paramKeys" class="param-row"
           [class.highlighted]="isHighlighted(key)"
           [class.pulsed]="pulsed[key]">
        <label class="param-label">{{ getLabel(key) }}</label>
        <!-- 高亮时显示参数名小标签：让人对得上 graph 里引用的 $参数名 -->
        <span class="param-badge" *ngIf="isHighlighted(key)">{{ '$' + key }}</span>

        <!-- Range input -->
        <ng-container *ngIf="schema[key]?.type === 'range'">
          <input type="range"
                 [min]="getParamMin(key)"
                 [max]="getParamMax(key)"
                 [step]="getParamStep(key)"
                 [ngModel]="params[key]"
                 (ngModelChange)="onParamChange(key, $event)"
                 class="param-slider" />
          <span class="param-value">{{ params[key] }}</span>
        </ng-container>

        <!-- Select input -->
        <ng-container *ngIf="schema[key]?.type === 'select'">
          <select [ngModel]="params[key]" (ngModelChange)="onParamChange(key, $event)" class="param-select">
            <option *ngFor="let opt of getParamOptions(key)" [value]="opt">{{ opt }}</option>
          </select>
        </ng-container>

        <!-- Number input -->
        <ng-container *ngIf="schema[key]?.type === 'number'">
          <input type="number"
                 [min]="getParamMin(key)"
                 [max]="getParamMax(key)"
                 [ngModel]="params[key]"
                 (ngModelChange)="onParamChange(key, $event)"
                 class="param-number" />
        </ng-container>
      </div>

      <button (click)="resetParams()" class="btn-reset">重置参数</button>
    </div>
  `,
  styles: [`
    .param-panel { background: white; padding: 1.25rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .param-panel h3 { margin-bottom: 1rem; font-size: 1rem; color: #2d3748; }
    .param-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    /* 讲解播放时，被当前台词通过动画设置过的参数：高亮提示"这一句正在演示它" */
    .param-row.highlighted { background: #fffaf0; outline: 2px solid #f6ad55; outline-offset: 2px; border-radius: 8px; padding: 0.25rem 0.5rem; margin-left: -0.5rem; margin-right: -0.5rem; transition: background 0.2s ease; }
    .param-row.highlighted .param-label { color: #c05621; font-weight: 600; }
    .param-badge { background: #f6ad55; color: #fff; border-radius: 999px; padding: 0.05rem 0.4rem; font-size: 0.68rem; font-family: Consolas, monospace; }
    /* 台词刚改动过这个参数：数值从下方滑入 + 滑块发光，给一个"它动了"的视觉信号 */
    @keyframes param-pop { from { transform: translateY(6px) scale(0.85); opacity: 0.3; } to { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes slider-glow { from { filter: drop-shadow(0 0 7px #f6ad55); } to { filter: none; } }
    .param-row.pulsed .param-value { animation: param-pop 0.45s ease-out; }
    .param-row.pulsed .param-slider { animation: slider-glow 0.6s ease-out; }
    .param-label { min-width: 80px; font-size: 0.875rem; color: #4a5568; }
    .param-slider { flex: 1; accent-color: #667eea; }
    .param-value { min-width: 40px; font-size: 0.875rem; text-align: right; color: #667eea; font-weight: bold; }
    .param-select { flex: 1; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.875rem; }
    .param-number { width: 80px; padding: 0.4rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.875rem; }
    .btn-reset { width: 100%; padding: 0.5rem; background: #f7fafc; color: #4a5568; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 0.875rem; margin-top: 0.5rem; }
    .btn-reset:hover { background: #edf2f7; }
  `]
})
export class ParamPanelComponent implements OnChanges, OnDestroy {
  @Input() schema: Record<string, ParamConfig> = {};
  /** 需要高亮的参数名（例如讲解播放时，当前台词正在通过动画设置的那几个） */
  @Input() highlightKeys: string[] = [];

  /** 刚刚被台词改动过的参数 → 播放一次位移动画，播完自动清除 */
  pulsed: Record<string, boolean> = {};
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const c = changes['highlightKeys'];
    if (!c) return;
    const keys: string[] = Array.isArray(this.highlightKeys) ? this.highlightKeys : [];
    if (keys.length === 0) {
      this.pulsed = {};
      return;
    }
    const next: Record<string, boolean> = {};
    for (const k of keys) next[k] = true;
    this.pulsed = next;
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => {
      this.pulsed = {};
      this.pulseTimer = null;
    }, 800);
  }

  ngOnDestroy(): void {
    if (this.pulseTimer) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
  }
  /** 参数变化事件。刻意不用 "change"：它与原生 DOM change 事件同名，会被从内部 input 冒泡上来的原生事件干扰。 */
  @Output() paramsChange = new EventEmitter<Record<string, any>>();

  /** 该参数是否正在被当前台词演示（讲解播放时由 overlay 传入）。 */
  isHighlighted(key: string): boolean {
    return this.highlightKeys.includes(key);
  }

  params: Record<string, any> = {};
  Object = Object;

  get paramKeys(): string[] {
    return Object.keys(this.schema);
  }

  ngOnInit(): void {
    this.resetParams();
  }

  getLabel(key: string): string {
    // 渲染器声明的 label 优先，其次查内置中文对照表
    const declared = this.schema[key]?.label;
    if (declared) return declared;
    const labels: Record<string, string> = {
      frequency: '频率', amplitude: '振幅', terms: '项数', speed: '速度',
      angle: '角度', scale: '缩放', complexity: '复杂度', n: '项数',
      a: 'a', b: 'b', c: 'c', numerator: '分子', denominator: '分母',
      sides: '边数', max_iter: '迭代次数', zoom: '缩放',
      wave_type: '波形', algorithm: '算法', size: '大小',
      transform: '变换类型', operation: '运算', t: '角度',
    };
    return labels[key] || key;
  }

  getParamMin(key: string): number {
    return (this.schema[key]?.min as number) ?? 0;
  }

  getParamMax(key: string): number {
    return (this.schema[key]?.max as number) ?? 100;
  }

  getParamStep(key: string): number {
    return (this.schema[key]?.step as number) ?? 1;
  }

  getParamOptions(key: string): string[] {
    return this.schema[key]?.options ?? [];
  }

  resetParams(): void {
    this.params = {};
    for (const key of this.paramKeys) {
      this.params[key] = this.schema[key]?.default ?? 1;
    }
    this.paramsChange.emit({ ...this.params });
  }

  onParamChange(key: string, value: any): void {
    if (value instanceof Event) return; // 防御：原生事件不应作为参数值
    this.params[key] = value;
    this.paramsChange.emit({ ...this.params });
  }
}
