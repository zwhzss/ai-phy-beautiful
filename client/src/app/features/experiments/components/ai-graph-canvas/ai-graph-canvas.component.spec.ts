import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiGraphCanvasComponent } from './ai-graph-canvas.component';
import type { GraphSpec } from './ai-graph-canvas.component';

/** 测试宿主：像实验详情页那样用属性绑定喂 graph / params（复现"输入引用随变更检测变化"的场景）。 */
@Component({
  standalone: true,
  imports: [AiGraphCanvasComponent],
  template: `<app-ai-graph-canvas [graph]="graph" [params]="params" [width]="800" [height]="520"></app-ai-graph-canvas>`,
})
class HostComponent {
  @ViewChild(AiGraphCanvasComponent) child!: AiGraphCanvasComponent;
  graph: GraphSpec = { kind: '2d', elements: [] };
  params: Record<string, unknown> = {};
}

/**
 * 组件级验证：AI 演示图真的会逐帧重绘。
 *
 * 单测 time-animation.spec.ts 只覆盖纯函数；这里用真实 Canvas 检查
 * 「同一份 graph 在不同时刻画出不同画面」，这是"动起来"的最终判据。
 */
describe('AiGraphCanvasComponent · 动画渲染', () => {
  let fixture: ComponentFixture<AiGraphCanvasComponent>;
  let comp: AiGraphCanvasComponent;

  /** 单位圆上的动点（含坐标轴与拖尾），模拟"像内置单摆那样"的演示图。 */
  const animatedGraph: GraphSpec = {
    kind: '2d',
    axes: { x: [-1.3, 1.3], y: [-1.3, 1.3] },
    animate: { period: 8 },
    elements: [
      { type: 'motion', x: 'cos(6.283185307179586*s)', y: 'sin(6.283185307179586*s)', sFrom: 0, sTo: 1, trail: 0.12, color: '#f6ad55', size: 7 },
      { type: 'point', at: [0, 0], color: '#ed8936', size: 4, label: '圆心' },
    ],
  };

  /** 静态图：没有时间痕迹，不应播放。 */
  const staticGraph: GraphSpec = {
    kind: '2d',
    axes: { x: [-1.3, 1.3], y: [-1.3, 1.3] },
    elements: [{ type: 'curve', fn: 'sin(3*x)', fromX: -1.3, toX: 1.3, color: '#48bb78' }],
  };

  function frames(count: number, gapMs: number): Promise<number[][]> {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const snap = (): number[] => {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const out: number[] = [];
      for (let i = 0; i < d.length; i += 4) out.push(d[i] + d[i + 1] + d[i + 2]);
      return out;
    };
    return new Promise<number[][]>((resolve) => {
      const shots: number[][] = [];
      const tick = (): void => {
        shots.push(snap());
        if (shots.length >= count) {
          resolve(shots);
          return;
        }
        setTimeout(tick, gapMs);
      };
      tick();
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AiGraphCanvasComponent] }).compileComponents();
    fixture = TestBed.createComponent(AiGraphCanvasComponent);
    comp = fixture.componentInstance;
    comp.width = 320;
    comp.height = 240;
  });

  it('带 motion/时间变量的图会逐帧变化（画面真的在动）', async () => {
    comp.graph = animatedGraph;
    fixture.detectChanges();

    const shots = await frames(4, 260);
    const diffs = shots.slice(1).map((s, i) => s.reduce((acc, v, j) => acc + Math.abs(v - shots[i][j]), 0));

    expect(comp.animated()).toBeTrue(); // 播放条应该出现
    const bar = fixture.nativeElement.querySelector('.anim-bar') as HTMLElement;
    expect(bar.classList.contains('on')).toBeTrue();
    expect(bar.textContent).toContain('暂停');
    // 只在首帧之后比较：首帧由 startAnimation 的 paint(0) 画出，必然与后续帧不同
    expect(diffs[0]).toBeGreaterThan(0);
    // 至少有两帧明显不同（拖尾/动点位置变化）
    expect(diffs.filter((d) => d > 200).length).toBeGreaterThanOrEqual(2);
  });

  it('静态图不播放：画面保持稳定且不显示播放条', async () => {
    comp.graph = staticGraph;
    fixture.detectChanges();

    const shots = await frames(3, 160);
    const diffs = shots.slice(1).map((s, i) => s.reduce((acc, v, j) => acc + Math.abs(v - shots[i][j]), 0));

    expect(comp.animated()).toBeFalse();
    expect((fixture.nativeElement.querySelector('.anim-bar') as HTMLElement).classList.contains('on')).toBeFalse();
    expect(Math.max(...diffs)).toBe(0);
  });

  it('暂停后画面定格，重播回到起点相位', async () => {
    comp.graph = animatedGraph;
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 300));

    comp.togglePause();
    expect(comp.paused()).toBeTrue();
    const frozen = (fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement).toDataURL();
    await new Promise((r) => setTimeout(r, 300));
    const stillFrozen = (fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement).toDataURL();
    expect(stillFrozen).toEqual(frozen);

    comp.replay();
    expect(comp.paused()).toBeFalse();
    expect(comp.elapsedSeconds).toBeLessThan(0.05);
  });

  it('表达式非法时不抛异常，画面仍给出底图', async () => {
    comp.graph = { kind: '2d', elements: [{ type: 'motion', x: 'oops(', y: 'sin(s)' }] };
    expect(() => fixture.detectChanges()).not.toThrow();
    await new Promise((r) => setTimeout(r, 120));
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(320);
    expect(comp.animated()).toBeTrue(); // motion 图元存在 → 仍按动画播放（只是画不出动点）
  });

  /**
   * 用宿主组件绑定输入时，动画不能被"每帧重来的 render()"打断。
   *
   * 这条守的是一个真实踩过的坑：动画状态（信号）每帧更新会带来变更检测，
   * 若 render() 又被反复触发，动画时间轴会被反复归零，画面上表现为
   * 「播放条在、t 读数永远是 0.0、图形一动不动」。
   */
  it('宿主属性绑定下动画仍然推进（t 读数随时间增长）', async () => {
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.componentInstance.graph = animatedGraph;
    hostFixture.componentInstance.params = { theta0: 0.5 };
    hostFixture.detectChanges();

    const child = hostFixture.componentInstance.child;
    const canvas = hostFixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const sample = () => {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let acc = 0;
      for (let i = 0; i < d.length; i += 4) acc += d[i] + d[i + 1] + d[i + 2];
      return acc;
    };

    const first = sample();
    const t0 = child.elapsedSeconds;
    await new Promise((r) => setTimeout(r, 500));
    hostFixture.detectChanges();
    const later = sample();
    const t1 = child.elapsedSeconds;

    expect(t1 - t0).toBeGreaterThan(0.15); // 时间轴确实在走
    expect(later).not.toEqual(first); // 画面确实变了
  });

  /** 按自带容差统计画布上若干目标颜色的像素数。 */
  function pixelCounts(targets: string[]): Map<string, number> {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const out = new Map<string, number>();
    const rgb = targets.map(
      (hex) =>
        [
          hex,
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16),
        ] as const,
    );
    for (let i = 0; i < d.length; i += 4) {
      for (const [hex, r, g, b] of rgb) {
        if (Math.abs(d[i] - r) <= 12 && Math.abs(d[i + 1] - g) <= 12 && Math.abs(d[i + 2] - b) <= 12) {
          out.set(hex, (out.get(hex) ?? 0) + 1);
        }
      }
    }
    return out;
  }

  /**
   * 图元颜色必须真的画出来。
   *
   * 这条守的是一个被类型断言（`as never`）掩盖了很久的缺陷：viz/canvas.ts 的
   * `seg()` 是**位置参数** `(f, x1, y1, x2, y2, color, lw)`，而渲染器按选项对象调用，
   * 于是颜色掉成默认的深色 —— 在深色画布上，模型指定的线色（如摆杆的橙色）完全看不见。
   */
  it('图元颜色与线宽真的生效（seg 位置参数）', () => {
    comp.width = 200;
    comp.height = 200;
    comp.graph = {
      kind: '2d',
      axes: { x: [-1, 1], y: [-1, 1] },
      elements: [
        { type: 'line', from: [-1, 0], to: [1, 0], color: '#f6ad55', width: 3 },
        { type: 'circle', center: [0, 0], r: 0.4, color: '#38a169', fill: 'rgba(56,161,105,0.2)' },
        { type: 'point', at: [0, 0], color: '#e53e3e', size: 8 },
      ],
    };
    fixture.detectChanges();

    const counts = pixelCounts(['#f6ad55', '#e53e3e', '#38a169', '#667eea']);
    expect(counts.get('#f6ad55') ?? 0).toBeGreaterThan(50); // 橙线（旧代码这里会是 0）
    expect(counts.get('#e53e3e') ?? 0).toBeGreaterThan(50); // 红点
    expect(counts.get('#38a169') ?? 0).toBeGreaterThan(20); // 绿圆轮廓
    // 颜色不能掉成默认的深色（#667eea 在深色画布上几乎看不见，等于"模型指定的颜色没生效"）
    expect(counts.get('#667eea') ?? 0).toBe(0);
  });

  /**
   * 线宽 / 点径 / 采样数这类「标量样式字段」必须真的能接参数。
   *
   * 它们以前是 `el.width ?? 2` 直接用原始值，模型写 `"width": "$num_lw"` 会被 canvas
   * **静默忽略**（线宽掉回默认值，画面一模一样）—— 而后端把"非展示字段"一律算作图形联动，
   * 于是就成了"报了已联动、拖了却不变"。这条用像素数把"线真的变粗、点真的变大"钉住。
   *
   * 注意用宿主组件（真实属性绑定）驱动 params 变化：直接给组件实例赋值不会触发 ngOnChanges。
   */
  it('线宽 / 点径支持 $参数名，拖参数画面真的变', () => {
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.componentInstance.graph = {
      kind: '2d',
      axes: { x: [-1, 1], y: [-1, 1] },
      elements: [
        { type: 'line', from: [-1, 0], to: [1, 0], color: '#f6ad55', width: '$num_lw' },
        { type: 'point', at: [0, 0.6], color: '#e53e3e', size: '$num_size' },
      ],
    };
    hostFixture.componentInstance.params = { num_lw: 2, num_size: 3 };
    hostFixture.detectChanges();

    const canvas = hostFixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const count = (hex: string): number => {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - r) <= 12 && Math.abs(d[i + 1] - g) <= 12 && Math.abs(d[i + 2] - b) <= 12) n++;
      }
      return n;
    };

    // 起点用 2 px（1 px 的横线会被抗锯齿摊成半透明，像素计数不可靠）
    const thin = count('#f6ad55');
    const small = count('#e53e3e');
    expect(thin).toBeGreaterThan(0); // 线画出来了（不是"参数没解析，整条线消失"）
    expect(small).toBeGreaterThan(0);

    hostFixture.componentInstance.params = { num_lw: 14, num_size: 16 };
    hostFixture.detectChanges();

    expect(count('#f6ad55')).toBeGreaterThan(thin * 3);
    expect(count('#e53e3e')).toBeGreaterThan(small * 3);
  });

  /**
   * 提示词里教给模型的几种写法，逐一走真实渲染路径：
   * 只要有一种画不出来，学生看到的就是"AI 图是死的"甚至空白。
   */
  describe('提示词示例写法可用性', () => {
    /** 采样若干帧，返回逐帧两两之间的像素差总和。 */
    async function motionEnergy(): Promise<number> {
      const shots = await frames(3, 200);
      return shots
        .slice(1)
        .map((s, i) => s.reduce((acc, v, j) => acc + Math.abs(v - shots[i][j]), 0))
        .reduce((a, b) => a + b, 0);
    }

    it('行进波：curve 表达式里带 t', async () => {
      comp.graph = {
        kind: '2d',
        axes: { x: [-6, 6], y: [-2, 2] },
        elements: [{ type: 'curve', fn: 'sin(2*x - 3*t)', fromX: -6, toX: 6, color: '#48bb78', samples: 200 }],
      };
      fixture.detectChanges();
      expect(comp.animated()).toBeTrue();
      expect(await motionEnergy()).toBeGreaterThan(200);
    });

    it('沿轨道转动的点：point.at 写成 cos(t)/sin(t)', async () => {
      comp.graph = {
        kind: '2d',
        axes: { x: [-1.4, 1.4], y: [-1.4, 1.4] },
        elements: [
          { type: 'circle', center: [0, 0], r: 1, color: '#667eea' },
          { type: 'line', from: [0, 0], to: ['cos(t)', 'sin(t)'], color: '#667eea', width: 2 },
          { type: 'point', at: ['cos(t)', 'sin(t)'], color: '#e53e3e', size: 6 },
        ],
      };
      fixture.detectChanges();
      expect(comp.animated()).toBeTrue();
      expect(await motionEnergy()).toBeGreaterThan(200);
    });

    it('参数方程动图：motion 图元的 xs/ys 别名写法也有拖尾与动点', async () => {
      comp.graph = {
        kind: '2d',
        axes: { x: [-1.4, 1.4], y: [-1.4, 1.4] },
        elements: [{ type: 'motion', xs: 'cos(6.283185307179586*s)', ys: 'sin(6.283185307179586*s)', span: [0, 1], trail: 0.2, size: 8 }],
      };
      fixture.detectChanges();
      expect(comp.animated()).toBeTrue();
      expect(await motionEnergy()).toBeGreaterThan(200);
    });

    it('单摆式演示图（摆杆 + 摆球 + 角度参数）整幅在动', async () => {
      comp.graph = {
        kind: '2d',
        axes: { x: [-1.5, 1.5], y: [-1.5, 0.6] },
        animate: { period: 3, pingpong: true },
        elements: [
          { type: 'line', from: [0, 0], to: [0, -1], color: '#a0aec0', width: 1, dash: true },
          { type: 'line', from: [0, 0], to: ['sin(theta0*cos(t))', '-cos(theta0*cos(t))'], color: '#f6ad55', width: 3 },
          { type: 'point', at: ['sin(theta0*cos(t))', '-cos(theta0*cos(t))'], color: '#e53e3e', size: 9, label: 't = $t s' },
          { type: 'motion', x: 'sin(theta0*s)', y: '-cos(theta0*s)', sFrom: -1, sTo: 1, span: [0.3, 1], trail: 0.3, color: 'rgba(237,137,54,0.6)', size: 3 },
        ],
      };
      comp.params = { theta0: 0.5 };
      fixture.detectChanges();
      expect(comp.animated()).toBeTrue();
      expect(await motionEnergy()).toBeGreaterThan(200);
    });
  });
});
