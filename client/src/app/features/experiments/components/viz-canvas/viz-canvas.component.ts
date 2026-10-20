import { Component, AfterViewInit, OnChanges, OnDestroy, Input, ElementRef, ViewChild, SimpleChanges } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  VizDefinition,
  VizFrame,
  VizInstance,
  VizParams,
  getViz,
  vizInstance,
} from '../../viz';

/**
 * 可视化画布容器。
 *
 * 按 experimentSlug 从注册表取渲染器：
 * - 已注册：按定义渲染（animated 定义逐帧重绘，静态定义只在参数/尺寸变化时重绘）。
 * - 未注册：绘制统一的占位提示（后续分批补齐）。
 */
@Component({
  selector: 'viz-canvas',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="viz-container" #container>
      <canvas #canvas></canvas>
      <div class="viz-empty" *ngIf="!hasRenderer">
        <span class="viz-empty-icon">∑</span>
        <p>{{ placeholderText }}</p>
        <small>{{ experimentSlug }}</small>
      </div>
    </div>
  `,
  styles: [`
    .viz-container { position: relative; width: 100%; height: 400px; background: #1a202c; border-radius: 12px; overflow: hidden; }
    canvas { width: 100%; height: 100%; display: block; }
    .viz-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem; color: #718096; pointer-events: none; }
    .viz-empty-icon { font-size: 2.5rem; color: #4a5568; }
    .viz-empty p { margin: 0; font-size: 0.95rem; }
    .viz-empty small { color: #4a5568; font-size: 0.75rem; }
  `]
})
export class VizCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() experimentSlug = '';
  @Input() params: VizParams = {};
  @Input() width = 800;
  @Input() height = 400;
  @Input() placeholderText = '可视化开发中';

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  hasRenderer = false;

  private ctx: CanvasRenderingContext2D | null = null;
  private def: VizDefinition | undefined;
  private instance: VizInstance | null = null;
  private frameId = 0;
  private startTime = 0;
  private logicalW = 800;
  private logicalH = 400;
  private observer?: ResizeObserver;

  ngAfterViewInit(): void {
    // @ViewChild 在 ngOnInit 阶段尚未解析，画布初始化必须放到视图就绪之后
    this.mount();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // 视图就绪前的变更由 mount() 统一处理
    if (!this.ctx) return;
    if (changes['experimentSlug']) {
      this.mount();
      return;
    }
    if (changes['params']) {
      this.createInstance();
      this.restart();
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.observer?.disconnect();
  }

  /** 解析渲染器、准备画布尺寸、启动渲染。 */
  private mount(): void {
    this.def = getViz(this.experimentSlug);
    this.hasRenderer = !!this.def;
    this.prepareCanvas();
    this.createInstance();
    this.watchResize();
    this.restart();
  }

  /** 依据容器尺寸与设备像素比配置画布。 */
  private prepareCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    const container = this.containerRef?.nativeElement;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.logicalW = Math.max(240, Math.round(rect.width || this.width));
    this.logicalH = Math.max(200, Math.round(rect.height || this.height));

    canvas.width = Math.round(this.logicalW * dpr);
    canvas.height = Math.round(this.logicalH * dpr);
    this.ctx = canvas.getContext('2d');
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 容器尺寸变化时重建画布并重绘。 */
  private watchResize(): void {
    if (this.observer || typeof ResizeObserver === 'undefined') return;
    const container = this.containerRef?.nativeElement;
    if (!container) return;
    this.observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(240, Math.round(rect.width || this.width));
      if (Math.abs(w - this.logicalW) < 5) return;
      this.prepareCanvas();
      this.render(this.elapsed());
    });
    this.observer.observe(container);
  }

  /** 创建渲染实例（参数变化时重建，动画状态随之重置）。 */
  private createInstance(): void {
    this.instance = this.def ? vizInstance(this.experimentSlug, this.params ?? {}) ?? null : null;
  }

  /** 重新开始渲染：动画定义进入逐帧循环，静态定义渲染一帧。 */
  private restart(): void {
    this.stop();
    this.startTime = performance.now();
    if (this.def?.animated) {
      this.loop();
    } else {
      this.render(0);
    }
  }

  private loop = (): void => {
    this.render(this.elapsed());
    this.frameId = requestAnimationFrame(this.loop);
  };

  private stop(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private elapsed(): number {
    return (performance.now() - this.startTime) / 1000;
  }

  private render(t: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const dpr = canvas.width / Math.max(1, this.logicalW);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const frame: VizFrame = {
      ctx,
      w: this.logicalW,
      h: this.logicalH,
      params: this.params ?? {},
      t,
    };

    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, frame.w, frame.h);

    if (this.instance) {
      ctx.save();
      try {
        this.instance.draw(frame);
      } catch {
        // 单个渲染器异常不应中断整个页面
        ctx.restore();
        this.drawFallback(frame, '渲染异常');
        return;
      }
      ctx.restore();
    } else {
      this.drawFallback(frame);
    }
  }

  /** 未注册渲染器时的占位图形（柔和的网格 + 正弦波）。 */
  private drawFallback(frame: VizFrame, note = ''): void {
    const { ctx, w, h } = frame;
    ctx.save();
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + 60 * Math.sin((x / w) * Math.PI * 4);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (note) {
      ctx.fillStyle = '#f56565';
      ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(note, w / 2, h - 16);
    }
    ctx.restore();
  }
}
