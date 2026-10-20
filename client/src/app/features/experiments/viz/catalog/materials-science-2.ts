import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng, vec } from '../canvas';

/** 高分子玻璃化转变。 */
const polymerGlassTransition = defineViz({
  slug: 'polymer-glass-transition', title: '高分子玻璃化转变', animated: true,
  params: { tg: { type: 'range', min: 40, max: 250, default: 100, step: 10, label: '材料 Tg (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Tg = num(params, 'tg', 100);
    clear(f);
    // 比容-温度曲线（Tg 折点）
    const v = view(f, { xMin: 0, xMax: 300, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const vt: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 300;
      let y: number;
      if (t < Tg) y = 0.28 + t * 0.0007;
      else y = 0.28 + Tg * 0.0007 + (t - Tg) * 0.0015;
      vt.push([v.sx(t), v.sy(Math.min(1.05, y))]);
    }
    poly(f, vt, { stroke: C.accent, lw: 3.4 });
    seg(f, v.sx(Tg), v.sy(0), v.sx(Tg), v.sy(1.06), `${C.hot}99`, 1.8, );
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(Tg), v.sy(0.28 + Tg * 0.0007), 9, `rgba(245,101,101,${pulse})`);
    text(f, `Tg = ${Tg}℃（比容斜率折点）`, v.sx(Tg) + 10, v.sy(1.0), { color: C.hot, font: '12px sans-serif' });
    text(f, '玻璃态（链段冻结）', v.sx(6), v.sy(0.92), { color: C.cool, font: '12px sans-serif' });
    text(f, '高弹态（链段可动）', v.sx(Tg + 16), v.sy(0.98), { color: C.green, font: '12px sans-serif' });
    text(f, '温度 →（℃）', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '比容', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    // 链段状态示意（右上）
    const ax = w * 0.72, ay = 92;
    const frozen = ((f.t * 0.5) % 2) < 1;
    text(f, frozen ? '玻璃态：链段冻结，像玻璃一样脆' : '高弹态：链段蠕动，像橡胶一样弹', ax - 120, ay - 24,
      { color: frozen ? C.cool : C.green, font: '12px sans-serif' });
    const rand = rng(12);
    for (let k = 0; k < 3; k++) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const wob = frozen ? 0 : Math.sin(t * 6 + f.t * 3 + k) * 7;
        pts.push([ax - 120 + t * 230, ay + k * 26 + Math.sin(t * 8 + k * 2) * 9 + wob]);
      }
      poly(f, pts, { stroke: frozen ? `rgba(66,153,225,0.7)` : `rgba(72,187,120,0.8)`, lw: 3.4 });
      void rand;
    }
    text(f, `${Tg < 80 ? '低 Tg（如 PS ~100℃）：室温即玻璃态' : '高 Tg（如 PEKK ~260℃）：高温仍挺括'}`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, 'Tg 之下是玻璃、之上是橡胶——同一种塑料的两副面孔', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '玻璃化转变不是相变却有折点——自由体积收缩到链段动不了',
      '增塑剂插入链间抬高自由体积——Tg 随之下降，PVC 软硬之别在此',
      '注塑温度窗、隐形眼镜与 3D 打印耗材都拿 Tg 当第一参数',
    ]);
    heading(f, '玻璃化转变：塑料的两副面孔');
  },
});
registerViz(polymerGlassTransition);

/** 橡胶弹性与熵弹簧。 */
const rubberElasticity = defineViz({
  slug: 'rubber-elasticity', title: '橡胶弹性与熵弹簧', animated: true,
  params: { stretch: { type: 'range', min: 100, max: 500, default: 250, step: 10, label: '伸长率 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lam = num(params, 'stretch', 250) / 100;
    clear(f);
    // 交联网络（拉伸取向）
    const cx = w * 0.3, cy = h * 0.46;
    const rand = rng(19);
    const nodes: [number, number][] = [];
    for (let i = 0; i < 24; i++) {
      const x = cx - 130 + rand() * 260;
      const y = cy - 70 + rand() * 140;
      const x2 = cx + (x - cx) * lam * 0.55;
      const y2 = cy + (y - cy) / Math.sqrt(lam) * 0.7;
      nodes.push([x2, y2]);
    }
    // 链（波浪线表示构象）
    for (let i = 0; i < nodes.length; i++) {
      const [x, y] = nodes[i];
      circle(f, x, y, 6.4, { fill: C.warm });
      if (i + 6 < nodes.length) {
        const [x2, y2] = nodes[i + 6];
        if (Math.hypot(x2 - x, y2 - y) < 220) {
          const pts: [number, number][] = [];
          for (let k = 0; k <= 12; k++) {
            const t = k / 12;
            pts.push([x + (x2 - x) * t, y + (y2 - y) * t + Math.sin(t * Math.PI * 4) * 6 / lam]);
          }
          poly(f, pts, { stroke: `rgba(66,153,225,${lam > 1.6 ? 0.9 : 0.6})`, lw: 3 });
        }
      }
    }
    text(f, lam > 1.5 ? '拉伸后链段取向——构象数骤减，熵下降' : '松弛态：链卷曲，构象自由（高熵）',
      cx - 150, cy - 100, { color: lam > 1.5 ? C.hot : C.cool, font: '12px sans-serif' });
    // 熵回复力箭头
    const force = (lam - 1) * 0.8;
    vec(f, cx - 170, cy, cx - 170 - force * 30, cy, C.green, 4);
    vec(f, cx + 170, cy, cx + 170 + force * 30, cy, C.green, 4);
    text(f, '回缩力 ∝ T（温度越高弹力越大！）', cx - 120, cy + 128, { color: C.green, font: '12px sans-serif' });
    // 力-伸长曲线（右）
    const v = view(f, { xMin: 1, xMax: 5, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 4, ticks: true });
    const fp: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const l = 1 + (i / 200) * 4;
      const ff = l - 1 / (l * l);
      fp.push([v.sx(l), v.sy(Math.min(1.05, ff / 4.9))]);
    }
    poly(f, fp, { stroke: C.accent, lw: 3.4 });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(lam), v.sy(Math.min(1.05, (lam - 1 / (lam * lam)) / 4.9)), 9, `rgba(72,187,120,${pulse})`);
    text(f, 'f = ρRT/M_c·(λ − 1/λ²)——熵弹性本构', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '伸长比 λ →', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '拉伸力（归一）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前 λ=${lam.toFixed(1)}：${lam > 3.5 ? '接近极限——链完全伸直后急硬化' : '橡胶在拉，熵在抗议'}`,
      30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '橡胶回缩推它回去的不是内能而是混乱——熵弹性的反直觉之处',
      '模量随温度升高反而增大——与金属弹性完全相反的温度依赖',
      '轮胎、减震与软体机器人共用这一个统计力学底座',
    ]);
    heading(f, '橡胶弹性：熵在推你回来');
  },
});
registerViz(rubberElasticity);

/** 陶瓷与共价网络固体。 */
const ceramicSolid = defineViz({
  slug: 'ceramic-solid', title: '陶瓷与共价网络固体', animated: true,
  params: { bond: { type: 'select', options: ['离子键（NaCl 型）', '共价键（金刚石网络）'], default: '离子键（NaCl 型）', label: '键型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const covalent = String((params as Record<string, unknown>)['bond'] ?? '').includes('共价');
    clear(f);
    const cx = w * 0.34, cy = h * 0.46, cell = 52;
    if (!covalent) {
      // NaCl 离子阵
      for (let r = -3; r <= 3; r++) {
        for (let c = -3; c <= 3; c++) {
          const x = cx + c * cell, y = cy + r * cell;
          if (x < 60 || x > w * 0.62 || y < 80 || y > h - 130) continue;
          const big = (r + c) % 2 === 0;
          circle(f, x, y, big ? 21 : 15, {
            stroke: big ? C.cool : C.warm, lw: 2.6,
            fill: big ? 'rgba(66,153,225,0.45)' : 'rgba(237,137,54,0.5)',
          });
        }
      }
      text(f, 'Na⁺/Cl⁻ 交替排列：各向同性、无自由电子', 70, 78, { color: C.cyan, font: '13px sans-serif' });
      text(f, '同号相邻即排斥——离子键不许位错轻易滑移', 70, h - 106, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 金刚石共价网络
      const sp3: [number, number][] = [];
      for (let r = -3; r <= 3; r++) {
        for (let c = -3; c <= 3; c++) {
          const x = cx + (c + (r % 2 ? 0.5 : 0)) * cell;
          const y = cy + r * cell * 0.86;
          if (x < 60 || x > w * 0.62 || y < 80 || y > h - 130) continue;
          sp3.push([x, y]);
        }
      }
      for (const [x, y] of sp3) {
        for (const [dx, dy] of [[cell, 0], [0, cell * 0.86], [cell * 0.5, cell * 0.43]] as [number, number][]) {
          const x2 = x + dx, y2 = y + dy;
          if (x2 > 60 && x2 < w * 0.62 && y2 > 80 && y2 < h - 130) seg(f, x, y, x2, y2, C.warm, 3.4);
        }
        circle(f, x, y, 13, { fill: 'rgba(236,201,75,0.85)' });
      }
      text(f, 'sp³ 方向性共价网络：强、硬、各向异性', 70, 78, { color: C.cyan, font: '13px sans-serif' });
      text(f, '方向性强 → 位错难滑 → 硬度高但脆性大', 70, h - 106, { color: C.warm, font: '12px sans-serif' });
    }
    // 右侧性能对比条
    const bx = w * 0.68;
    text(f, '与金属对比', bx, 84, { color: C.dim, font: '12px sans-serif' });
    const rows: [string, number, number, string][] = [
      ['熔点', 0.9, 0.5, C.hot],
      ['硬度', 0.92, 0.6, C.warm],
      ['断裂韧度', 0.12, 0.9, C.cool],
      ['导电性', 0.03, 0.95, C.green],
    ];
    rows.forEach(([name, ceramic, metal, color], i) => {
      const y = 124 + i * 74;
      text(f, `${name}（黄=陶瓷，蓝=金属）`, bx, y - 6, { color, font: '11px sans-serif' });
      poly(f, [[bx, y], [bx + ceramic * 150, y], [bx + ceramic * 150, y + 16], [bx, y + 16]],
        { stroke: 'transparent', fill: 'rgba(236,201,75,0.85)' });
      poly(f, [[bx, y + 22], [bx + metal * 150, y + 22], [bx + metal * 150, y + 38], [bx, y + 38]],
        { stroke: 'transparent', fill: 'rgba(66,153,225,0.8)' });
    });
    text(f, covalent ? '共价网络：极致的硬与脆（金刚石、氮化硅）' : '离子晶体：绝缘耐高温，穿晶断裂几乎无塑性',
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '强键给了陶瓷耐高温与高硬度，也拿走了塑性——脆是强键的代价',
      '氧化锆相变增韧把陶瓷从装饰材料变成结构材料（1975）',
      '牙齿贴面、切削刀具与电解质隔膜——先进陶瓷的多样岗位',
    ]);
    heading(f, '陶瓷：硬而脆的强键世界');
  },
});
registerViz(ceramicSolid);

/** 第二类超导与磁通涡旋。 */
const typeIiSuperconductor = defineViz({
  slug: 'type-ii-superconductor', title: '第二类超导与磁通涡旋', animated: true,
  params: { field: { type: 'range', min: 0, max: 12, default: 6, step: 0.5, label: '外磁场 (T)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const H = num(params, 'field', 6);
    clear(f);
    const Hc1 = 0.05, Hc2 = 11;
    const state = H < Hc1 ? '迈斯纳态（完全抗磁）' : H < Hc2 ? '混合态（磁通量子化涡旋穿透）' : '正常态（超导性消失）';
    // 左：样品与涡旋
    const bx = 60, by = h * 0.3, bw = w * 0.46, bh = h * 0.44;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.14)' });
    text(f, '第二类超导体样品', bx, by - 14, { color: C.cool, font: '11px sans-serif' });
    if (H < Hc1) {
      // 磁力线绕过
      for (let k = 0; k < 5; k++) {
        const x = bx + 30 + k * (bw - 60) / 4;
        const pts: [number, number][] = [];
        for (let i = 0; i <= 30; i++) {
          const t = i / 30;
          const y = by - 60 + t * (bh + 120);
          const bulge = Math.sin(t * Math.PI) * 34;
          pts.push([x + (x > bx + bw / 2 ? bulge : -bulge), y]);
        }
        poly(f, pts, { stroke: `rgba(146,84,222,0.75)`, lw: 2.6 });
      }
      text(f, '磁力线被排出样品（完全抗磁）', bx + 60, by + bh + 40, { color: '#9254de', font: '12px sans-serif' });
    } else if (H < Hc2) {
      // 涡旋阵列（Abrikosov 点阵）
      const nV = Math.round((H - Hc1) / (Hc2 - Hc1) * 40) + 4;
      const rand = rng(77);
      for (let i = 0; i < nV; i++) {
        const x = bx + 26 + rand() * (bw - 52);
        const y = by + 26 + rand() * (bh - 52);
        const ph = f.t * 3 + i;
        // 涡旋核心
        circle(f, x, y, 7, { fill: 'rgba(245,101,101,0.9)' });
        for (let k = 1; k <= 3; k++) circle(f, x, y, 7 + k * 8 + Math.sin(ph) * 1.6, { stroke: `rgba(146,84,222,${0.6 - k * 0.14})`, lw: 1.8 });
        // 场线箭头（穿出）
        if (k2(i)) seg(f, x, y, x, y - 18, `rgba(236,201,75,0.8)`, 1.6);
      }
      function k2(i: number) { return i % 3 === 0; }
      text(f, `混合态：每根涡旋携带一个磁通量子 Φ₀=h/2e≈2.07×10⁻¹⁵ Wb`, bx + 14, by + bh + 40,
        { color: '#9254de', font: '12px sans-serif' });
      text(f, '红色核心=正常态细丝，被缺陷钉扎住才不流动耗能', bx + 14, by + bh + 66, { color: C.dim, font: '11px sans-serif' });
    } else {
      for (let k = 0; k < 6; k++) {
        const x = bx + 30 + k * (bw - 60) / 5;
        seg(f, x, by - 60, x, by + bh + 60, `rgba(146,84,222,0.75)`, 2.6);
      }
      text(f, '磁场畅通无阻——超导性已被完全破坏', bx + 60, by + bh + 40, { color: C.hot, font: '12px sans-serif' });
    }
    // 右：H-T 相图
    const v = view(f, { xMin: 0, xMax: 12, yMin: 0, yMax: 100, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const c1: [number, number][] = [], c2: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * 12;
      c1.push([v.sx(t), v.sy(90 * (1 - t / 11.4))]);
      c2.push([v.sx(t), v.sy(90 * Math.pow(1 - t / Hc2, 0.5))]);
    }
    poly(f, c1, { stroke: C.cool, lw: 3.4 });
    poly(f, c2, { stroke: C.warm, lw: 3.4, dash: [7, 5] });
    text(f, '迈斯纳态', v.sx(0.4), v.sy(80), { color: C.cool, font: '12px sans-serif' });
    text(f, '混合态（涡旋）', v.sx(4), v.sy(46), { color: C.warm, font: '12px sans-serif' });
    text(f, '正常态', v.sx(10), v.sy(16), { color: C.hot, font: '12px sans-serif' });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(H), v.sy(H < 90 * (1 - H / 11.4) ? 50 : H < Hc2 ? 30 : 8), 9, `rgba(72,187,120,${pulse})`);
    text(f, `${H} T → ${state}`, 30, 44, { color: H < Hc1 ? C.cool : H < Hc2 ? C.warm : C.hot, font: '13px sans-serif' });
    text(f, '磁场 (T) →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '温度 (K)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      'Abrikosov 混合态理论（1957）曾被嘲笑——2003 年诺贝尔奖',
      '钉扎强度决定临界电流——超导磁体能否扛住高场全看缺陷工程',
      'MRI 磁体与核聚变线圈都是第二类超导——高场应用的主力',
    ]);
    heading(f, '第二类超导：让磁场排队穿针');
  },
});
registerViz(typeIiSuperconductor);

/** 准晶与五重对称。 */
const quasicrystal = defineViz({
  slug: 'quasicrystal', title: '准晶与五重对称', animated: true,
  params: { mode: { type: 'select', options: ['实空间彭罗斯拼接', '衍射图样'], default: '衍射图样', label: '视图' } },
  draw: (f) => {
    const { w, h, params } = f;
    const showDiff = String((params as Record<string, unknown>)['mode'] ?? '').includes('衍射');
    clear(f);
    if (!showDiff) {
      // 彭罗斯拼接（菱形铺砌近似）
      const cx = w * 0.42, cy = h * 0.5, s = 46;
      const rand = rng(5);
      const drawRhomb = (x: number, y: number, a: number, thick: boolean, color: string) => {
        const pts: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const ang = a + (k + (k > 0 ? 0 : 0)) * (Math.PI / 5) + (k > 0 ? Math.PI / 5 : 0);
          void ang;
        }
        const w1 = Math.PI / 5, L = s;
        const base = a;
        const a0 = [x, y];
        const a1 = [x + Math.cos(base) * L, y + Math.sin(base) * L];
        const a2 = [a1[0] + Math.cos(base + w1) * L, a1[1] + Math.sin(base + w1) * L];
        const a3 = [x + Math.cos(base + w1) * L, y + Math.sin(base + w1) * L];
        const a4 = [x + Math.cos(base - w1) * L, y + Math.sin(base - w1) * L];
        const a5 = [a4[0] + Math.cos(base) * L, a4[1] + Math.sin(base) * L];
        const a6 = [a5[0] + Math.cos(base + w1) * L, a5[1] + Math.sin(base + w1) * L];
        if (thick) poly(f, [a0 as [number, number], a1 as [number, number], a2 as [number, number], a3 as [number, number]],
          { stroke: `${C.grid}cc`, lw: 1.6, fill: `${color}55` });
        else poly(f, [a4 as [number, number], a5 as [number, number], a6 as [number, number], a3 as [number, number]],
          { stroke: `${C.grid}cc`, lw: 1.6, fill: `${color}55` });
        void rand;
      };
      for (let r = -3; r <= 3; r++) {
        for (let c = -3; c <= 3; c++) {
          const x = cx + c * s * 1.6, y = cy + r * s * 1.5;
          if (x < 40 || x > w * 0.7 || y < 70 || y > h - 110) continue;
          drawRhomb(x, y, ((r + c) % 5) * (Math.PI / 5), (r + c) % 2 === 0, (r + c) % 2 === 0 ? C.cool : C.warm);
        }
      }
      text(f, '厚/薄两种菱形无缝铺满——长程序但不平移重复', 40, 44, { color: C.cyan, font: '13px sans-serif' });
      // 五重对称示意（右）
      const px = w * 0.82, py = h * 0.46;
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + f.t * 0.3;
        seg(f, px, py, px + Math.cos(a) * 74, py + Math.sin(a) * 74, `rgba(72,187,120,${pulse})`, 3.4);
        seg(f, px, py, px - Math.cos(a) * 74, py - Math.sin(a) * 74, `rgba(72,187,120,${pulse})`, 3.4);
      }
      circle(f, px, py, 80, { stroke: `${C.green}77`, lw: 1.6, dash: [4, 4] });
      text(f, '五重旋转对称', px - 46, py + 104, { color: C.green, font: '11px sans-serif' });
      text(f, '晶体学禁戒的对称——1982 年被当成放错的样品', 40, h - 66, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 衍射图样：五重斑
      const cx = w * 0.45, cy = h * 0.5;
      const pulse = 0.6 + 0.4 * Math.sin(f.t * 2);
      for (let ring = 1; ring <= 4; ring++) {
        const r = ring * 66;
        const bright = (1 - ring * 0.16) * pulse;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + ring * 0.31;
          const sz = 9 - ring;
          dot(f, cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(3, sz), `rgba(236,201,75,${bright})`);
        }
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - ring * 0.31 + Math.PI / 10;
          const sz = 9 - ring;
          dot(f, cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(3, sz), `rgba(146,84,222,${bright * 0.7})`);
        }
      }
      dot(f, cx, cy, 10, '#fffbeb');
      // 五重对称验证环
      circle(f, cx, cy, 132, { stroke: `${C.green}66`, lw: 1.6, dash: [5, 5] });
      text(f, '10 个斑点 = 五重旋转的两组等价位置', cx - 130, cy - 158, { color: C.green, font: '12px sans-serif' });
      text(f, '衍射斑呈五重对称——平移周期晶体给不出这种图', 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '1982 年 Shechtman 在电镜下看到它，被同行质疑十年（2011 年诺奖）', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    }
    footnotes(f, [
      '彭罗斯拼接是几何模型：不重复却严丝合缝——有序不等于周期',
      '准晶低摩擦、不粘、隔热——不粘锅涂层与牙科钻头已在用',
      '从"不可能"到诺贝尔奖——科学守门人最著名的误判之一',
    ]);
    heading(f, '准晶：五重对称的有序固体');
  },
});
registerViz(quasicrystal);

/** 金属玻璃。 */
const metallicGlass = defineViz({
  slug: 'metallic-glass', title: '金属玻璃', animated: true,
  params: { rate: { type: 'range', min: 1, max: 6, default: 3, step: 0.5, label: '冷却速率 (log K/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const logR = num(params, 'rate', 3);
    const glassy = logR >= 2.5;
    clear(f);
    // 左：TTT 曲线与冷却路径（能否躲过鼻尖）
    const v = view(f, { xMin: 0, xMax: 4, yMin: 0, yMax: 400, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 结晶鼻尖
    const nose: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = 0.3 + (i / 120) * 3.5;
      const y = 120 + 200 * Math.pow((t - 1.6) / 1.5, 2);
      nose.push([v.sx(t), v.sy(Math.min(390, Math.max(40, y)))]);
    }
    poly(f, nose, { stroke: C.warm, lw: 3.4 });
    text(f, '结晶鼻尖（穿过就长晶体）', v.sx(1.7), v.sy(370), { color: C.warm, font: '11px sans-serif' });
    // 冷却曲线
    const cool: [number, number][] = [];
    const slope = logR * 0.9;
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * 4;
      cool.push([v.sx(t), v.sy(Math.max(0, 400 - t * 100 * slope))]);
    }
    poly(f, cool, { stroke: glassy ? C.green : C.hot, lw: 3.4, dash: [7, 5] });
    text(f, `${logR.toFixed(1)} log(K/s)：${glassy ? '躲过鼻尖 → 非晶冻结' : '穿过鼻尖 → 长出晶体'}`,
      v.sx(0.1), v.sy(44), { color: glassy ? C.green : C.hot, font: '12px sans-serif' });
    text(f, '时间 →（s，对数示意）', w * 0.44, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '温度 (K)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    // 右：原子排列（玻璃 vs 晶体）
    const rand = rng(glassy ? 3 : 9);
    const ox = w * 0.66, oy = h * 0.34;
    text(f, glassy ? '非晶：原子无长程有序（冻结的液体）' : '晶体：原子周期排队', ox, oy - 22,
      { color: glassy ? C.green : C.cool, font: '12px sans-serif' });
    for (let i = 0; i < 60; i++) {
      let x: number, y: number;
      if (glassy) {
        x = ox + rand() * 200;
        y = oy + rand() * 200;
      } else {
        const c = i % 8, r = Math.floor(i / 8);
        x = ox + c * 26 + rand() * 4;
        y = oy + r * 26 + rand() * 4;
      }
      if (y < h - 130) dot(f, x, y, 7, glassy ? `rgba(237,137,54,0.85)` : `rgba(66,153,225,0.85)`);
    }
    text(f, `临界冷却速率 R_c ~ 10^${logR.toFixed(1)} K/s：${glassy ? '带体非晶可达' : '太慢——晶核抢先成形'}`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '无晶界无位错 → 超高强度与弹性极限，代价是脆与难做厚', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Duwez 1960 年把金硅熔液喷在冷铜上——非晶金属就此诞生',
      '块体金属玻璃让非晶走进三维构件——成分设计仍是主战场',
      '变压器带材用它的软磁性——非晶合金的成熟商业岗位',
    ]);
    heading(f, '金属玻璃：冻住的液体金属');
  },
});
registerViz(metallicGlass);

/** 薄膜沉积与外延。 */
const thinFilmDeposition = defineViz({
  slug: 'thin-film-deposition', title: '薄膜沉积与外延', animated: true,
  params: { mismatch: { type: 'range', min: 0, max: 10, default: 2, step: 0.5, label: '晶格失配 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mis = num(params, 'mismatch', 2);
    const strained = mis < 4;
    clear(f);
    // 衬底晶格与外延层
    const cell = 46, cy = h * 0.56, ox = w * 0.24;
    const rows = 3;
    // 衬底（下 2 行）
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 9; c++) {
        const x = ox + c * cell, y = cy + r * cell;
        if (x > w * 0.78) continue;
        dot(f, x, y, 10, `rgba(66,153,225,0.85)`);
        if (c < 8 && x + cell <= w * 0.78) seg(f, x, y, x + cell, y, `${C.cool}77`, 1.6);
        if (r < 1) seg(f, x, y, x, y + cell, `${C.cool}77`, 1.6);
      }
    }
    text(f, '衬底（晶格常数 a_s）', ox, cy + 2 * cell + 34, { color: C.cool, font: '12px sans-serif' });
    // 外延层（上 2 行，被拉伸/失配）
    const filmCell = cell * (1 + mis / 100);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 9; c++) {
        const x = ox + c * filmCell + (r === 1 && !strained ? (mis > 4 ? 0 : 0) : 0);
        const y = cy - cell + r * cell;
        if (x > w * 0.8) continue;
        const jitter = strained ? 0 : (c % 3 === 0 ? 5 : -3);
        dot(f, x, y + jitter, 10, strained ? `rgba(237,137,54,0.9)` : `rgba(245,101,101,0.9)`);
        if (c < 8 && x + filmCell <= w * 0.8) seg(f, x, y + jitter, x + filmCell, y + jitter, `${C.warm}77`, 1.6);
      }
    }
    // 界面失配位错（超过临界厚度后出现）
    if (!strained) {
      const misX = ox + Math.round(w * 0.28 / filmCell) * filmCell;
      text(f, '⊥', misX - 8, cy - 4, { color: C.hot, font: '20px sans-serif' });
      text(f, '失配位错（应变释放）', misX + 14, cy - 10, { color: C.hot, font: '11px sans-serif' });
    }
    text(f, strained ? '共格外延：薄膜被拉伸匹配衬底（弹性应变）' : '失配过大：失配位错成核——外延层质量劣化',
      ox - 60, cy - cell * 2 - 44, { color: strained ? C.green : C.hot, font: '13px sans-serif' });
    // 应变能曲线
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    void v;
    text(f, `晶格失配 ${mis}%：${strained ? '低于临界值——逐层共格生长（MBE/MOCVD 可控到单原子层）' : '超过临界——先共格后弛豫，界面出现缺陷'}`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 沉积方式卡
    const bx = w * 0.66, by = h - 134;
    const ways: [string, string][] = [
      ['MBE 分子束外延', '超高真空、逐层慢长'],
      ['MOCVD 化学气相', '量产主力、化合物半导体'],
      ['PVD 溅射/蒸镀', '通用镀膜、金属陶瓷'],
    ];
    ways.forEach(([k, d2], i) => {
      const y = by + i * 34;
      const on = (f.t * 0.5) % 1 > i / 3;
      text(f, `${on ? '✓' : '·'} ${k}：${d2}`, 40, y, { color: on ? C.green : C.dim, font: '12px sans-serif' });
    });
    text(f, '从光学镀膜到芯片异质结——薄膜工艺撑起表面技术', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '晶格匹配是外延的命门——失配位错是天敌，也是应变工程的工具',
      '应变硅刻意保留失配应力提高迁移率——缺陷也能为我所用',
      '衬底温度与沉积速率共同决定膜的结构与缺陷密度',
    ]);
    heading(f, '薄膜外延：一层原子一层原子盖房子');
  },
});
registerViz(thinFilmDeposition);

/** 薄膜应力与界面。 */
const thinFilmStress = defineViz({
  slug: 'thin-film-stress', title: '薄膜应力与界面', animated: true,
  params: { dT: { type: 'range', min: -400, max: 400, default: -200, step: 20, label: 'ΔT（衬底-薄膜）(K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const dT = num(params, 'dT', -200);
    const tensile = dT > 0;
    clear(f);
    // 薄膜翘曲（曲率随应力变）
    const bend = Math.max(-60, Math.min(60, dT / 10));
    const cx = w * 0.36, cy = h * 0.56;
    // 衬底
    const sub: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = cx - 220 + t * 440;
      const y = cy + Math.pow((t - 0.5) * 2, 2) * bend - bend * 0.25;
      sub.push([x, y]);
    }
    poly(f, sub, { stroke: C.dim, lw: 3 });
    const sub2 = sub.map(([x, y]) => [x, y + 34] as [number, number]);
    poly(f, [...sub2].reverse(), { stroke: `${C.dim}aa`, lw: 3, fill: 'rgba(100,116,139,0.35)' });
    poly(f, sub, { stroke: 'transparent', fill: 'rgba(100,116,139,0.3)' });
    // 薄膜（上表层，随应力）
    const film = sub.map(([x, y]) => [x, y - 14] as [number, number]);
    poly(f, film, { stroke: tensile ? C.hot : C.cool, lw: 5 });
    text(f, tensile ? '薄膜受拉（想收缩、被衬底拽住）' : '薄膜受压（想膨胀、被衬底按住）',
      cx - 200, cy - 100 - Math.abs(bend) * 0.4, { color: tensile ? C.hot : C.cool, font: '13px sans-serif' });
    // 应力箭头
    for (const s of [-1, 1]) {
      const ax = cx + s * 150;
      const yTop = cy + Math.pow((s * 150 / 220) , 2) * bend - bend * 0.25 - 30;
      vec(f, ax, yTop, ax + s * 44, yTop, tensile ? C.hot : C.cool, 3.4);
    }
    text(f, '曲率 = 应力的读数（Stoney 公式）', cx - 110, cy + 100, { color: C.dim, font: '12px sans-serif' });
    // Stoney 公式
    text(f, `σ = E_s·t_s²/(6·t_f·R)：ΔT=${dT} K → ${Math.abs(bend) > 40 ? '曲率大，接近剥离风险' : '曲率可控'}`,
      30, 44, { color: Math.abs(bend) > 40 ? C.hot : C.cyan, font: '13px sans-serif' });
    // 界面开裂示意
    const ix = w * 0.76;
    text(f, '界面失效模式', ix - 60, 84, { color: C.dim, font: '12px sans-serif' });
    const failModes = [
      ['剥落（应变能 > 黏附功）', Math.abs(bend) > 30],
      ['裂纹贯穿薄膜', tensile && Math.abs(bend) > 40],
      ['翘曲起泡', !tensile && Math.abs(bend) > 40],
    ];
    failModes.forEach(([name, on], i) => {
      const y = 130 + i * 44;
      poly(f, [[ix - 76, y], [ix + 96, y], [ix + 96, y + 32], [ix - 76, y + 32]],
        { stroke: on ? C.hot : `${C.grid}aa`, lw: on ? 2.4 : 1.4, fill: on ? 'rgba(245,101,101,0.18)' : 'rgba(45,55,72,0.5)' });
      text(f, `${on ? '⚠ ' : ''}${String(name)}`, ix - 66, y + 21, { color: on ? C.hot : C.dim, font: '11px sans-serif' });
    });
    // 附着层提示
    text(f, '附着层（Cr/Ti）是常用保险——先把界面焊住', ix - 76, 300, { color: C.green, font: '11px sans-serif' });
    text(f, '热失配是薄膜应力的头号来源——降温时两边收缩不一致', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '本征应力来自生长缺陷与晶格失配——热应力来自温度历程',
      '集成电路平坦化与面板镀膜每天都在做应力收支表',
      '压/拉应力的调控直接决定器件寿命与柔性屏的弯折性能',
    ]);
    heading(f, '薄膜应力：绷着的皮怎么不崩');
  },
});
registerViz(thinFilmStress);

/** 纳米颗粒与等离激元。 */
const surfacePlasmon = defineViz({
  slug: 'surface-plasmon', title: '纳米颗粒与等离激元', animated: true,
  params: { size: { type: 'range', min: 10, max: 120, default: 40, step: 5, label: '颗粒直径 (nm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'size', 40);
    clear(f);
    // 金纳米颗粒 + 电子集体振荡
    const cx = w * 0.3, cy = h * 0.46, R = 30 + d * 0.5;
    const drive = Math.sin(f.t * 4);
    circle(f, cx, cy, R, { stroke: C.yellow, lw: 3.4, fill: 'rgba(236,201,75,0.35)' });
    // 电子云偏移
    const shift = drive * R * 0.28;
    const cloud: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      cloud.push([cx + shift + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8]);
    }
    poly(f, cloud, { stroke: `rgba(66,153,225,${0.5 + 0.4 * Math.abs(drive)})`, lw: 3.4, fill: `rgba(66,153,225,${0.18 + 0.14 * Math.abs(drive)})` });
    text(f, '传导电子云相对晶格振荡', cx - 96, cy - R - 44, { color: C.cool, font: '12px sans-serif' });
    // 入射光
    for (let k = 0; k < 3; k++) {
      const y = cy - 30 + k * 30;
      const wave: [number, number][] = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        wave.push([30 + t * (cx - R - 44), y + Math.sin(t * 22 - f.t * 8 + k) * 9]);
      }
      poly(f, wave, { stroke: `rgba(245,101,101,0.7)`, lw: 2.4 });
    }
    text(f, '入射光', 34, cy - 62, { color: C.hot, font: '11px sans-serif' });
    // 散射/吸收（共振时最强）
    const res = 1 / (1 + Math.pow((d - 55) / 45, 2));
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.5;
      const len = 60 + res * 80 * (0.7 + 0.3 * Math.sin(f.t * 5 + k));
      seg(f, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len),
        `rgba(236,201,75,${0.3 + res * 0.6})`, 3);
    }
    // 消光谱（右）
    const v = view(f, { xMin: 400, xMax: 900, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    const peak = 520 + d * 0.55;
    const spec: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const lam = 400 + (i / 300) * 500;
      const y = Math.exp(-Math.pow((lam - peak) / (55 + d * 0.4), 2)) * (0.5 + d / 200);
      spec.push([v.sx(lam), v.sy(Math.min(1.05, y))]);
    }
    poly(f, spec, { stroke: C.warm, lw: 3.4 });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(peak), v.sy(Math.min(1.05, (0.5 + d / 200))), 8, `rgba(72,187,120,${pulse})`);
    text(f, `LSPR 峰 ≈ ${peak.toFixed(0)} nm：${d < 30 ? '小颗粒偏蓝紫、散射弱' : d > 80 ? '大颗粒红移明显、散射主导' : '红宝石红的经典胶体金'}`,
      56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '波长 →（nm）', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '消光（吸收+散射）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前 d=${d} nm——中世纪金玻璃的颜色，今天叫 LSPR 传感`, 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '局域表面等离激元：电子集体振荡与光共振——场强在颗粒表面暴涨',
      'SERS 把拉曼信号放大百万倍——单分子检测因此可行',
      '尺寸与形状决定峰位——纳米金从红到紫随心调',
    ]);
    heading(f, '等离激元：金玻璃里的电子秋千');
  },
});
registerViz(surfacePlasmon);

/** 表面催化与吸附。 */
const surfaceCatalysis = defineViz({
  slug: 'surface-catalysis', title: '表面催化与吸附', animated: true,
  params: { strength: { type: 'range', min: 10, max: 100, default: 55, step: 5, label: '吸附强度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'strength', 55);
    clear(f);
    // 表面与吸附位
    const sy = h * 0.6;
    poly(f, [[60, sy], [w - 60, sy], [w - 60, sy + 44], [60, sy + 44]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.4)' });
    text(f, '催化剂表面（活性位）', 64, sy + 68, { color: C.dim, font: '11px sans-serif' });
    for (let i = 0; i < 9; i++) dot(f, 100 + i * ((w - 220) / 8), sy, 7, C.warm);
    // 分子吸附-解吸循环
    const rand = rng(17);
    for (let i = 0; i < 7; i++) {
      const base = 90 + i * ((w - 200) / 7);
      const phase = ((f.t * 0.8 + i * 0.24) % 1);
      const adsorbed = phase > 0.25 && phase < 0.75;
      const y = adsorbed ? sy - 26 : sy - 26 - Math.sin((adsorbed ? 1 : phase) * Math.PI) * 90;
      const bondOn = adsorbed;
      circle(f, base, y, 11, { stroke: adsorbed ? C.green : C.cool, lw: 2.4, fill: adsorbed ? 'rgba(72,187,120,0.5)' : 'rgba(66,153,225,0.4)' });
      circle(f, base + 20, y - 4, 11, { stroke: adsorbed ? C.green : C.hot, lw: 2.4, fill: adsorbed ? 'rgba(72,187,120,0.5)' : 'rgba(245,101,101,0.4)' });
      if (bondOn && s > 30) {
        seg(f, base + 4, y + 8, base + 4, sy - 6, `${C.yellow}aa`, 2.2, );
        seg(f, base + 16, y + 8, base + 16, sy - 6, `${C.yellow}aa`, 2.2, );
      }
      if (bondOn && s > 65) {
        // 键被削弱（表面活化）
        seg(f, base + 6, y - 4, base + 14, y - 4, `${C.hot}cc`, 3);
      }
    }
    text(f, s < 35 ? '吸附太弱：分子没按住就跑了——反应不来' : s > 80 ? '吸附太强：产物赖着不走——表面被占死'
      : '不强不弱：按住再松手——火山曲线的顶点',
      30, 44, { color: s < 35 ? C.cool : s > 80 ? C.hot : C.green, font: '13px sans-serif' });
    // 火山曲线（右）
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    const vol: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const x = i / 200;
      const y = Math.exp(-Math.pow((x - 0.55) * 3.4, 2)) * 1.0;
      vol.push([v.sx(x), v.sy(y)]);
    }
    poly(f, vol, { stroke: C.warm, lw: 3.4 });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    const xNow = s / 100;
    const yNow = Math.exp(-Math.pow((xNow - 0.55) * 3.4, 2));
    dot(f, v.sx(xNow), v.sy(yNow), 9, `rgba(72,187,120,${pulse})`);
    text(f, '火山曲线：活性 vs 吸附能', 56, 44, { color: C.warm, font: '12px sans-serif' });
    text(f, '吸附强度 →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '反应速率', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前 ${s}%：催化不是"越强越好"——最佳在山顶`, 30, h - 66, { color: C.cyan, font: '12px sans-serif' });
    footnotes(f, [
      '哈伯-博施合成氨靠铁催化剂撑起全球粮食——工业催化之王',
      'Langmuir 吸附把表面反应变成可计算的动力学',
      '汽车三元催化与燃料电池铂催化剂——空气与能源的净化器',
    ]);
    heading(f, '表面催化：按住再松手的艺术');
  },
});
registerViz(surfaceCatalysis);

/** 腐蚀与钝化。 */
const corrosionElectrochemistry = defineViz({
  slug: 'corrosion-electrochemistry', title: '腐蚀与钝化', animated: true,
  params: { protect: { type: 'select', options: ['无防护', '钝化膜（不锈钢）', '牺牲阳极保护'], default: '无防护', label: '状态' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['protect'] ?? '');
    const passive = mode.includes('钝化'), cathodic = mode.includes('牺牲');
    clear(f);
    // 金属板与电解质
    const my = h * 0.56;
    poly(f, [[70, my], [w - 70, my], [w - 70, my + 54], [70, my + 54]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.5)' });
    poly(f, [[70, my - 84], [w - 70, my - 84], [w - 70, my], [70, my]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.16)' });
    text(f, '电解质（海水/潮湿膜）', 76, my - 94, { color: C.cool, font: '11px sans-serif' });
    text(f, '金属基体', 76, my + 36, { color: C.dim, font: '11px sans-serif' });
    // 钝化膜
    if (passive) {
      poly(f, [[70, my - 8], [w - 70, my - 8], [w - 70, my], [70, my]],
        { stroke: 'transparent', fill: 'rgba(72,187,120,0.65)' });
      text(f, 'Cr₂O₃ 钝化膜（几纳米厚的防线）', w * 0.4, my - 20, { color: C.green, font: '11px sans-serif' });
    }
    // 腐蚀电池（阳极溶解 + 阴极还原）
    const anodeX = passive ? w * 0.82 : w * 0.38;
    if (!passive) {
      // 铁溶解（动画掉原子）
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
      text(f, '阳极：Fe → Fe²⁺ + 2e⁻', anodeX - 74, my - 116, { color: C.hot, font: '12px sans-serif' });
      for (let i = 0; i < 3; i++) {
        const t = ((f.t * 0.7 + i * 0.33) % 1);
        dot(f, anodeX + (i - 1) * 16, my - t * 76, 6.4, `rgba(245,101,101,${1 - t})`);
      }
      // 锈斑
      for (let i = 0; i < 5; i++) {
        const rr = rng(i + 40);
        circle(f, anodeX - 40 + rr() * 80, my + 6 + rr() * 40, 6 + rr() * 8,
          { fill: `rgba(140,80,40,${0.5 + 0.3 * Math.sin(f.t * 2 + i)})` });
      }
      text(f, '锈（Fe₂O₃·nH₂O）', anodeX - 44, my + 78, { color: '#a0522d', font: '11px sans-serif' });
      // 阴极（氧还原）
      const cathX = w * 0.66;
      text(f, '阴极：O₂ + 2H₂O + 4e⁻ → 4OH⁻', cathX - 110, my - 116, { color: C.cool, font: '12px sans-serif' });
      for (let i = 0; i < 4; i++) {
        const t = ((f.t * 0.6 + i * 0.25) % 1);
        dot(f, cathX + (i - 1.5) * 14, my - 84 + t * 70, 5.4, `rgba(66,153,225,${1 - t})`);
      }
      // 电子流
      const et = ((f.t * 2) % 1);
      dot(f, anodeX + (cathX - anodeX) * et, my + 26, 6, `rgba(236,201,75,0.95)`);
      text(f, '电子沿金属内部流回——腐蚀电池闭合', anodeX, my + 96, { color: C.yellow, font: '11px sans-serif' });
      void pulse;
    } else if (cathodic) {
      // 牺牲阳极（锌块）
      poly(f, [[w * 0.7, my - 10], [w * 0.82, my - 10], [w * 0.82, my + 44], [w * 0.7, my + 44]],
        { stroke: C.green, lw: 3, fill: 'rgba(72,187,120,0.5)' });
      text(f, '牺牲阳极（Zn）', w * 0.7 - 6, my + 66, { color: C.green, font: '11px sans-serif' });
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
      text(f, 'Zn → Zn²⁺ + 2e⁻：自己先烂，保住基体', w * 0.2, my - 116, { color: C.green, font: '12px sans-serif' });
      for (let i = 0; i < 4; i++) {
        const t = ((f.t * 0.5 + i * 0.25) % 1);
        dot(f, w * 0.76 + (i - 1.5) * 12, my - 14 - t * 60, 5.4, `rgba(72,187,120,${1 - t})`);
      }
      text(f, '船体与管道的常规保命术', w * 0.2, my + 96, { color: C.dim, font: '11px sans-serif' });
    } else {
      text(f, '阳极：Fe → Fe²⁺ + 2e⁻（没有任何阻挡——锈蚀进行中）', 76, my - 116, { color: C.hot, font: '12px sans-serif' });
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
      for (let i = 0; i < 8; i++) {
        const rr = rng(i + 10);
        circle(f, 120 + rr() * (w - 280), my - 8 + rr() * 56, 7 + rr() * 9,
          { fill: `rgba(140,80,40,${0.45 + 0.3 * pulse * rr()})` });
      }
    }
    text(f, `当前状态：${passive ? '钝化——不锈钢靠铬氧膜自守' : cathodic ? '牺牲阳极——让更活泼的金属替你挨刀' : '裸金属——热力学注定要回矿石'}`,
      30, 44, { color: passive ? C.green : cathodic ? C.cool : C.hot, font: '13px sans-serif' });
    text(f, '腐蚀是原电池：阳极溶解、阴极还原、电解质与电子回路缺一不可', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '生锈=金属自发回归矿石态——热力学注定，动力学可以拖慢',
      '氯离子击穿钝化膜——不锈钢在海水里也并非刀枪不入',
      '涂层、牺牲阳极与缓蚀剂构成防腐三件套——跨海大桥的持久战',
    ]);
    heading(f, '腐蚀与钝化：与氧化的持久战');
  },
});
registerViz(corrosionElectrochemistry);

/** 摩擦磨损与润滑。 */
const stribeckLubrication = defineViz({
  slug: 'striebeck-lubrication', title: '摩擦磨损与润滑', animated: true,
  params: { spd: { type: 'range', min: 1, max: 100, default: 30, step: 1, label: '速度 (相对)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const spd = num(params, 'spd', 30);
    clear(f);
    // Stribeck 曲线（x 为对数 Stribeck 参数）
    const v = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const tri: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const x = (i / 300) * 3;
      // 边界润滑高 → 混合段谷 → 全膜段微升
      let y: number;
      if (x < 0.9) y = 0.85 - x * 0.45;
      else if (x < 1.7) y = 0.44 - (x - 0.9) * 0.36;
      else y = 0.15 + (x - 1.7) * 0.05;
      tri.push([v.sx(x), v.sy(y)]);
    }
    poly(f, tri, { stroke: C.accent, lw: 3.4 });
    // 三段标注
    const zones: [number, string, string][] = [
      [0.4, '边界润滑', C.hot],
      [1.3, '混合润滑', C.warm],
      [2.5, '全膜润滑', C.green],
    ];
    for (const [x, name, color] of zones) {
      text(f, name, v.sx(x), v.sy(1.03), { color, font: '12px sans-serif' });
      seg(f, v.sx(x), v.sy(0), v.sx(x), v.sy(1.06), `${color}55`, 1.4, );
    }
    // 当前点
    const xNow = Math.log10(Math.max(1, spd)) * 1.5;
    const yNow = xNow < 0.9 ? 0.85 - xNow * 0.45 : xNow < 1.7 ? 0.44 - (xNow - 0.9) * 0.36 : 0.15 + (xNow - 1.7) * 0.05;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(xNow), v.sy(yNow), 10, `rgba(72,187,120,${pulse})`);
    // 油膜厚度示意（左上）
    const bx = 70, by = 74;
    const gap = Math.max(3, yNow * 26);
    poly(f, [[bx, by], [bx + 230, by], [bx + 230, by + 26], [bx, by + 26]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.5)' });
    poly(f, [[bx, by + 26 + gap], [bx + 230, by + 26 + gap], [bx + 230, by + 56 + gap], [bx, by + 56 + gap]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.5)' });
    poly(f, [[bx, by + 26], [bx + 230, by + 26], [bx + 230, by + 26 + gap], [bx, by + 26 + gap]],
      { stroke: 'transparent', fill: `rgba(236,201,75,${0.3 + gap / 40})` });
    for (let i = 0; i < 6; i++) {
      const x = bx + 20 + i * 36 + ((f.t * 40) % 36);
      if (x < bx + 220) dot(f, x, by + 26 + gap / 2, 3.4, `rgba(255,250,200,0.8)`);
    }
    text(f, `油膜厚 ${gap.toFixed(0)} px：${gap < 8 ? '微凸体直接接触（磨损重）' : gap < 16 ? '半干半油（混合）' : '完全被油膜托起（几乎无磨损）'}`,
      bx, by + 56 + gap + 24, { color: gap < 8 ? C.hot : gap < 16 ? C.warm : C.green, font: '11px sans-serif' });
    text(f, `速度 ${spd}：摩擦系数 μ ≈ ${(yNow * 0.6).toFixed(3)}`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '润滑参数（ηN/P）→', w - 160, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '摩擦系数 μ', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '谷底是设计的甜蜜点：再快只多耗油、再慢就要磨损失手', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Stribeck 曲线把润滑分成三段——边界、混合、全膜各有各的对策',
      '添加剂在边界段形成化学保护膜——机油的科技含量在此',
      '从轴承到人工关节，摩擦学决定所有运动部件的寿命',
    ]);
    heading(f, 'Stribeck 曲线：一滴油的三个世界');
  },
});
registerViz(stribeckLubrication);

/** 载流子迁移率与散射。 */
const carrierMobility = defineViz({
  slug: 'carrier-mobility', title: '载流子迁移率与散射', animated: true,
  params: { doping: { type: 'range', min: 15, max: 20, default: 17, step: 0.5, label: '掺杂浓度 (log cm⁻³)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const logN = num(params, 'doping', 17);
    clear(f);
    // 迁移率 vs 温度（双机制）
    const v = view(f, { xMin: 1.3, xMax: 3.6, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const impurity = Math.max(0.1, 1 - (logN - 15) / 8); // 掺杂越高杂质散射越强
    const mu: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const logT = 1.3 + (i / 300) * 2.3;
      const T = Math.pow(10, logT);
      const phonon = Math.pow(300 / T, 1.5);          // 声学声子散射（高温下降）
      const ionized = impurity * Math.pow(T / 300, 1.5) * 0.5; // 电离杂质散射（低温弱）
      const total = 1 / (1 / phonon * 0 + 1 / (phonon * 3000) + 1 / (Math.max(0.02, ionized) * 3000));
      mu.push([v.sx(logT), v.sy(Math.min(1.05, total))]);
    }
    poly(f, mu, { stroke: C.accent, lw: 3.4 });
    // 两支分机制（虚线）
    const ph: [number, number][] = [], io: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const logT = 1.3 + (i / 300) * 2.3;
      const T = Math.pow(10, logT);
      ph.push([v.sx(logT), v.sy(Math.min(1.05, Math.pow(300 / T, 1.5) * (300 / T > 1 ? 0.55 : 0.95) * (T < 400 ? 1 : 1)))]);
      io.push([v.sx(logT), v.sy(Math.min(1.05, impurity * Math.pow(T / 300, 1.5) * 0.55))]);
    }
    poly(f, ph, { stroke: `${C.hot}aa`, lw: 2, dash: [6, 5] });
    poly(f, io, { stroke: `${C.cool}aa`, lw: 2, dash: [6, 5] });
    text(f, '红虚=声子散射（高温主导）', v.sx(2.7), v.sy(0.94), { color: C.hot, font: '11px sans-serif' });
    text(f, '蓝虚=电离杂质散射（低温主导）', v.sx(1.36), v.sy(0.5), { color: C.cool, font: '11px sans-serif' });
    // 当前温度点
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    const logTn = 2.48 + Math.sin(f.t * 0.8) * 0.4;
    const Tn = Math.pow(10, logTn);
    const phonon = Math.pow(300 / Tn, 1.5);
    const ionized = Math.max(0.1, 1 - (logN - 15) / 8) * Math.pow(Tn / 300, 1.5) * 0.5;
    const total = 1 / (1 / (phonon * 3000) + 1 / (Math.max(0.02, ionized) * 3000));
    dot(f, v.sx(logTn), v.sy(Math.min(1.05, total)), 9, `rgba(72,187,120,${pulse})`);
    text(f, `掺杂 ${logN.toFixed(1)}：${impurity > 0.5 ? '杂质多——低温段被电离散射压住' : '轻掺杂——接近本征声子极限'}`,
      56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '温度 →（log K）', w - 150, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '迁移率 μ（归一）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, 'μ = eτ/m*：散射越频繁寿命 τ 越短——迁移率就是电子的平均自由时间', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '低温爬升、高温下坠——迁移率的驼峰是两种散射轮流坐庄',
      '应变硅与高迁移率沟道改写有效质量——每代工艺都有新招',
      '化合物半导体高迁移率让 5G 射频与功率器件换道超车',
    ]);
    heading(f, '迁移率：芯片里的交通指标');
  },
});
registerViz(carrierMobility);

/** 压电与铁电材料。 */
const piezoelectricFerrcelectric = defineViz({
  slug: 'piezoelectric-ferrcelectric', title: '压电与铁电材料', animated: true,
  params: { mode: { type: 'select', options: ['压电效应（力→电）', '逆压电（电→力）', '电滞回线'], default: '压电效应（力→电）', label: '模式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['mode'] ?? '');
    clear(f);
    if (mode.includes('电滞') || mode.includes('回线')) {
      // 电滞回线
      const v = view(f, { xMin: -1.4, xMax: 1.4, yMin: -1.2, yMax: 1.2, inset: 46, insetBottom: 96 });
      grid(f, v, { divisions: 7, ticks: true });
      const loop: [number, number][] = [];
      const phase = (f.t * 0.7) % (Math.PI * 2);
      for (let i = 0; i <= 300; i++) {
        const E = -1.4 + (i / 300) * 2.8;
        const Es = Math.max(-1.1, Math.min(1.1, Math.tanh((E - 0.25 * Math.sin(phase)) * 2.4)));
        loop.push([v.sx(E), v.sy(Es)]);
      }
      poly(f, loop, { stroke: C.accent, lw: 3.4 });
      // 剩余极化与矫顽场
      seg(f, v.sx(0), v.sy(-1.15), v.sx(0), v.sy(1.15), `${C.dim}88`, 1.4, );
      seg(f, v.sx(-1.35), v.sy(0), v.sx(1.35), v.sy(0), `${C.dim}88`, 1.4, );
      dot(f, v.sx(0), v.sy(Math.tanh(0.25 * Math.sin(phase) * -2.4 * 0 + 0.9)), 7, C.warm);
      text(f, 'P_r 剩余极化（铁电存储的 1 和 0）', v.sx(0.06), v.sy(1.05), { color: C.warm, font: '11px sans-serif' });
      text(f, 'E_c 矫顽场（翻转需要的电场）', v.sx(-1.3), v.sy(-1.1), { color: C.cool, font: '11px sans-serif' });
      text(f, '外加电场 E →', w - 140, h - 86, { color: C.dim, font: '11px sans-serif' });
      text(f, '极化 P', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
      text(f, '迟滞回线是铁电体的签名——双稳极化可被电场反复翻转', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      const direct = mode.includes('力');
      const squeeze = Math.sin(f.t * 3);
      // 压电陶瓷片
      const cx = w * 0.36, cy = h * 0.5;
      const thick = 60 + (direct ? squeeze * 10 : Math.sin(f.t * 3) * 8);
      poly(f, [[cx - 130, cy - thick], [cx + 130, cy - thick], [cx + 130, cy + thick], [cx - 130, cy + thick]],
        { stroke: C.dim, lw: 3, fill: 'rgba(146,84,222,0.3)' });
      // 电极
      seg(f, cx - 130, cy - thick, cx + 130, cy - thick, C.cool, 6);
      seg(f, cx - 130, cy + thick, cx + 130, cy + thick, C.cool, 6);
      // 偶极子
      for (let r = -1; r <= 1; r++) {
        for (let c = -3; c <= 3; c++) {
          const x = cx + c * 34, y = cy + r * 26;
          const pol = direct ? squeeze * 6 : 0;
          vec(f, x, y + 9 - pol, x, y - 9 - pol, `rgba(236,201,75,${0.6 + 0.3 * Math.abs(squeeze)})`, 2.4, 5);
        }
      }
      if (direct) {
        // 力箭头 → 电荷
        vec(f, cx, cy - thick - 54, cx, cy - thick - 10, C.warm, 4);
        vec(f, cx, cy + thick + 54, cx, cy + thick + 10, C.warm, 4);
        const q = 0.5 + 0.5 * squeeze;
        text(f, `+Q × ${q.toFixed(2)}`, cx + 146, cy - thick, { color: C.hot, font: '14px sans-serif' });
        text(f, `−Q × ${q.toFixed(2)}`, cx + 146, cy + thick, { color: C.cool, font: '14px sans-serif' });
        text(f, '压缩 → 极化改变 → 表面束缚电荷（正压电）', cx - 130, cy - thick - 66, { color: C.cyan, font: '13px sans-serif' });
      } else {
        // 电压 → 形变
        const vv = 0.5 + 0.5 * Math.sin(f.t * 3);
        text(f, `V × ${vv.toFixed(2)} → 逆压电：晶片厚度随电压伸缩`, cx - 130, cy - thick - 66, { color: C.cyan, font: '13px sans-serif' });
        text(f, `d₃₃ ≈ 300 pm/V → 形变 ~${(vv * 0.1).toFixed(3)} μm`, cx - 130, cy + thick + 40, { color: C.warm, font: '12px sans-serif' });
      }
      // 换能应用
      const ax = w * 0.76;
      const apps = ['超声探头', '蜂鸣器', '喷墨打印头', '压电点火'];
      apps.forEach((a, i) => {
        const y = 110 + i * 60;
        const on = (f.t * 0.6) % 1 > i / 4;
        poly(f, [[ax - 70, y], [ax + 84, y], [ax + 84, y + 40], [ax - 70, y + 40]],
          { stroke: on ? C.green : `${C.grid}aa`, lw: on ? 2.4 : 1.4, fill: on ? 'rgba(72,187,120,0.18)' : 'rgba(45,55,72,0.5)' });
        text(f, a, ax - 56, y + 25, { color: on ? C.green : C.dim, font: '13px sans-serif' });
      });
      text(f, direct ? '力↔电的双向兑换——无中心对称结构是前提' : '电↔力的双向兑换——逆压电是主动控制的入口',
        30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '居里点以上铁电性消失——极化处理才有宏观压电性', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    }
    footnotes(f, [
      '居里兄弟 1880 年发现压电——一百年后 PZT 铺满换能器市场',
      '电滞回线的双稳极化是铁电存储的物理基础',
      '多铁材料把电、磁、力耦合——功能材料的活跃前沿',
    ]);
    heading(f, '压电与铁电：力与电的双向兑换');
  },
});
registerViz(piezoelectricFerrcelectric);

/** 介电老化与绝缘击穿。 */
const dielectricAging = defineViz({
  slug: 'dielectric-aging', title: '介电老化与绝缘击穿', animated: true,
  params: { field: { type: 'range', min: 10, max: 100, default: 60, step: 5, label: '电场强度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const E = num(params, 'field', 60);
    clear(f);
    const breakdown = E > 85;
    // 绝缘介质与电树枝生长
    const bx = 70, by = h * 0.26, bw = w * 0.5, bh = h * 0.5;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.25)' });
    // 电极
    poly(f, [[bx, by - 14], [bx + bw, by - 14], [bx + bw, by], [bx, by]],
      { stroke: C.hot, lw: 4, fill: 'rgba(245,101,101,0.4)' });
    poly(f, [[bx, by + bh], [bx + bw, by + bh], [bx + bw, by + bh + 14], [bx, by + bh + 14]],
      { stroke: C.cool, lw: 4, fill: 'rgba(66,153,225,0.4)' });
    text(f, '高压电极', bx + bw + 10, by - 4, { color: C.hot, font: '11px sans-serif' });
    text(f, '接地电极', bx + bw + 10, by + bh + 6, { color: C.cool, font: '11px sans-serif' });
    // 电树枝（分形生长）
    const grow = breakdown ? 1 : (E / 100) * ((f.t * 0.35) % 1.4);
    const drawBranch = (x: number, y: number, ang: number, len: number, depth: number, t0: number) => {
      if (depth > 5 || t0 > grow) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      seg(f, x, y, x2, y2, `rgba(146,84,222,${0.5 + depth * 0.08})`, Math.max(1, 4 - depth * 0.6));
      const t1 = t0 + 0.16;
      if (t1 <= grow) {
        drawBranch(x2, y2, ang - 0.42 - Math.random() * 0.2, len * 0.74, depth + 1, t1);
        drawBranch(x2, y2, ang + 0.42 + Math.random() * 0.2, len * 0.74, depth + 1, t1);
      }
    };
    for (let k = -1; k <= 1; k++) {
      drawBranch(bx + bw / 2 + k * 40, by + 6, Math.PI / 2 + k * 0.3, 52, 0, 0);
    }
    if (breakdown) {
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 8);
      seg(f, bx + bw / 2, by, bx + bw / 2, by + bh, `rgba(255,250,200,${pulse})`, 4);
      text(f, '贯穿击穿！绝缘失效', bx + bw / 2 - 66, by + bh / 2, { color: '#fffbeb', font: '14px sans-serif' });
    }
    // 漏电流指示
    const leakage = Math.pow(E / 100, 3.2);
    text(f, `漏电流 ∝ E³：当前相对值 ${(leakage * 100).toFixed(1)}%${breakdown ? '——击穿' : ''}`,
      30, 44, { color: breakdown ? C.hot : C.cyan, font: '13px sans-serif' });
    // 老化寿命卡
    const bx2 = w * 0.64;
    text(f, '热-电老化（指数寿命）', bx2, h * 0.3 - 20, { color: C.warm, font: '13px sans-serif' });
    const lt: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      lt.push([bx2 + t * 240, h * 0.3 + 120 - Math.exp(-t * (2 + leakage * 5)) * 100]);
    }
    poly(f, lt, { stroke: C.warm, lw: 3.4 });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    const lx = bx2 + (E / 100) * 240;
    dot(f, lx, h * 0.3 + 120 - Math.exp(-(E / 100) * (2 + leakage * 5)) * 100, 8, `rgba(72,187,120,${pulse})`);
    text(f, '电场 ↑ → 寿命按指数缩水', bx2, h * 0.3 + 156, { color: C.dim, font: '11px sans-serif' });
    text(f, '温度每升 8-10℃，寿命约减半', bx2, h * 0.3 + 182, { color: C.cool, font: '11px sans-serif' });
    text(f, `电场 ${E}%：${breakdown ? '已越临界——电树枝贯穿' : E > 70 ? '树枝潜伏生长中——绝缘进入老年' : '场强可控——老化缓慢'}`,
      30, h - 66, { color: breakdown ? C.hot : E > 70 ? C.warm : C.green, font: '12px sans-serif' });
    footnotes(f, [
      '击穿不是瞬间发生的——电树枝在材料里悄悄生长数年之久',
      '水分、杂质与机械应力加速老化——环境比场强更会磨时间',
      '电缆绝缘与变压器油的老化监测是电网运维的核心项目',
    ]);
    heading(f, '介电老化：电树枝的沉默生长');
  },
});
registerViz(dielectricAging);

/** 高熵合金。 */
const highEntropyAlloy = defineViz({
  slug: 'high-entropy-alloy', title: '高熵合金', animated: true,
  params: { elements: { type: 'range', min: 1, max: 5, default: 5, step: 1, label: '主元数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'elements', 5);
    clear(f);
    const colors = [C.cool, C.warm, C.green, C.hot, '#9254de'];
    const names = ['Cr', 'Fe', 'Co', 'Ni', 'Mn'];
    // 左：构型熵随主元数变化
    const v = view(f, { xMin: 1, xMax: 5, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 4, ticks: true });
    const sPts: [number, number][] = [];
    for (let i = 1; i <= 5; i++) {
      const S = Math.log(i) / Math.log(5); // 归一化 R ln n
      sPts.push([v.sx(i), v.sy(S)]);
    }
    poly(f, sPts, { stroke: C.accent, lw: 3.4 });
    const Sn = Math.log(n) / Math.log(5);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(n), v.sy(Sn), 9, `rgba(72,187,120,${pulse})`);
    seg(f, v.sx(1), v.sy(0.95), v.sx(5), v.sy(0.95), `${C.warm}99`, 1.6, );
    text(f, 'ΔS ≥ 1.5R：高熵合金门槛（n≥5 等比）', v.sx(1.1), v.sy(1.05), { color: C.warm, font: '11px sans-serif' });
    text(f, `S = k·ln${n} = ${(Math.log(n)).toFixed(2)} k（相对 ${(Sn * 100).toFixed(0)}% 最大值）`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '主元数 →', w * 0.46, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '构型熵（归一）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    // 右：晶格（等比固溶 vs 金属间化合物）
    const cx = w * 0.74, cy = h * 0.46, cell = 44;
    const single = n >= 4;
    for (let r = -3; r <= 3; r++) {
      for (let c = -3; c <= 3; c++) {
        const x = cx + c * cell + (r % 2 ? cell / 2 : 0);
        const y = cy + r * cell * 0.86;
        if (x < w * 0.56 || x > w - 40 || y < 80 || y > h - 140) continue;
        // 单相：原子随机占位；多主元低熵：出现有序化
        const pick = single ? (Math.floor(Math.abs(Math.sin(r * 7 + c * 13)) * n) % n)
          : (r + c) % n;
        circle(f, x, y, 15, { stroke: colors[pick], lw: 2.4, fill: `${colors[pick]}66` });
        if (!single && (r + c) % n === 0) {
          // 有序相倾向的键
          if (c < 3) seg(f, x, y, x + cell, y, `${C.dim}66`, 1.4);
        }
      }
    }
    text(f, single ? '单相固溶：五种原子随机站位（高熵稳定）' : `${n} 主元：熵不足以压平混合焓——倾向有序/第二相`,
      w * 0.56, h - 108, { color: single ? C.green : C.warm, font: '11px sans-serif' });
    // 性能条
    const by = h - 96;
    const props: [string, number][] = [
      ['强度', 0.72 + n * 0.03],
      ['热稳定性', 0.6 + n * 0.05],
      ['耐腐蚀', 0.66 + n * 0.04],
    ];
    props.forEach(([name, val], i) => {
      const x = 60 + i * 170;
      text(f, name, x, by - 4, { color: C.dim, font: '11px sans-serif' });
      poly(f, [[x, by + 6], [x + Math.min(1, val) * 140, by + 6], [x + Math.min(1, val) * 140, by + 26], [x, by + 26]],
        { stroke: 'transparent', fill: `rgba(146,84,222,${0.5 + n * 0.07})` });
    });
    text(f, `${n} 主元等比混熔：严重晶格畸变 + 缓慢扩散 + 鸡尾酒效应`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '2004 年 Yeh 与 Cantor 独立提出——百年合金设计范式被改写',
      '高熵把相分离压下去：ΔG = ΔH − TΔS，熵项赢了才成单相',
      '低温高韧、耐辐照与催化性能——核电与能源材料的候选池',
    ]);
    heading(f, '高熵合金：五种金属的鸡尾酒');
  },
});
registerViz(highEntropyAlloy);

/** 材料基因组与高通量筛选。 */
const materialsGenome = defineViz({
  slug: 'materials-genome', title: '材料基因组与高通量筛选', animated: true,
  params: { screen: { type: 'range', min: 0, max: 100, default: 45, step: 5, label: '筛选进度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prog = num(params, 'screen', 45);
    clear(f);
    // 候选成分网格（计算筛选）
    const cols = 14, rows = 7;
    const x0 = 60, y0 = 96, cw = (w - 130) / cols, ch = 46;
    const rand = rng(2011);
    const hits: [number, number][] = [];
    for (let i = 0; i < cols * rows; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const x = x0 + c * cw, y = y0 + r * ch;
      const score = rand();
      const evaluated = i < (prog / 100) * cols * rows;
      const hit = evaluated && score > 0.9;
      if (hit) hits.push([x + cw / 2, y + ch / 2]);
      const on = evaluated && (f.t * 0.5 + i * 0.01) % 1 < 0.9;
      poly(f, [[x + 2, y + 2], [x + cw - 4, y + 2], [x + cw - 4, y + ch - 4], [x + 2, y + ch - 4]],
        {
          stroke: hit ? C.green : `${C.grid}aa`, lw: hit ? 2.4 : 1.2,
          fill: hit ? 'rgba(72,187,120,0.35)' : evaluated ? (on ? 'rgba(66,153,225,0.22)' : 'rgba(45,55,72,0.5)') : 'rgba(45,55,72,0.28)',
        });
      if (evaluated && !hit) text(f, '·', x + cw / 2 - 2, y + ch / 2 + 6, { color: `${C.dim}aa`, font: '14px sans-serif' });
      if (hit) text(f, '★', x + cw / 2 - 7, y + ch / 2 + 6, { color: C.green, font: '14px sans-serif' });
      void score;
    }
    // 扫描线
    const scanX = x0 + (prog / 100) * (w - 130);
    seg(f, scanX, y0 - 12, scanX, y0 + rows * ch + 6, `rgba(236,201,75,${0.5 + 0.4 * Math.sin(f.t * 4)})`, 3);
    text(f, 'DFT 高通量计算逐个评估候选成分', x0, y0 - 24, { color: C.cyan, font: '13px sans-serif' });
    // 流程链
    const fy = y0 + rows * ch + 56;
    const chain = ['成分生成', 'DFT 计算', '相图预测', '性能筛选', '实验验证'];
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * ((w - 140) / 5);
      const active = prog > i * 19;
      poly(f, [[x, fy], [x + 108, fy], [x + 108, fy + 40], [x, fy + 40]],
        { stroke: active ? C.green : `${C.grid}aa`, lw: active ? 2.4 : 1.4, fill: active ? 'rgba(72,187,120,0.18)' : 'rgba(45,55,72,0.5)' });
      text(f, chain[i], x + 14, fy + 25, { color: active ? C.green : C.dim, font: '13px sans-serif' });
      if (i < 4) text(f, '→', x + 116, fy + 25, { color: C.warm, font: '15px sans-serif' });
    }
    const hitCount = hits.length;
    text(f, `筛选进度 ${prog}%：已评估 ${Math.round((prog / 100) * cols * rows)} 个候选，命中 ${hitCount} 个★`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '传统试错要十年走完的路，计算先行把它压到两三年——但实验验证仍是最后裁判',
      30, h - 44, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '材料基因组计划（2011, 美国）把数据驱动研发写进国家战略',
      'CALPHAD 相图计算 + DFT 性能预测——虚拟材料库先建起来',
      '无钴高镍正极等已完成计算-验证闭环——流程被证明可行',
    ]);
    heading(f, '材料基因组：先算后做的加速器');
  },
});
registerViz(materialsGenome);
