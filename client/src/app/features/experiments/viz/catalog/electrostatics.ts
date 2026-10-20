import { defineViz, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text } from '../canvas';

/** P13 电场线与电势：点电荷与偶极子。 */
const electricField = defineViz({
  slug: 'electric-field',
  title: '电场线与电势',
  params: {
    config: { type: 'select', options: ['单个正电荷', '电偶极子', '同号双电荷'], default: '电偶极子', label: '电荷配置' },
    lines: { type: 'range', min: 8, max: 32, default: 16, step: 2, label: '场线数量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const config = str(params, 'config', '电偶极子');
    const nLines = Math.round(Number(params['lines'] ?? 16));

    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const sep = Math.min(w, h) * 0.2;
    // 电荷位置与电荷量
    const charges: { x: number; y: number; q: number }[] =
      config === '单个正电荷'
        ? [{ x: cx, y: cy, q: 1 }]
        : config === '电偶极子'
          ? [{ x: cx - sep, y: cy, q: 1 }, { x: cx + sep, y: cy, q: -1 }]
          : [{ x: cx - sep, y: cy, q: 1 }, { x: cx + sep, y: cy, q: 1 }];

    // 电场（库仑叠加）
    const E = (x: number, y: number): [number, number] => {
      let ex = 0, ey = 0;
      for (const c of charges) {
        const dx = x - c.x, dy = y - c.y;
        const r2 = Math.max(dx * dx + dy * dy, 36);
        const r = Math.sqrt(r2);
        const kq = (c.q * 900) / r2; // 绘图尺度缩放
        ex += (kq * dx) / r;
        ey += (kq * dy) / r;
      }
      return [ex, ey];
    };

    // 从正电荷出发追踪场线（负电荷终止）
    const sources = charges.filter((c) => c.q > 0);
    const per = Math.max(4, Math.floor(nLines / Math.max(sources.length, 1)));
    for (const s of sources) {
      for (let i = 0; i < per; i++) {
        const ang = (i / per) * Math.PI * 2;
        let x = s.x + 13 * Math.cos(ang);
        let y = s.y + 13 * Math.sin(ang);
        const path: [number, number][] = [[x, y]];
        for (let step = 0; step < 240; step++) {
          const [ex, ey] = E(x, y);
          const mag = Math.hypot(ex, ey);
          if (mag < 1e-6) break;
          x += (ex / mag) * 5;
          y += (ey / mag) * 5;
          if (x < 8 || x > w - 8 || y < 8 || y > h - 8) break;
          path.push([x, y]);
          // 到达负电荷
          const hit = charges.some((c) => c.q < 0 && Math.hypot(x - c.x, y - c.y) < 13);
          if (hit) break;
        }
        if (path.length > 2) poly(f, path, { stroke: `${C.cool}bb`, lw: 1.4 });
      }
    }

    // 电荷
    for (const c of charges) {
      dot(f, c.x, c.y, 11, c.q > 0 ? C.hot : C.accent);
      text(f, c.q > 0 ? '+' : '−', c.x, c.y + 5, { align: 'center', color: '#fff', font: '15px sans-serif' });
    }
    // 场方向箭头（中线上的试探）
    for (const t of [-0.6, -0.3, 0.3, 0.6]) {
      const px = cx + t * sep * 2.2, py = cy;
      const [ex, ey] = E(px, py);
      const m = Math.hypot(ex, ey) || 1;
      seg(f, px, py, px + (ex / m) * 26, py + (ey / m) * 26, C.green, 2);
    }
    text(f, '→ 场方向', cx + sep * 1.2, cy - 14, { color: C.green, font: '11px sans-serif' });

    const foot: string[] = [];
    if (config === '单个正电荷') {
      foot.push('点电荷场线沿径向均匀辐射：E = kq/r²，穿过同心球面的通量恒定（高斯定律的几何含义）');
      foot.push('场线疏密 ∝ 场强：靠近电荷处线密、场强；远处线疏、场弱（平方反比）');
    } else if (config === '电偶极子') {
      foot.push('偶极子场线从正电荷出发终止于负电荷：分子（如水）的电性质由此描述');
      foot.push('中垂线上场强垂直于轴线；远处场强按 1/r³ 衰减（比单电荷的 1/r² 更快）');
    } else {
      foot.push('同号电荷：场线相互排斥、中间存在场强为零的中性点（斥力型配置）');
      foot.push('场线永不相交 —— 空间每点的电场方向唯一');
    }
    foot.push('数值方法：从正电荷出发沿 E(x,y) 方向欧拉积分追踪，库仑定律叠加计算合场');
    footnotes(f, foot);
    heading(f, `电场线：${config}`);
  },
});
registerViz(electricField);

/** P14 电流的磁场：直导线与螺线管。 */
const magneticField = defineViz({
  slug: 'magnetic-field',
  title: '电流的磁场',
  params: {
    config: { type: 'select', options: ['直导线', '螺线管'], default: '直导线', label: '构型' },
    I: { type: 'range', min: -5, max: 5, default: 3, step: 0.5, label: '电流 I (A，负号反向)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const config = str(params, 'config', '直导线');
    const I = Number(params['I'] ?? 3);
    const dir = I >= 0 ? 1 : -1;

    clear(f);
    if (config === '直导线') {
      const cx = w / 2, cy = h / 2 + 6;
      // 同心圆磁感线
      for (let i = 1; i <= 6; i++) {
        const r = i * Math.min(w, h) * 0.075;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx: any = f.ctx;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(66, 153, 225, ${0.85 - i * 0.1})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // 方向箭头（顶部一点）
        const a = -Math.PI / 2;
        const hx = cx + r * Math.cos(a), hy = cy + r * Math.sin(a);
        text(f, dir > 0 ? '↻' : '↺', hx, hy - 6, { align: 'center', color: C.cool, font: '13px sans-serif' });
      }
      // 导线（垂直纸面）：⊙ 或 ⊗
      dot(f, cx, cy, 13, C.warm);
      text(f, dir > 0 ? '⊙' : '⊗', cx, cy + 7, { align: 'center', color: '#1a202c', font: '17px sans-serif' });
      text(f, dir > 0 ? '电流出纸面' : '电流入纸面', cx + 20, cy - 18, { color: C.warm, font: '12px sans-serif' });
      text(f, `I = ${I} A`, cx + 20, cy - 2, { color: C.dim, font: '12px sans-serif' });
      footnotes(f, [
        '安培环路定律：∮B·dl = μ₀I —— 直导线外 B = μ₀I/(2πr)，场强随距离线性减弱（圆线等间距变疏）',
        '右手定则：拇指指向电流（出纸面），四指弯曲方向即磁感线方向（逆时针 ↻）',
        '磁场是"无源场"：磁感线永远闭合，不存在磁单极子（至今未观测到）',
      ]);
      heading(f, '长直导线的磁场（截面图）');
    } else {
      // 螺线管（侧视）
      const y0 = h * 0.5;
      const left = w * 0.14, right = w * 0.86;
      const turns = 9;
      // 线圈匝
      for (let i = 0; i <= turns; i++) {
        const x = left + ((right - left) * i) / turns;
        const ctx2 = f.ctx;
        ctx2.beginPath();
        ctx2.ellipse(x, y0, 9, 34, 0, 0, Math.PI * 2);
        ctx2.strokeStyle = C.warm;
        ctx2.lineWidth = 2;
        ctx2.stroke();
      }
      // 内部匀强磁感线
      for (let j = -2; j <= 2; j++) {
        const yy = y0 + j * 16;
        seg(f, left - 24, yy, right + 24, yy, C.cool, 1.6);
        text(f, '→', right + 14, yy + 4, { color: C.cool, font: '12px sans-serif' });
      }
      // 外部回线（近似椭圆弧）
      for (let j = -1; j <= 1; j += 2) {
        const path: [number, number][] = [];
        for (let i = 0; i <= 60; i++) {
          const t = i / 60;
          const x = left + (right - left) * t;
          const yy = y0 + j * (66 + 24 * Math.sin(Math.PI * t));
          path.push([x, yy]);
        }
        poly(f, path, { stroke: `${C.cool}77`, lw: 1.2, dash: [5, 4] } as any);
      }
      text(f, `I = ${I} A（${dir > 0 ? '向右' : '向左'}）`, w / 2 - 40, y0 - 74, { color: C.warm, font: '12px sans-serif' });
      text(f, '内部 B 均匀', w / 2 - 30, y0 + 4, { color: C.cool, font: '12px sans-serif' });
      footnotes(f, [
        '螺线管内部磁场近似均匀（B = μ₀nI，n 为单位长度匝数），方向由右手定则确定',
        '外部磁感线闭合回连，与条形磁铁的磁场同构 —— 通电螺线管就是"人造磁铁"（电磁铁基础）',
        '电流反向则磁场反向：这正是电磁继电器、扬声器、磁悬浮的工作原理',
      ]);
      heading(f, '通电螺线管的磁场');
    }
  },
});
registerViz(magneticField);
