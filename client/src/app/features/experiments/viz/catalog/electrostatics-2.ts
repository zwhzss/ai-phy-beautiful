import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view } from '../canvas';

/** P92 高斯定律。 */
const gaussLaw = defineViz({
  slug: 'gauss-law', title: '高斯定律',
  params: {
    q: { type: 'range', min: -3, max: 3, default: 1, step: 0.5, label: '面内电荷 Q（μC）' },
    extra: { type: 'select', options: ['电荷在内', '电荷在外'], default: '电荷在内', label: '位置' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const q = num(params, 'q', 1);
    const inside = str(params, 'extra', '电荷在内') === '电荷在内';
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 高斯面（圆）
    f.ctx.beginPath(); f.ctx.arc(cx, cy, 96, 0, Math.PI * 2);
    f.ctx.setLineDash([8, 6]);
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    f.ctx.setLineDash([]);
    text(f, '高斯面 S', cx - 100, cy - 104, { color: C.cool, font: '11px sans-serif' });
    // 场线
    const qx = inside ? cx : cx + 150;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const L = 70;
      const x0 = qx + Math.cos(a) * 16, y0 = cy + Math.sin(a) * 16;
      const x1 = qx + Math.cos(a) * L, y1 = cy + Math.sin(a) * L;
      seg(f, x0, y0, x1, y1, `${C.warm}aa`, 1.6);
      const dir = Math.sign(q);
      if (dir > 0) poly(f, [[x1, y1], [x1 - Math.cos(a) * 8 - Math.sin(a) * 4, y1 - Math.sin(a) * 8 + Math.cos(a) * 4], [x1 - Math.cos(a) * 8 + Math.sin(a) * 4, y1 - Math.sin(a) * 8 - Math.cos(a) * 4]], { stroke: C.warm, lw: 1, fill: C.warm } as any);
    }
    dot(f, qx, cy, 9, q >= 0 ? C.hot : C.cool);
    text(f, q >= 0 ? '+Q' : '−Q', qx - 9, cy + 4, { color: '#fff', font: '11px sans-serif' });
    const flux = inside ? q / 8.85e-6 : 0;
    text(f, `Φ_E = ∮E·dA = Q_in/ε₀`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, inside ? `Q_in=${q}μC → 通量 ∝ ${q}（非零，12 条线穿出）` : 'Q 在面外：穿进=穿出，净通量为 0',
      30, 66, { color: inside ? C.green : C.dim, font: '12px sans-serif' });
    void flux;

    footnotes(f, [
      '净通量只数面内的电荷——与面外电荷多少、位置完全无关（平方反比的功劳）',
      '球对称时积分直接变成 E·4πr² = Q/ε₀：对称性把积分变除法，这是高斯定律的正确打开方式',
      '麦克斯韦方程之一：电场的源是电荷，且电力线无头无尾始于正终于负',
    ]);
    heading(f, '高斯定律：通量只认面内电荷');
  },
});
registerViz(gaussLaw);

/** P93 电势与等势面。 */
const electricPotential = defineViz({
  slug: 'electric-potential', title: '电势与等势面', animated: true,
  params: {
    sign: { type: 'select', options: ['正电荷', '偶极子'], default: '正电荷', label: '源' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dipole = str(params, 'sign', '正电荷') === '偶极子';
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const sources = dipole ? [[cx - 70, cy, +1], [cx + 70, cy, -1] as [number, number, number]] : [[cx, cy, +1] as [number, number, number]];
    // 等势线（二维等值线示意）
    const V = (x: number, y: number): number => {
      let v = 0;
      for (const [sx0, sy0, sq] of sources) v += sq / Math.max(Math.hypot(x - sx0, y - sy0), 18);
      return v;
    };
    for (let lv = 1; lv <= 7; lv++) {
      const target = lv * 0.05;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.06) {
        let r = 20;
        for (let k = 0; k < 40; k++) {
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          const v = V(x, y);
          if (Math.abs(v - target) < 0.004) break;
          r += v > target ? 3 : -3;
          r = Math.max(16, Math.min(Math.min(w, h) * 0.48, r));
        }
        if (r > 22 && r < Math.min(w, h) * 0.47) pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      if (pts.length > 6) poly(f, pts, { stroke: `${C.cool}${(60 + lv * 20).toString(16)}`, lw: 1.6 });
    }
    // 场线（与等势面垂直）
    for (const [sx0, sy0, sq] of sources) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const dir = Math.sign(sq);
        seg(f, sx0, sy0, sx0 + Math.cos(a) * 46 * dir, sy0 + Math.sin(a) * 46 * dir, `${C.warm}99`, 1.3);
      }
      dot(f, sx0, sy0, 9, sq > 0 ? C.hot : C.cool);
      text(f, sq > 0 ? '+q' : '−q', sx0 - 9, sy0 + 4, { color: '#fff', font: '11px sans-serif' });
    }
    text(f, '蓝圈：等势面　橙线：场线（处处与等势面垂直）', 30, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, 'E = −∇V：沿电场线方向电势降低（上坡=逆场）', 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '电势是把单位正电荷从无穷远搬到场点所做的功——标量叠加，比矢量场线好算得多',
      '等势面与场线正交；等差等势面的疏密直接读出场强的大小',
      "沿等势面移动电荷不做功——这就是'等势'在工程中的价值（高压带电作业的底气）",
    ]);
    heading(f, '电势与等势面：把矢量变标量');
  },
});
registerViz(electricPotential);

/** P94 平行板电容器。 */
const capacitor = defineViz({
  slug: 'capacitor', title: '平行板电容器',
  params: {
    d: { type: 'range', min: 1, max: 10, default: 4, step: 0.5, label: '板间距 d（mm）' },
    eps: { type: 'range', min: 1, max: 12, default: 1, step: 0.5, label: '介质 ε_r' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'd', 4);
    const eps = num(params, 'eps', 1);
    const C0 = (eps * 10) / d; // 相对容量示意（μF）
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const gap = d * 11;
    const plateW = Math.min(w * 0.5, 340);
    // 两板
    poly(f, [[cx - plateW, cy - gap - 8], [cx + plateW, cy - gap - 8], [cx + plateW, cy - gap], [cx - plateW, cy - gap]],
      { stroke: C.hot, lw: 2, fill: 'rgba(237,137,54,0.55)' } as any);
    poly(f, [[cx - plateW, cy + gap], [cx + plateW, cy + gap], [cx + plateW, cy + gap + 8], [cx - plateW, cy + gap + 8]],
      { stroke: C.cool, lw: 2, fill: 'rgba(56,130,215,0.55)' } as any);
    // 电荷符号
    for (let i = -5; i <= 5; i++) {
      const x = cx + i * (plateW / 5.6);
      text(f, '+', x, cy - gap - 14, { color: C.hot, font: '15px sans-serif' });
      text(f, '−', x, cy + gap + 26, { color: C.cool, font: '15px sans-serif' });
    }
    // 均匀场线
    for (let i = -4; i <= 4; i++) {
      const x = cx + i * (plateW / 4.6);
      seg(f, x, cy - gap + 2, x, cy + gap - 6, `${C.warm}88`, 1.5);
      poly(f, [[x, cy + gap - 2], [x - 4, cy + gap - 10], [x + 4, cy + gap - 10]], { stroke: C.warm, lw: 1, fill: C.warm } as any);
    }
    // 介质（相对板填充）
    if (eps > 1.01) {
      poly(f, [[cx - plateW, cy - gap + 4], [cx + plateW, cy - gap + 4], [cx + plateW, cy + gap - 4], [cx - plateW, cy + gap - 4]],
        { stroke: `${C.green}aa`, lw: 1.6, fill: 'rgba(16,185,129,0.10)', dash: [6, 4] } as any);
      text(f, `介质 ε_r=${eps}`, cx + plateW - 60, cy - gap + 18, { color: C.green, font: '11px sans-serif' });
    }
    text(f, `C = ε₀ε_r·A/d → 相对容量 ${C0.toFixed(1)}`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, eps > 1.01 ? `介质使电容增大 ${eps} 倍（极化削弱内部场）` : '真空/空气介质：板大、距近、介质好 → 容量大', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '储能 W = ½CV²：电容器是电子设备的瞬时能量池（相机闪光灯的瞬间放电）',
      '介质的极化产生反向束缚电荷，削弱内部场——同样的 Q 下电压更低，C 更大',
      '从照相机闪光到电网无功补偿、再到 RAM 断电保存——两种尺度的电容器都在干活',
    ]);
    heading(f, '电容器：把电场关进两块板之间');
  },
});
registerViz(capacitor);

/** P95 镜像电荷。 */
const imageCharge = defineViz({
  slug: 'image-charge', title: '镜像电荷', animated: true,
  params: {
    q: { type: 'range', min: -2, max: 2, default: 1, step: 0.5, label: '源电荷 q（μC）' },
    z: { type: 'range', min: 20, max: 120, default: 60, step: 5, label: '距导体面距离' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const q = num(params, 'q', 1);
    const z = num(params, 'z', 60);
    clear(f);
    const planeY = h / 2 + 40;
    // 导体（接地平板）
    poly(f, [[60, planeY], [w - 60, planeY], [w - 60, planeY + 26], [60, planeY + 26]],
      { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.35)' } as any);
    text(f, '接地导体（等势面 V=0）', 70, planeY + 52, { color: C.dim, font: '11px sans-serif' });
    // 源电荷与镜像电荷
    const cx = w / 2, srcY = planeY - z;
    dot(f, cx, srcY, 11, q >= 0 ? C.hot : C.cool);
    text(f, q >= 0 ? '+q' : '−q', cx + 16, srcY, { color: q >= 0 ? C.hot : C.cool, font: '13px sans-serif' });
    const imgY = planeY + z;
    if (imgY < h - 30) {
      dot(f, cx, imgY, 11, `${q >= 0 ? C.cool : C.hot}cc`);
      text(f, (q >= 0 ? '−' : '+') + 'q（镜像）', cx + 16, imgY, { color: C.cool, font: '13px sans-serif' });
    }
    // 源到面的虚线
    seg(f, cx, srcY, cx, planeY, `${C.dim}aa`, 1);
    seg(f, cx, planeY, cx, Math.min(imgY, h - 40), `${C.dim}aa`, 1);
    text(f, `z=${z}`, cx + 6, planeY - 8, { color: C.dim, font: '11px sans-serif' });
    // 导体面感应电荷（脉动分布）
    for (let i = -8; i <= 8; i++) {
      const x = cx + i * 34;
      const amp = Math.exp(-Math.abs(i) * 0.28);
      const a = 0.3 + 0.5 * amp * (0.7 + 0.3 * Math.sin(f.t * 2.4));
      text(f, q >= 0 ? '−' : '+', x, planeY + 18, { color: `rgba(255,255,255,${a})`, font: '13px sans-serif' });
    }
    text(f, `镜像法：用 ${q >= 0 ? '−q' : '+q'}@对称位置替代导体，上半空间的场完全等价`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '唯一性定理保证：只要边界电势相同，上半空间的解就是唯一解——镜像法因此严格成立',
      '面下的镜像电荷不真实存在，但它精确给出了导体面的感应电荷分布与吸引力',
      '点电荷与导体面的吸引力 F = q²/(4πε₀(2z)²)——扫描隧穿显微镜的针尖力同源',
    ]);
    heading(f, '镜像法：用假电荷解真问题');
  },
});
registerViz(imageCharge);

/** P96 四极场。 */
const quadrupole = defineViz({
  slug: 'quadrupole', title: '四极场',
  params: {
    kind: { type: 'select', options: ['四极电场（线性）', '四极磁场（马鞍）'], default: '四极电场（线性）', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const magnetic = str(params, 'kind', '四极电场（线性）').startsWith('四极磁');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 四个电极（+ + − − 对置）
    const pols: [number, number, number, number][] = [
      [cx - 130, cy, +1, 0], [cx + 130, cy, -1, 0],
      [cx, cy - 110, -1, 1], [cx, cy + 110, +1, 1],
    ];
    for (const [x, y, s, vert] of pols) {
      const pts: [number, number][] = vert
        ? [[x - 62, y - 10], [x + 62, y - 10], [x + 62, y + 10], [x - 62, y + 10]]
        : [[x - 10, y - 62], [x + 10, y - 62], [x + 10, y + 62], [x - 10, y + 62]];
      poly(f, pts, { stroke: s > 0 ? C.hot : C.cool, lw: 2, fill: s > 0 ? 'rgba(237,137,54,0.4)' : 'rgba(56,130,215,0.4)' } as any);
      text(f, s > 0 ? '+' : '−', x - 5, y + 5, { color: '#fff', font: '15px sans-serif' });
    }
    // 场线（鞍点：中心会聚一个方向、发散另一方向）
    for (let i = 0; i < 6; i++) {
      const yy = cy - 60 + i * 24;
      const pts: [number, number][] = [];
      for (let t = -1; t <= 1; t += 0.05) {
        const x = cx + t * 100;
        const y = yy + (t * t) * 44 * Math.sign(yy - cy || 1) * -1;
        pts.push([x, y]);
      }
      poly(f, pts, { stroke: `${C.warm}88`, lw: 1.4 });
    }
    dot(f, cx, cy, 4, C.green);
    text(f, '鞍点：一个方向聚焦、另一个方向散焦——净效应仍是聚焦', 30, 44, { color: C.green, font: '12px sans-serif' });
    text(f, magnetic ? '四极磁铁用于束流聚焦（加速器标准元件）' : 'E ∝ (x,y) 线性增长：离子阱与质谱四极杆的场型',
      30, h - 34, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '四极场是多极展开的第二阶：偶极场控制中心、四极场控制束斑形状',
      '质谱仪的四极质量分析器：特定 m/z 的离子在振荡中稳定通过，其余被筛掉',
      '粒子对撞机的聚焦磁铁全是四极对——先水平后垂直，成对使用抵消散焦',
    ]);
    heading(f, '四极场：鞍点上的聚焦术');
  },
});
registerViz(quadrupole);

/** P97 静电平衡与尖端放电。 */
const conductorElectrostat = defineViz({
  slug: 'conductor-electrostat', title: '静电平衡与尖端放电', animated: true,
  params: {
    shape: { type: 'select', options: ['球导体', '尖端导体'], default: '尖端导体', label: '形状' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sharp = str(params, 'shape', '球导体') === '尖端导体';
    clear(f);
    const cx = w * 0.34, cy = h / 2 + 6;
    // 导体形状
    if (sharp) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = Math.PI * (0.5 + t);
        pts.push([cx + Math.cos(a) * 74, cy + Math.sin(a) * 74]);
      }
      pts.push([cx + 168, cy - 14], [cx + 168, cy + 14]);
      poly(f, [...pts, [cx, cy + 74]], { stroke: C.dim, lw: 2.2, fill: 'rgba(148,163,184,0.35)' } as any);
      // 尖端场强（强）与面电荷密
      for (let k = 0; k < 7; k++) {
        const yy = cy - 40 + k * 13;
        const strength = Math.exp(-Math.abs(yy - cy) / 40);
        seg(f, cx + 172, yy, cx + 172 + 30 + strength * 46, yy, `rgba(255,120,80,${0.35 + strength * 0.6})`, 2);
      }
      // 放电火花（周期性）
      const ph = (f.t * 0.7) % 1;
      if (ph < 0.35) {
        const pts2: [number, number][] = [[cx + 224, cy]];
        for (let i = 1; i <= 6; i++) pts2.push([cx + 224 + i * 26, cy + (Math.sin(i * 9.7) * 26)]);
        poly(f, pts2, { stroke: '#fff3a0', lw: 2.6 });
      }
      text(f, '尖端：曲率大 → 面电荷密 → 场强最大 → 空气击穿', cx + 172, cy - 58, { color: C.hot, font: '12px sans-serif' });
    } else {
      f.ctx.beginPath(); f.ctx.arc(cx, cy, 84, 0, Math.PI * 2);
      f.ctx.fillStyle = 'rgba(148,163,184,0.35)'; f.ctx.fill();
      f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 2.2; f.ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        text(f, '−', cx + Math.cos(a) * 96 - 4, cy + Math.sin(a) * 96, { color: C.cool, font: '13px sans-serif' });
        seg(f, cx + Math.cos(a) * 88, cy + Math.sin(a) * 88, cx + Math.cos(a) * 116, cy + Math.sin(a) * 116, `${C.cool}77`, 1.3);
      }
      text(f, '球面：电荷均匀分布，外部场如点电荷', cx - 84, cy + 120, { color: C.cool, font: '12px sans-serif' });
    }
    text(f, '导体内部 E=0、电荷全在外表面、表面为等势面', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '静电平衡三条铁律：内场为零、电荷驻表面、整体等势——自由电子自己会安排好一切',
      "尖端放电是避雷针原理：把大电场集中到针尖，先'引雷入地'保护建筑",
      '静电除尘、复印机、范德格拉夫起电机都利用尖端附近的强场发射与吸附电荷',
    ]);
    heading(f, '静电平衡：形状决定电荷分布');
  },
});
registerViz(conductorElectrostat);

/** P98 电荷分布与库仑扭秤。 */
const chargeDistribution = defineViz({
  slug: 'charge-distribution', title: '电荷分布与库仑扭秤', animated: true,
  params: {
    mode: { type: 'select', options: ['空腔导体', '库仑扭秤'], default: '空腔导体', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const twBar = str(params, 'mode', '空腔导体') === '库仑扭秤';
    clear(f);
    if (twBar) {
      // 悬丝、小杆、两球、指针
      const cx = w / 2, cy = h / 2 + 6;
      const twist = Math.sin(f.t * 1.1) * 0.5;
      seg(f, cx, 44, cx, cy - 60, C.dim, 1.6);
      text(f, '金属悬丝（可测扭转角）', cx + 8, 54, { color: C.dim, font: '11px sans-serif' });
      const half = Math.min(w, h) * 0.24;
      const ax = Math.cos(twist) * half, ay = Math.sin(twist) * half * 0.35;
      seg(f, cx - ax, cy - ay, cx + ax, cy + ay, C.cool, 3);
      dot(f, cx - ax, cy - ay, 12, C.cool);
      dot(f, cx + ax, cy + ay, 12, C.hot);
      // 固定球（靠近一侧）
      const fixedX = cx + ax - 46, fixedY = cy + ay - 26;
      dot(f, fixedX, fixedY, 12, C.warm);
      text(f, '固定带电球', fixedX - 34, fixedY - 20, { color: C.warm, font: '11px sans-serif' });
      // 扭转角弧
      text(f, `θ ∝ q₁q₂/r² — 扭转角即力的读数`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '库仑 1785：扭秤把 10⁻⁵ N 的力变成了可读的角度', 30, 66, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 空腔导体：外电荷使腔内无场（法拉第笼）
      const cx = w * 0.4, cy = h / 2 + 6;
      f.ctx.beginPath(); f.ctx.arc(cx, cy, 106, 0, Math.PI * 2);
      f.ctx.fillStyle = 'rgba(148,163,184,0.35)'; f.ctx.fill();
      f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 6; f.ctx.stroke();
      f.ctx.beginPath(); f.ctx.arc(cx, cy, 66, 0, Math.PI * 2);
      f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 4; f.ctx.stroke();
      // 外部电荷
      const ex = cx - 168;
      dot(f, ex, cy, 10, C.hot);
      text(f, '+Q 外部', ex - 30, cy - 22, { color: C.hot, font: '11px sans-serif' });
      // 外表面电荷再分布（近多远少）
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * 0.75 + (i / 13) * Math.PI * 1.5;
        const dens = 0.4 + 0.6 * Math.exp(-((a - Math.PI) ** 2) / 1.2);
        text(f, '+', cx + Math.cos(a) * 116 - 4, cy + Math.sin(a) * 116, { color: `rgba(255,110,80,${0.35 + dens * 0.65})`, font: '14px sans-serif' });
      }
      // 腔内：无场区
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        dot(f, cx + Math.cos(a) * 34, cy + Math.sin(a) * 34, 2, `${C.green}66`);
      }
      text(f, '腔内 E≡0：外部电荷被外表面电荷完美屏蔽', cx - 62, cy + 138, { color: C.green, font: '12px sans-serif' });
      text(f, '法拉第笼：静电屏蔽的金钟罩', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }

    footnotes(f, [
      '空腔导体内部严格无场——外部电荷只重排外表面，腔内安然无恙（静电屏蔽）',
      '验电器、屏蔽电缆的编织网、飞机遭遇雷击时乘客安全，全是这一原理',
      '库仑扭秤的精度来自扭转系数的标定：把微弱力换算成角度，电学从此可以定量',
    ]);
    heading(f, '电荷分布与扭秤：电学的定量化');
  },
});
registerViz(chargeDistribution);
