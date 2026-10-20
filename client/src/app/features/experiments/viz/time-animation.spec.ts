import {
  aliasFreeVar,
  detectAnimate,
  fixUnaryPow,
  motionState,
  normalizeAnimatePlan,
  normalizeExpression,
  timeValue,
  usesTimeVar,
} from './time-animation';
import type { AnimatePlan, MotionElement } from './time-animation';

/** 构造一份最小可用的动画计划（默认 force=null：按内容自动判定）。 */
function plan(over: Partial<AnimatePlan> = {}): AnimatePlan {
  return { ...normalizeAnimatePlan(undefined), ...over };
}

describe('time-animation · usesTimeVar', () => {
  it('认出表达式里的时间变量 t（含 $t 与算式）', () => {
    expect(usesTimeVar('sin(2*x - 3*t)')).toBeTrue();
    expect(usesTimeVar('$t')).toBeTrue();
    expect(usesTimeVar('cos(t)')).toBeTrue();
    expect(usesTimeVar('$t / 2 - 0.5')).toBeTrue();
    expect(usesTimeVar('2*t')).toBeTrue();
  });

  it('不把函数名与普通标识符里的 t 当成时间变量', () => {
    expect(usesTimeVar('tan(x)')).toBeFalse();
    expect(usesTimeVar('atan2(y, x)')).toBeFalse();
    expect(usesTimeVar('tanh(x)')).toBeFalse();
    expect(usesTimeVar('num_total * x')).toBeFalse();
    expect(usesTimeVar('sqrt(t_0)')).toBeFalse();
    expect(usesTimeVar('sin(2*x)')).toBeFalse();
  });
});

describe('time-animation · detectAnimate', () => {
  it('默认静态：没有任何时间痕迹时不播放', () => {
    const graph = { kind: '2d', elements: [{ type: 'curve', fn: 'sin(x)' }] };
    expect(detectAnimate(graph, plan())).toBeFalse();
  });

  it('表达式里出现 t 就自动播放（行进波）', () => {
    const graph = { kind: '2d', elements: [{ type: 'curve', fn: 'sin(2*x - 3*t)' }] };
    expect(detectAnimate(graph, plan())).toBeTrue();
  });

  it('数值字段写成 $t 也算时间痕迹（随时间移动的图元）', () => {
    const graph = { kind: '2d', elements: [{ type: 'point', at: ['$t', 'sin($t)'] }] };
    expect(detectAnimate(graph, plan())).toBeTrue();
  });

  it('出现 motion 图元就必须播放', () => {
    const graph = { kind: '2d', elements: [{ type: 'motion', x: 'cos(s)', y: 'sin(s)' }] };
    expect(detectAnimate(graph, plan())).toBeTrue();
  });

  it('模型显式写 animate.enabled=false 时不播放', () => {
    const graph = { kind: '2d', animate: { enabled: false }, elements: [{ type: 'curve', fn: 'sin(x - t)' }] };
    expect(detectAnimate(graph, plan())).toBeFalse();
  });

  it('模型显式写 animate.enabled=true 时静态图也播放', () => {
    const graph = { kind: '2d', animate: { enabled: true }, elements: [{ type: 'curve', fn: 'sin(x)' }] };
    expect(detectAnimate(graph, plan())).toBeTrue();
  });

  it('外部强制静态（force=false）时压倒内容判定', () => {
    const graph = { kind: '2d', elements: [{ type: 'curve', fn: 'sin(x - t)' }] };
    expect(detectAnimate(graph, plan({ force: false }))).toBeFalse();
  });

  it('外部强制播放（force=true）时静态内容也动起来', () => {
    const graph = { kind: '2d', elements: [{ type: 'curve', fn: 'sin(x)' }] };
    expect(detectAnimate(graph, plan({ force: true }))).toBeTrue();
  });

  it('坐标范围里的 t 不算时间痕迹', () => {
    const graph = { kind: '2d', axes: { x: [0, 't'] }, surface: { fn: 'x*y', range: [0, 5] } };
    expect(detectAnimate(graph, plan())).toBeFalse();
  });

  it('3D 曲面表达式里出现 t 也算', () => {
    const graph = { kind: '3d', surface: { fn: 'sin(x - t) * cos(y)' } };
    expect(detectAnimate(graph, plan())).toBeTrue();
  });
});

describe('time-animation · normalizeAnimatePlan / timeValue', () => {
  it('缺省：周期 4 秒，时间范围 [0,4]', () => {
    const p = normalizeAnimatePlan(undefined);
    expect(p.period).toBe(4);
    expect(p.tRange).toEqual([0, 4]);
    expect(p.pingpong).toBeFalse();
  });

  it('非法周期与范围被校正回可用值', () => {
    expect(normalizeAnimatePlan({ period: 0 }).period).toBe(0.2);
    expect(normalizeAnimatePlan({ period: 1e6 }).period).toBe(600);
    expect(normalizeAnimatePlan({ period: 2, tRange: [5, 1] }).tRange).toEqual([0, 2]);
  });

  it('线性推进：半个周期走到时间范围中点，整周期回到起点', () => {
    const p = normalizeAnimatePlan({ period: 4, tRange: [0, 8] });
    expect(timeValue(0, p)).toBe(0);
    expect(timeValue(2, p)).toBe(4);
    expect(timeValue(4, p)).toBe(0);
    expect(timeValue(6, p)).toBe(4);
  });

  it('pingpong：三角波往返（单摆式的来回）', () => {
    const p = normalizeAnimatePlan({ period: 4, tRange: [0, 8], pingpong: true });
    expect(timeValue(0, p)).toBe(0);
    expect(timeValue(1, p)).toBe(4);
    expect(timeValue(2, p)).toBe(8);
    expect(timeValue(3, p)).toBe(4);
    expect(timeValue(4, p)).toBe(0);
  });

  it('负时间与超大时间都不会算出界外值', () => {
    const p = normalizeAnimatePlan({ period: 4 });
    expect(timeValue(-1, p)).toBeGreaterThanOrEqual(0);
    expect(timeValue(1e9, p)).toBeLessThanOrEqual(4);
  });
});

describe('time-animation · motionState（参数方程动图）', () => {
  /** 单位圆上的动点：s 从 0 到 1，坐标方程按 2πs 取角。 */
  const circular = {
    type: 'motion',
    x: 'cos(6.283185307179586*s)',
    y: 'sin(6.283185307179586*s)',
    sFrom: 0,
    sTo: 1,
    span: [0, 1] as [number, number],
    trail: 0.25,
  };
  const fns = (expr: string) => (s: number) => {
    // 用与渲染器一致的 Math 映射做一个简单求值（只覆盖本用例所需的函数）。
    // 注意：先看有没有已经映射过的 Math.，否则第二次调用会把 Math.cos 变成 Math.Math.cos。
    const mapped = /Math\./.test(expr) ? expr : expr.replace(/\b(cos|sin|sqrt|exp)\b/g, 'Math.$1');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return Number(new Function('s', `"use strict"; return (${mapped});`)(s));
  };

  it('轨迹覆盖整个参数区间', () => {
    const st = motionState(circular, 0, plan(), fns);
    expect(st.curve.length).toBeGreaterThan(100);
    const xs = st.curve.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(-1, 5);
    expect(Math.max(...xs)).toBeCloseTo(1, 5);
  });

  it('动点位置随相位推进（t=0 在起点，半周期在终点）', () => {
    const p = normalizeAnimatePlan({ period: 4 });
    const at0 = motionState(circular, 0, p, fns).point!;
    expect(at0[0]).toBeCloseTo(1, 5);
    expect(at0[1]).toBeCloseTo(0, 5);

    const atHalf = motionState(circular, 2, p, fns).point!;
    expect(atHalf[0]).toBeCloseTo(-1, 5); // 半周期扫到 s=1，即圆的对侧
    expect(atHalf[1]).toBeCloseTo(0, 5);

    const atQuarter = motionState(circular, 1, p, fns).point!;
    expect(atQuarter[0]).toBeCloseTo(0, 5);
    expect(atQuarter[1]).toBeCloseTo(1, 5);
  });

  it('拖尾点落在动点"身后"，且长度受 trail 控制', () => {
    const p = normalizeAnimatePlan({ period: 4 });
    const st = motionState(circular, 1, p, fns);
    expect(st.trail.length).toBeGreaterThan(2);
    // 拖尾首点就是当前动点，其余点相位更小（即"来路"）
    expect(st.trail[0][0]).toBeCloseTo(st.point![0], 6);
    expect(st.trail[0][1]).toBeCloseTo(st.point![1], 6);
    const [x1, y1] = st.trail[1];
    expect(Math.atan2(y1, x1)).toBeLessThan(Math.atan2(st.point![1], st.point![0]) + 1e-9);
  });

  it('trail=0 时不画拖尾', () => {
    const p = normalizeAnimatePlan({ period: 4 });
    expect(motionState({ ...circular, trail: 0 }, 1, p, fns).trail.length).toBe(0);
  });

  it('pingpong 时动点在两端之间往返', () => {
    const p = normalizeAnimatePlan({ period: 4, pingpong: true });
    const el = { ...circular, sFrom: 0, sTo: 1, span: [0, 1] as [number, number] };
    // elapsed=1 → 相位 0.5（去程到中点）；elapsed=3 → 折返后同样回到相位 0.5
    const half = motionState(el, 1, p, fns).point!;
    expect(half[0]).toBeCloseTo(Math.cos(Math.PI), 5);
    const threeQuarter = motionState(el, 3, p, fns).point!;
    expect(threeQuarter[0]).toBeCloseTo(Math.cos(Math.PI), 5);
    expect(threeQuarter[0]).toBeCloseTo(half[0], 6);
  });

  it('表达式非法时给出空结果而不抛异常', () => {
    const bad = { type: 'motion', x: 'oops(', y: 'sin(s)' };
    const st = motionState(bad, 0, plan(), () => () => NaN);
    expect(st.curve.length).toBe(0);
    expect(st.point).toBeNull();
  });

  // sFrom / sTo / span / trail / samples 的类型本来就是 number | string（见 MotionElement），
  // 但早期实现用 Number() 硬转，模型写 "$num_a" 会静默退化成默认值 —— 拖参数毫无反应。
  // 现在由调用方注入渲染器的 numeric() 求值。
  describe('标量字段支持 $参数名（由调用方注入求值器）', () => {
    const params: Record<string, number> = { num_a: 0.5, num_b: 1, num_trail: 0.6 };
    /** 与渲染器 numeric() 同义的极简实现：只认数字与整串 "$参数名"。 */
    const resolve = (v: unknown, fallback: number): number => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.startsWith('$')) {
        const pv = params[v.slice(1)];
        if (Number.isFinite(pv)) return pv;
      }
      return fallback;
    };

    it('sFrom / sTo 用参数时曲线只在参数区间上采样', () => {
      const el = { type: 'motion', x: 's', y: '0', sFrom: '$num_a', sTo: '$num_b' };
      const st = motionState(el, 0, plan(), fns, resolve);
      expect(st.curve[0][0]).toBeCloseTo(0.5, 6);
      expect(st.curve[st.curve.length - 1][0]).toBeCloseTo(1, 6);
    });

    it('span 用参数时动点从参数给出的位置起扫', () => {
      const el: MotionElement = { type: 'motion', x: 's', y: '0', sFrom: 0, sTo: 1, span: ['$num_a', 1] };
      const at0 = motionState(el, 0, plan(), fns, resolve).point!;
      expect(at0[0]).toBeCloseTo(0.5, 6); // t=0 时相位 0 → s = span 起点 = num_a
    });

    it('trail 用参数时拖尾长度跟着变（0 就没有拖尾）', () => {
      const el: MotionElement = { type: 'motion', x: 's', y: '0', sFrom: 0, sTo: 1, span: [0, 1], trail: '$num_trail' };
      // elapsed=2（周期 4 的中点）时相位 0.5，拖尾往"来路"取点
      expect(motionState(el, 2, plan(), fns, resolve).trail.length).toBeGreaterThan(2);
      expect(motionState({ ...el, trail: 0 }, 2, plan(), fns, resolve).trail.length).toBe(0);
    });

    it('不传求值器时退化为"只认数字"（旧调用方行为不变）', () => {
      const el = { type: 'motion', x: 's', y: '0', sFrom: '$num_a', sTo: 1 };
      const st = motionState(el, 0, plan(), fns);
      expect(st.curve[0][0]).toBeCloseTo(0, 6); // 退化成默认 sFrom = 0
    });
  });
});

describe('time-animation · 表达式规整', () => {
  it('t 不会被"单字母自由变量改名成 x"的兜底吞掉', () => {
    expect(aliasFreeVar('sin(t)')).toBe('sin(t)');
    expect(aliasFreeVar('2*u')).toBe('2*x'); // 其它单字母变量仍照旧改名
  });

  it('normalizeExpression 保留 t、展开隐式乘法与幂', () => {
    expect(normalizeExpression('2t')).toBe('2*t');
    expect(normalizeExpression('x^2')).toBe('x**2');
    expect(normalizeExpression('x²')).toBe('x**2');
    expect(normalizeExpression('sin(t)')).toBe('sin(t)');
    expect(normalizeExpression('<sup>2</sup>')).toBe('**(2)');
  });

  it('fixUnaryPow 把 -x**2 修正为 -(x**2)', () => {
    expect(fixUnaryPow('-x**2')).toBe('-(x**2)');
    expect(fixUnaryPow('2 - x**2')).toBe('2 - x**2');
  });
});
