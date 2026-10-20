import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 闵可夫斯基时空。 */
const minkowskiSpacetime = defineViz({
  slug: 'minkowski-spacetime', title: '闵可夫斯基时空', animated: true,
  params: {
    kind: { type: 'select', options: ['等时面', '双曲时距'], default: '双曲时距', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hyper = String((params as Record<string, unknown>)['kind'] ?? '').includes('双曲');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    seg(f, 40, cy, w - 40, cy, C.grid, 1.4);
    seg(f, cx, h - 40, cx, 40, C.grid, 1.4);
    text(f, 'x', w - 60, cy - 10, { color: C.dim, font: '13px sans-serif' });
    text(f, 'ct', cx + 10, 50, { color: C.dim, font: '13px sans-serif' });
    // 光锥
    seg(f, cx, cy, w - 70, cy - (w - 70 - cx), `${C.warm}aa`, 1.6);
    seg(f, cx, cy, 70, cy + (cx - 70), `${C.warm}aa`, 1.6);
    seg(f, cx, cy, w - 70, cy + (w - 70 - cx), `${C.warm}aa`, 1.6);
    seg(f, cx, cy, 70, cy - (cx - 70), `${C.warm}aa`, 1.6);
    if (hyper) {
      // 类时双曲线 s²=τ²
      for (const k of [1, 2, 3]) {
        for (const sgn of [1, -1]) {
          const pts: [number, number][] = [];
          for (let i = -40; i <= 40; i++) {
            const x = i * 6;
            const t2 = (x / (k * 62)) ** 2 + 1;
            pts.push([cx + x, cy - sgn * Math.sqrt(t2) * k * 66]);
          }
          poly(f, pts, { stroke: C.cool, lw: 1.6 });
        }
      }
      text(f, "类时双曲线：固有时间 τ 相同的事件集——你的钟读数就是到原点的'曲率半径'", 30, 44, { color: C.cool, font: '12px sans-serif' });
    } else {
      for (let k = 1; k <= 3; k++) {
        const pts: [number, number][] = [];
        for (let i = -80; i <= 80; i++) pts.push([cx + i * 5, cy - k * 52]);
        poly(f, pts, { stroke: C.cool, lw: 1.4 });
      }
      text(f, '等时线：同一时刻的全体事件（类空超平面）', 30, 44, { color: C.cool, font: '12px sans-serif' });
    }
    // 行进事件
    const prog = (f.t * 0.3) % 1;
    const ex = cx + Math.sin(prog * Math.PI * 2) * 100;
    const ey = cy - prog * (h * 0.4) + 40;
    dot(f, ex, ey, 6, C.warm);

    footnotes(f, [
      '时空间隔 ds²=−c²dt²+dx² 在所有惯性系不变——绝对的不是时间，是间隔',
      '类时间隔（锥内）固有时间实数存在；类空间隔（锥外）无因果联系',
      '闵氏几何（+++−号差）与欧氏几何（++++）一字之差：时间坐标带负号是全部相对论的种子',
    ]);
    heading(f, '闵氏时空：度规换了符号');
  },
});
registerViz(minkowskiSpacetime);

/** 世界线。 */
const worldline = defineViz({
  slug: 'worldline', title: '世界线与固有时', animated: true,
  params: {
    kind: { type: 'select', options: ['匀速直线', '加速折返', '圆周运动'], default: '匀速直线', label: '运动' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['kind'] ?? '匀速');
    clear(f);
    const cx = w * 0.3, y0 = h - 60, y1 = 60;
    seg(f, 60, y0, w - 40, y0, C.grid, 1.3);
    seg(f, cx, y0, cx, y1, C.grid, 1.3);
    text(f, '空间', w - 90, y0 - 10, { color: C.dim, font: '12px sans-serif' });
    text(f, '时间 ct', cx + 8, y1 + 4, { color: C.dim, font: '12px sans-serif' });
    let path: [number, number][] = [];
    if (mode === '匀速直线') {
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        path.push([cx + t * 160, y0 - t * (y0 - y1)]);
      }
    } else if (mode === '加速折返') {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = cx + Math.sin(t * Math.PI) * 190;
        path.push([x, y0 - t * (y0 - y1)]);
      }
    } else {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        path.push([cx + Math.sin(t * Math.PI * 2) * 130, y0 - t * (y0 - y1)]);
      }
    }
    poly(f, path, { stroke: C.accent, lw: 3 });
    // 行进点 + 固有时积分标记
    const idx = Math.floor(((f.t * 0.4) % 1) * (path.length - 1));
    dot(f, path[idx][0], path[idx][1], 7, C.warm);
    // 光锥斜率参考
    seg(f, cx, y0, cx + 150, y0 - 150, `${C.warm}66`, 1.4);
    text(f, '45° 参考（光）：任何有质量世界线都比它更"竖"', cx + 156, y0 - 154, { color: `${C.warm}cc`, font: '11px sans-serif' });
    text(f, `世界线长度 = 固有时间 τ = ∫√(1−v²/c²) dt —— 你的钟实际走过的读数`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '每个粒子在时空中留下一条连续曲线：世界线是四维实在的轨迹',
      "世界线越'倾斜'（速度越大）固有时间越短——双生子佯谬的几何直觉",
      '测地线（最直的世界线）对应惯性运动：在弯曲时空中它自动给出引力轨迹',
    ]);
    heading(f, '世界线：把生命画在时空里');
  },
});
registerViz(worldline);

/** 测地线。 */
const geodesic = defineViz({
  slug: 'geodesic', title: '测地线与惯性运动', animated: true,
  params: {
    mass: { type: 'range', min: 0.2, max: 3, default: 1.2, step: 0.1, label: '中心质量（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'mass', 1.2);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 中心质量与势阱示意
    dot(f, cx, cy, 14 + M * 6, C.warm);
    // 网格被质量弯曲（漏斗形投影）
    const S = Math.min(w, h) * 0.44;
    for (let r = 1; r <= 5; r++) {
      const rr = (r / 5) * S;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.08) {
        const squash = 1 - Math.exp(-rr / 40) * 0.3;
        pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a) * squash * 0.72]);
      }
      poly(f, pts, { stroke: `${C.cool}66`, lw: 1.3 });
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const inner = 20 + M * 8;
      seg(f, cx + Math.cos(a) * inner, cy + Math.sin(a) * inner * 0.5, cx + Math.cos(a) * S, cy + Math.sin(a) * S * 0.72, `${C.cool}44`, 1.2);
    }
    // 测地线轨迹（椭圆进动）
    const pts: [number, number][] = [];
    const a0 = S * 0.62, e0 = 0.45;
    for (let i = 0; i <= 320; i++) {
      const th = (i / 320) * Math.PI * 2.4;
      const r = (a0 * (1 - e0 * e0)) / (1 + e0 * Math.cos(th)) * (1 + th * 0.012);
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th) * 0.72]);
    }
    poly(f, pts, { stroke: C.hot, lw: 2.6 });
    const idx = Math.floor(((f.t * 0.35) % 1) * (pts.length - 1));
    dot(f, pts[idx][0], pts[idx][1], 7, C.cyan);
    text(f, "弯曲时空中的'直线'=测地线：行星椭圆轨道自带近日点进动", 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "测地线是时空中最'直'的路径：自由落体、行星轨道、光线全走它",
      "牛顿用引力'拉'，爱因斯坦用几何'弯'——同一个轨道的两种语言",
      '水星近日点每世纪 43″ 进动是广义相对论的第一个实验证据（1915）',
    ]);
    heading(f, '测地线：几何就是引力');
  },
});
registerViz(geodesic);

/** 等效原理。 */
const equivalencePrinciple = defineViz({
  slug: 'equivalence-principle', title: '等效原理', animated: true,
  params: {
    kind: { type: 'select', options: ['加速电梯', '引力场自由落体'], default: '加速电梯', label: '场景' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const accel = String((params as Record<string, unknown>)['kind'] ?? '').includes('加速');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 电梯箱体
    const bob = Math.sin(f.t * 2) * 8;
    poly(f, [[cx - 96, cy - 110 + bob], [cx + 96, cy - 110 + bob], [cx + 96, cy + 110 + bob], [cx - 96, cy + 110 + bob]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.14)' } as any);
    // 球（实验者视角）
    const ballY = cy - 30 + (accel ? bob * 0 : Math.sin(f.t * 2) * 0);
    dot(f, cx, ballY, 12, C.warm);
    // 悬线/重力线
    if (accel) {
      // 加速上行：地板压脚
      seg(f, cx, cy + 110 + bob, cx, cy + 30, `${C.green}aa`, 2.4);
      text(f, 'a ↑（电梯加速）：地板支持力 = 感受到的"重力"', cx - 130, cy + 138 + bob, { color: C.green, font: '12px sans-serif' });
      text(f, '箱内任何实验都无法区分：加速 or 引力？', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else {
      // 自由落体：失重
      for (let i = 0; i < 5; i++) {
        const gy = cy - 70 + i * 34;
        poly(f, [[cx - 60, gy], [cx - 60, gy - 22]], { stroke: `${C.hot}77`, lw: 1.6 } as any);
      }
      text(f, '自由落体：电梯与球同加速度 → 箱内完全失重（引力被"关掉"）', 30, 44, { color: C.hot, font: '13px sans-serif' });
      text(f, 'g 被局域惯性系完全消除——引力是可被自由落体剥去的"假力"', 30, h - 34, { color: C.green, font: '12px sans-serif' });
    }

    footnotes(f, [
      '弱等效原理（惯性质量=引力质量）实验精度已达 10⁻¹⁵（Eöt-Wash 转子实验）',
      "爱因斯坦 1907 年'最幸运的思想'：电梯内的物理定律与无引力惯性系完全相同",
      '等效原理连接引力与加速——广义相对论的入口，也是量子引力的探针（等效原理破缺检验）',
    ]);
    heading(f, '等效原理：引力可以被局域消除');
  },
});
registerViz(equivalencePrinciple);

/** 引力红移。 */
const gravitationalRedshift = defineViz({
  slug: 'gravitational-redshift', title: '引力红移', animated: true,
  params: {
    z: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.05, label: '势阱深度（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const depth = num(params, 'z', 0.5);
    clear(f);
    const cx = w / 2, cy = h * 0.34;
    // 势阱（凹陷）
    const pit: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = 40 + (i / 120) * (w - 80);
      const d = Math.exp(-((x - cx) ** 2) / (2 * (w * 0.14) ** 2));
      pit.push([x, cy + d * depth * 130]);
    }
    poly(f, pit, { stroke: C.dim, lw: 2.6 });
    // 上行光子（波长被拉长）
    const n = 7;
    for (let k = 0; k < n; k++) {
      const t = ((f.t * 0.35 + k / n) % 1);
      const y = cy + depth * 110 - t * (cy + depth * 110 - 60);
      const stretch = 1 + t * depth * 1.4;
      const hue = 210 - t * depth * 170; // 蓝→红
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const dx = -30 + i * 1.5;
        pts.push([cx + dx, y + Math.sin((i / 40) * Math.PI * 4 * stretch + f.t * 6) * 7]);
      }
      poly(f, pts, { stroke: `hsl(${hue},85%,60%)`, lw: 2.4 });
    }
    text(f, `凹陷越深，上行光子波长越长：λ_out/λ_in = 1/√(1−2GM/rc²) ≈ ${(1 + depth * 0.6).toFixed(2)}`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '太阳表面出射的光红移 2.1×10⁻⁶——白光略偏红（实测于 1959 年庞德-雷布卡）', 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      "爬出势阱的光子要'付出'能量：频率降低、波长变长——时间也被拉慢（同一事实）",
      '引力时间膨胀是 GPS 星载原子钟每天快 38μs 的主因——不修正就没有导航',
      '白矮星与中子星谱线的引力红移是测量致密天体质量的标尺',
    ]);
    heading(f, '引力红移：光爬出势阱要付能量');
  },
});
registerViz(gravitationalRedshift);

/** 史瓦西轨道。 */
const schwarzschildOrbit = defineViz({
  slug: 'schwarzschild-orbit', title: '史瓦西轨道与进动', animated: true,
  params: {
    rs: { type: 'range', min: 0.05, max: 0.5, default: 0.18, step: 0.01, label: 'r_s/r（相对引力强度）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rs = num(params, 'rs', 0.18);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.4;
    // 视界与光子球
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R * rs, 0, Math.PI * 2);
    f.ctx.fillStyle = '#050510'; f.ctx.fill();
    f.ctx.strokeStyle = `${C.cool}aa`; f.ctx.lineWidth = 2; f.ctx.stroke();
    text(f, '视界 r_s', cx + R * rs + 6, cy - 6, { color: C.cool, font: '11px sans-serif' });
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R * rs * 1.5, 0, Math.PI * 2);
    f.ctx.setLineDash([5, 4]);
    f.ctx.strokeStyle = `${C.warm}77`; f.ctx.lineWidth = 1.4; f.ctx.stroke();
    f.ctx.setLineDash([]);
    text(f, '光子球 1.5r_s', cx + R * rs * 1.5 + 6, cy + 16, { color: `${C.warm}cc`, font: '10px sans-serif' });
    // 进动椭圆轨道（每圈转过 2π+Δφ）
    const pts: [number, number][] = [];
    const precess = 0.35 * (rs / 0.18);
    for (let i = 0; i <= 600; i++) {
      const th = (i / 600) * Math.PI * 4;
      const a = 0.62, e = 0.55;
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(th)) * R;
      const phi = th + precess * (th / (Math.PI * 2));
      pts.push([cx + r * Math.cos(phi), cy + r * Math.sin(phi) * 0.82]);
    }
    poly(f, pts, { stroke: C.hot, lw: 2.2 });
    const idx = Math.floor(((f.t * 0.3) % 1) * (pts.length - 1));
    dot(f, pts[idx][0], pts[idx][1], 7, C.cyan);
    text(f, `每圈进动 Δφ ≈ 6πGM/(c²a(1−e²)) —— 势阱越深进动越快`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '史瓦西解（1916）给出球对称质量外的唯一真空时空——广义相对论的第一个精确解',
      '轨道不再是封闭椭圆：近日点每圈前移，累积成玫瑰线般的进动图',
      'GPS 轨道修正含史瓦西项；双星脉冲 PSR 1913+16 的进动与预言吻合到 0.2%',
    ]);
    heading(f, '史瓦西轨道：椭圆不再闭合');
  },
});
registerViz(schwarzschildOrbit);

/** 最内稳定圆轨道 ISCO。 */
const isco = defineViz({
  slug: 'isco', title: '最内稳定圆轨道（ISCO）', animated: true,
  params: {
    spin: { type: 'range', min: 0, max: 0.998, default: 0, step: 0.02, label: '黑洞自旋 a/M' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'spin', 0);
    const rIsco = a < 0.01 ? 6 : 6 - 4 * Math.sqrt(1 - a) + 2 * (1 - Math.sqrt(1 - a)); // 顺行近似 9→3
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.42;
    // 黑洞
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
    f.ctx.fillStyle = '#04040c'; f.ctx.fill();
    f.ctx.strokeStyle = `${C.cool}88`; f.ctx.lineWidth = 2; f.ctx.stroke();
    // ISCO 环
    const rIscoPx = (rIsco / 9) * R;
    f.ctx.beginPath(); f.ctx.arc(cx, cy, rIscoPx, 0, Math.PI * 2);
    f.ctx.strokeStyle = C.warm; f.ctx.lineWidth = 2.6; f.ctx.setLineDash([8, 5]); f.ctx.stroke(); f.ctx.setLineDash([]);
    text(f, `ISCO = ${rIsco.toFixed(1)} GM/c²`, cx + rIscoPx + 8, cy - 8, { color: C.warm, font: '12px sans-serif' });
    // 吸积盘（内缘起于 ISCO）
    for (let k = 0; k < 3; k++) {
      const rr = rIscoPx + 14 + k * 16;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 80; i++) {
        const th = (i / 80) * Math.PI * 2;
        const dop = 0.6 + 0.4 * Math.cos(th - f.t * 2); // 多普勒亮暗
        pts.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th) * 0.42]);
        void dop;
      }
      poly(f, pts, { stroke: `rgba(255,${140 + k * 20},60,${0.7 - k * 0.16})`, lw: 5 - k });
    }
    // 内坠物质
    const prog = (f.t * 0.4) % 1;
    if (prog < 0.85) {
      const rr = rIscoPx + (R - rIscoPx) * prog;
      const th = f.t * 3;
      dot(f, cx + rr * Math.cos(th), cy + rr * Math.sin(th) * 0.42, 5, C.hot);
    }
    text(f, a > 0.5 ? '顺行自旋把 ISCO 拉近到几 GM/c²——自旋黑洞的盘更贴近视界' : 'a=0 时 ISCO=6 GM/c²：盘的内缘就停在这里，之内没有稳定轨道', 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '圆轨道在 ISCO 以内不再稳定：轻微扰动即螺旋坠入——吸积盘内缘的物理边界',
      'ISCO 半径与黑洞自旋联动：测量内缘温度即可称量自旋（X 射线谱线拟合）',
      'M87* 与 SgrA* 的黑洞照片中亮环直径 ≈ 5.2 r_g——EHT 图像直接关联视界尺度',
    ]);
    heading(f, 'ISCO：稳定轨道的最后边界');
  },
});
registerViz(isco);

/** 光线偏折。 */
const lightDeflection = defineViz({
  slug: 'light-deflection', title: '光线偏折与引力透镜', animated: true,
  params: {
    M: { type: 'range', min: 0.2, max: 3, default: 1.4, step: 0.1, label: '偏折源质量（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'M', 1.4);
    clear(f);
    const cx = w * 0.42, cy = h / 2 + 6;
    // 天体
    dot(f, cx, cy, 13 + M * 5, C.warm);
    // 直线路径（无引力虚线）
    seg(f, 40, cy - 70, w - 40, cy - 70, `${C.dim}77`, 1.4);
    // 弯折光线（向质量弯）
    const bend = 26 * M;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const x = 40 + t * (w - 80);
      const gauss = Math.exp(-((x - cx) ** 2) / (2 * (w * 0.1) ** 2));
      pts.push([x, cy - 70 + gauss * bend]);
    }
    poly(f, pts, { stroke: C.cyan, lw: 2.8 });
    // 观察者看到的表观位置（反向延长）
    const appX = w - 90;
    const appY = cy - 70 - bend * 0.8;
    seg(f, cx, cy - 70 + bend * 0.4, appX, appY, `${C.warm}66`, 1.4);
    dot(f, appX, appY, 5, C.warm);
    text(f, '真实光源', 44, cy - 84, { color: C.dim, font: '11px sans-serif' });
    text(f, '观察者看到的表观位置', appX - 100, appY - 12, { color: C.warm, font: '11px sans-serif' });
    text(f, `偏折角 α ≈ 4GM/(c²b)：太阳边缘 1.75″——1919 年日食实测证实`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '1919 年爱丁顿日食队测得太阳边缘星光偏折与广义相对论吻合——一夜之间爱因斯坦名扬世界',
      '引力透镜把背景星系拉成弧、环（爱因斯坦环）与多重像——暗物质分布的称量工具',
      '微引力透镜巡天（OGLE、MOA）用毫秒级增亮发现系外行星与孤立致密天体',
    ]);
    heading(f, '光线偏折：质量弯曲视线');
  },
});
registerViz(lightDeflection);
