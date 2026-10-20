import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 倒格子与晶格。 */
const reciprocalLattice = defineViz({
  slug: 'reciprocal-lattice', title: '晶格与倒格子', animated: true,
  params: {
    kind: { type: 'select', options: ['正方晶格', '六角晶格'], default: '正方晶格', label: '晶格' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hex = String((params as Record<string, unknown>)['kind'] ?? '').includes('六角');
    clear(f);
    const cell = Math.min(w, h) * 0.16;
    const cx = w / 2, cy = h / 2 + 6;
    const drawLattice = (ox: number, color: string, a1: [number, number], a2: [number, number], label: string): void => {
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          const x = ox + i * a1[0] + j * a2[0];
          const y = cy + i * a1[1] + j * a2[1];
          if (Math.abs(x - ox) > w * 0.21 || Math.abs(y - cy) > h * 0.4) continue;
          dot(f, x, y, 5, color);
        }
      }
      text(f, label, ox - 40, 44, { color, font: '13px sans-serif' });
    };
    const t = f.t * 0.3;
    void t;
    if (hex) {
      drawLattice(w * 0.26, C.cool, [cell, 0], [cell / 2, cell * 0.86], '正空间（六角）');
      drawLattice(w * 0.74, C.warm, [(2 * Math.PI) / (cell * 1.15), 0], [0, (2 * Math.PI) / (cell * 0.95)], '倒空间（六角）');
    } else {
      drawLattice(w * 0.26, C.cool, [cell, 0], [0, cell], '正空间 a₁,a₂');
      drawLattice(w * 0.74, C.warm, [(2 * Math.PI) / cell, 0], [0, (2 * Math.PI) / cell], '倒空间 b₁,b₂=2π/a');
    }
    seg(f, w * 0.48, 70, w * 0.48, h - 40, `${C.dim}77`, 1.4);
    text(f, 'a·b=2π：实空间越密，倒空间越疏——衍射斑点就是倒格子的像', 30, h - 34, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      'X 射线衍射斑点阵直接绘制倒格子——晶体结构解析由此而来（劳厄 1912、布拉格 1913）',
      '能带、声子色散都定义在倒空间：固体物理的"动量空间"其实是倒格矢空间',
      '石墨烯的六角倒格子给出 K 点狄拉克锥——拓扑物态的入口',
    ]);
    heading(f, '倒格子：衍射看到的另一套晶格');
  },
});
registerViz(reciprocalLattice);

/** 布里渊区。 */
const brillouinZone = defineViz({
  slug: 'brillouin-zone', title: '布里渊区', animated: true,
  params: {
    kind: { type: 'select', options: ['二维正方', '二维六角'], default: '二维六角', label: '晶格' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hex = String((params as Record<string, unknown>)['kind'] ?? '').includes('六角');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.32;
    const pulse = 0.86 + 0.14 * Math.sin(f.t * 2);
    if (hex) {
      // 第一布里渊区（正六边形）
      const pts: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([cx + R * pulse * Math.cos(a), cy + R * pulse * Math.sin(a) * 0.92]);
      }
      poly(f, [...pts, pts[0]], { stroke: C.warm, lw: 2.6, fill: 'rgba(237,137,54,0.12)' } as any);
      // 高对称点
      dot(f, cx, cy, 5, C.green);
      text(f, 'Γ', cx + 8, cy + 4, { color: C.green, font: '13px sans-serif' });
      const ka = R * Math.cos(Math.PI / 6);
      dot(f, cx + ka, cy, 5, C.cool);
      text(f, 'K', cx + ka + 8, cy - 6, { color: C.cool, font: '13px sans-serif' });
      dot(f, cx, cy - R * 0.92, 5, C.cool);
      text(f, 'M', cx + 8, cy - R * 0.92 - 8, { color: C.cool, font: '13px sans-serif' });
      text(f, '石墨烯的 K 点：狄拉克锥所在——线性色散的蜂巢之魂', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      const pts: [number, number][] = [
        [cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R], [cx - R, cy + R],
      ];
      poly(f, [...pts, pts[0]], { stroke: C.warm, lw: 2.6, fill: 'rgba(237,137,54,0.12)' } as any);
      dot(f, cx, cy, 5, C.green);
      text(f, 'Γ', cx + 8, cy + 4, { color: C.green, font: '13px sans-serif' });
      dot(f, cx + R, cy, 5, C.cool);
      text(f, 'X', cx + R + 8, cy - 6, { color: C.cool, font: '13px sans-serif' });
      dot(f, cx + R, cy - R, 5, C.cool);
      text(f, 'M', cx + R + 8, cy - R - 6, { color: C.cool, font: '13px sans-serif' });
      text(f, '正方晶格第一布里渊区：倒空间的 Wigner-Seitz 元胞', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    // 简并边（闪）
    text(f, 'k 空间周期性：能带 E(k) 只需在区内描述——区外皆是复写', 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '第一布里渊区是倒格子的 Wigner-Seitz 元胞：所有 k 的"最小代表集"',
      '能带图的横轴就是 Γ-X-M-Γ 这样的高对称路径——凝聚态的日常地图',
      '费米面拓扑（穿区、嵌套）决定输运与超导：拓扑费米面催生密度波',
    ]);
    heading(f, '布里渊区：能带理论的领地');
  },
});
registerViz(brillouinZone);

/** 紧束缚模型。 */
const tightBinding = defineViz({
  slug: 'tight-binding', title: '紧束缚与能带', animated: true,
  params: {
    t: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: '跳跃积分 t（相对）' },
    N: { type: 'range', min: 2, max: 12, default: 8, step: 1, label: '原子数 N' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t0 = num(params, 't', 1);
    const N = Math.round(num(params, 'N', 8));
    clear(f);
    // 原子链
    const y0 = h * 0.32;
    const spacing = Math.min((w - 140) / Math.max(N - 1, 1), 70);
    const startX = w / 2 - ((N - 1) * spacing) / 2;
    for (let i = 0; i < N; i++) {
      const x = startX + i * spacing;
      dot(f, x, y0, 12, C.cool);
      if (i < N - 1) {
        // 跳跃（电子隧跳动画）
        seg(f, x + 14, y0, x + spacing - 14, y0, `${C.dim}aa`, 1.6);
        const ph = (f.t * 2 + i * 0.4) % 1;
        const hopX = x + 14 + ph * (spacing - 28);
        dot(f, hopX, y0, 5, C.warm);
      }
    }
    // 能带 E(k) = ε₀ − 2t cos(ka)
    const x0 = 70, yb0 = h - 66, yb1 = h * 0.5;
    const bw = 4 * t0;
    const kk: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const k = -Math.PI + (i / 200) * Math.PI * 2;
      const E = -2 * t0 * Math.cos(k);
      kk.push([x0 + (i / 200) * (w - 140), yb0 - ((E + 2 * t0) / (4 * t0)) * (yb0 - yb1)]);
    }
    poly(f, kk, { stroke: C.accent, lw: 2.8 });
    seg(f, x0 - 8, yb0, w - 60, yb0, C.grid, 1.3);
    text(f, `E(k) = ε₀ − 2t·cos(ka)：带宽 W = 4t = ${(4 * t0).toFixed(1)}`, 30, h - 26, { color: C.cyan, font: '13px sans-serif' });
    text(f, '孤立原子的分立能级 → 耦合成能带：N 个原子 N 条靠拢的线', 30, 44, { color: C.warm, font: '12px sans-serif' });
    void bw;

    footnotes(f, [
      '紧束缚从"电子基本局域在原子上"出发：跳跃积分 t 越大能带越宽、越导电',
      '能带论的开端（布洛赫 1928）：周期势中电子态是布洛赫波——金属/绝缘体之分',
      '半导体的带隙、掺杂能级、金属的费米面——全从这一张色散曲线生长出来',
    ]);
    heading(f, '紧束缚：原子能级长成能带');
  },
});
registerViz(tightBinding);

/** 费米面。 */
const fermiSurface = defineViz({
  slug: 'fermi-surface', title: '费米面', animated: true,
  params: {
    fill: { type: 'range', min: 0.1, max: 1.5, default: 0.7, step: 0.05, label: '电子填充度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fill = num(params, 'fill', 0.7);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.36;
    // 布里渊区（圆近似）+ 费米面
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 1.6; f.ctx.stroke();
    const kF = R * Math.min(fill, 1.05);
    // 电子占据（费米海）
    f.ctx.beginPath(); f.ctx.arc(cx, cy, Math.min(kF, R), 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(66,153,225,0.20)'; f.ctx.fill();
    // 费米面（正弦扰动：近自由电子的畸变）
    const pts: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.05) {
      const warp = 1 + 0.1 * Math.cos(4 * a) * (fill > 0.9 ? 1 : 0.3);
      const rr = Math.min(kF, R * 0.98) * warp;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    poly(f, [...pts, pts[0]], { stroke: C.warm, lw: 3 });
    // 表面电子活动
    for (let k = 0; k < 8; k++) {
      const a = f.t * 1.4 + (k / 8) * Math.PI * 2;
      dot(f, cx + Math.cos(a) * kF, cy + Math.sin(a) * kF, 4, C.cyan);
    }
    text(f, `k_F ∝ n^(1/3)：占据态（蓝）与空态的分界面——所有低温物理由它裁决`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '费米面形状（铜的"脖子"、铋的片层）决定电导、磁阻与振荡', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '绝对零度下电子从最低态逐级填充，到 k_F 为止——费米海与温度无关的"海岸线"',
      '只有费米面附近电子参与输运：比热、磁化率、德鲁德电导都 ∝ 态密度@E_F',
      'de Haas-van Alphen 振荡测绘费米面——金属物理的招牌实验（1930s）',
    ]);
    heading(f, '费米面：金属物性的分水岭');
  },
});
registerViz(fermiSurface);

/** 晶体缺陷。 */
const crystalDefect = defineViz({
  slug: 'crystal-defect', title: '晶体缺陷', animated: true,
  params: {
    kind: { type: 'select', options: ['空位与间隙', '位错线'], default: '空位与间隙', label: '缺陷' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const disloc = String((params as Record<string, unknown>)['kind'] ?? '').includes('位错');
    clear(f);
    const cell = 34;
    const cols = Math.floor((w - 80) / cell), rows = Math.floor((h - 130) / cell);
    const ox = (w - cols * cell) / 2, oy = 76;
    const missing = Math.floor(cols / 2) + Math.floor(rows / 2) * cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        let x = ox + c * cell + cell / 2;
        const y = oy + r * cell + cell / 2;
        if (disloc && r === Math.floor(rows / 2) && c > Math.floor(cols / 2)) {
          x += cell / 2; // 半原子面终止
        }
        if (!disloc && (idx === missing || idx === missing + 3)) continue; // 空位
        const wob = Math.sin(f.t * 2 + (r + c) * 0.7) * 1.4;
        dot(f, x + wob, y + wob * 0.6, 7, disloc && r === Math.floor(rows / 2) && c > cols / 2 ? C.warm : C.cool);
      }
    }
    if (!disloc) {
      // 间隙原子（挤在格点间）
      const gx = ox + (Math.floor(cols / 2) + 0.5) * cell;
      const gy = oy + (Math.floor(rows / 2) + 1.1) * cell;
      dot(f, gx + Math.sin(f.t * 4) * 3, gy, 8, C.warm);
      text(f, '间隙原子', gx + 14, gy + 4, { color: C.warm, font: '11px sans-serif' });
      text(f, '空位 + 间隙 = Frenkel 缺陷：扩散、掺杂、退火都靠缺陷', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      seg(f, ox + (Math.floor(cols / 2) + 0.5) * cell, oy - 8, ox + (Math.floor(cols / 2) + 0.5) * cell, oy + rows * cell + 8, `${C.hot}88`, 2);
      text(f, '刃位错：多出半原子面（红线）——滑移从这里开始', 30, 44, { color: C.hot, font: '13px sans-serif' });
      text(f, '位错密度决定金属强度：退火减少、冷加工增殖', 30, h - 34, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '完美晶体只存在于教科书：点缺陷（空位/间隙）与线缺陷（位错）无处不在',
      '位错滑移解释了金属为何比理论强度低 1000 倍——泰勒 1934 的洞察',
      '半导体靠受控缺陷（掺杂）获得导电性；高温超导的涡旋也被位错钉扎',
    ]);
    heading(f, '晶体缺陷：不完美成就功能');
  },
});
registerViz(crystalDefect);

/** 掺杂与半导体。 */
const doping = defineViz({
  slug: 'doping', title: '掺杂与半导体', animated: true,
  params: {
    kind: { type: 'select', options: ['n 型（磷掺硅）', 'p 型（硼掺硅）'], default: 'n 型（磷掺硅）', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pType = String((params as Record<string, unknown>)['kind'] ?? '').includes('p 型');
    clear(f);
    // 能带图
    const x0 = 70, yCon = h * 0.3, yVal = h * 0.72;
    seg(f, x0, yCon, w - 60, yCon, C.cool, 3.4);
    seg(f, x0, yVal, w - 60, yVal, C.warm, 3.4);
    text(f, '导带 E_C', x0 + 4, yCon - 12, { color: C.cool, font: '12px sans-serif' });
    text(f, '价带 E_V', x0 + 4, yVal + 22, { color: C.warm, font: '12px sans-serif' });
    // 带隙
    const Eg = yVal - yCon;
    text(f, `E_g = 1.12 eV（Si）`, w - 210, (yCon + yVal) / 2, { color: C.cyan, font: '13px sans-serif' });
    // 施主/受主能级
    const Ed = yCon + 14;
    const Ea = yVal - 14;
    if (!pType) {
      for (let k = 0; k < 4; k++) {
        const x = x0 + 70 + k * 76;
        seg(f, x - 22, Ed, x + 22, Ed, C.green, 2.6);
        // 电子激发动画
        const ph = (f.t * 0.8 + k * 0.25) % 1;
        if (ph < 0.5) dot(f, x, Ed - ph * 40, 5, C.green);
        else dot(f, x, yCon - 6, 5, C.cool);
      }
      text(f, '施主能级（紧贴导带）：多余电子易激发 → n 型（多子=电子）', 30, 44, { color: C.green, font: '13px sans-serif' });
    } else {
      for (let k = 0; k < 4; k++) {
        const x = x0 + 70 + k * 76;
        seg(f, x - 22, Ea, x + 22, Ea, C.hot, 2.6);
        const ph = (f.t * 0.8 + k * 0.25) % 1;
        if (ph < 0.5) dot(f, x, Ea + ph * 40, 5, C.hot);
        else dot(f, x, yVal + 6, 5, C.warm);
      }
      text(f, '受主能级（紧贴价带）：空穴易接收 → p 型（多子=空穴）', 30, 44, { color: C.hot, font: '13px sans-serif' });
    }
    text(f, 'p-n 结：内建电场+扩散平衡——二极管单向导电的全部秘密', 30, h - 34, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '每掺一个五价磷，硅多一个可动电子：10¹⁸/cm³ 的掺杂把电阻率改 10⁶ 倍',
      'p-n 结整流、BJT 放大、MOS 栅控——整个电子工业建立在掺杂调能级上',
      '离子注入与扩散炉是芯片制造的核心工序：摩尔定律的掺杂底座',
    ]);
    heading(f, '掺杂：用杂质驯服半导体');
  },
});
registerViz(doping);

/** 量子阱。 */
const quantumWell = defineViz({
  slug: 'quantum-well', title: '量子阱与限域能级', animated: true,
  params: {
    width: { type: 'range', min: 2, max: 20, default: 8, step: 1, label: '阱宽（nm）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nm = num(params, 'width', 8);
    const E1 = 1 / (nm * nm); // E ∝ 1/L²
    clear(f);
    const cx = w / 2, yBase = h - 90;
    const wellHalf = 40 + nm * 7;
    // 阱势
    const well: [number, number][] = [
      [cx - wellHalf - 60, yBase - 200], [cx - wellHalf, yBase - 200], [cx - wellHalf, yBase],
      [cx + wellHalf, yBase], [cx + wellHalf, yBase - 200], [cx + wellHalf + 60, yBase - 200],
    ];
    poly(f, well, { stroke: C.dim, lw: 2.6 });
    poly(f, [[cx - wellHalf, yBase], [cx + wellHalf, yBase], [cx + wellHalf, h - 40], [cx - wellHalf, h - 40]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.10)' } as any);
    // 限域能级与波函数
    const levels = Math.min(3, Math.floor(60 / nm) + 1);
    for (let n = 1; n <= Math.max(levels, 1); n++) {
      const En = n * n * E1 * 40;
      const y = yBase - 30 - En;
      if (y < 90) break;
      seg(f, cx - wellHalf + 6, y, cx + wellHalf - 6, y, C.warm, 2.4);
      const wave: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const x = cx - wellHalf + t * 2 * wellHalf;
        wave.push([x, y - Math.sin(n * Math.PI * t) * 16]);
      }
      poly(f, wave, { stroke: C.cool, lw: 1.8 });
      text(f, `E${n}`, cx + wellHalf + 10, y + 4, { color: C.warm, font: '11px sans-serif' });
    }
    // 电子跃迁发光
    const ph = (f.t * 0.7) % 1;
    if (ph < 0.5 && levels > 1) {
      const y1 = yBase - 30 - E1 * 40, y2 = yBase - 30 - 4 * E1 * 40;
      dot(f, cx, y1 - (y1 - y2) * (ph * 2), 6, C.cyan);
    }
    text(f, `阱宽 ${nm}nm → E_n ∝ 1/L²：越窄能级越开、发光波长越短`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '半导体异质结（AlGaAs/GaAs）把电子关进纳米盒——分立能级可按厚度设计',
      '量子阱激光器阈值电流低、波长可控——光通信、激光笔、光盘的光源',
      'QLED 显示器的量子点就是三维量子阱：尺寸调色的物理逻辑',
    ]);
    heading(f, '量子阱：按厚度设计发光');
  },
});
registerViz(quantumWell);

/** 石墨烯。 */
const graphene = defineViz({
  slug: 'graphene', title: '石墨烯与狄拉克锥', animated: true,
  params: {
    E: { type: 'range', min: -2, max: 2, default: 0, step: 0.1, label: '费米能级（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Ef = num(params, 'E', 0);
    clear(f);
    // 蜂窝晶格
    const s = Math.min(w, h) * 0.055;
    const cx = w * 0.28, cy = h / 2 + 6;
    for (let row = -4; row <= 4; row++) {
      for (let col = -4; col <= 4; col++) {
        const x0 = cx + col * s * 1.5;
        const y0 = cy + row * s * 1.73 + (col % 2 ? s * 0.86 : 0);
        if (Math.hypot(x0 - cx, y0 - cy) > Math.min(w, h) * 0.32) continue;
        // 六元环
        const pts: [number, number][] = [];
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          pts.push([x0 + s * 0.6 * Math.cos(a), y0 + s * 0.6 * Math.sin(a)]);
        }
        poly(f, [...pts, pts[0]], { stroke: `${C.cool}88`, lw: 1.6 });
        dot(f, x0 + s * 0.6, y0, 3, C.warm);
      }
    }
    // 狄拉克锥（右）
    const kx = w * 0.74, ky = h / 2 + 6;
    const coneH = Math.min(h * 0.3, 130);
    poly(f, [[kx - 90, ky + coneH], [kx, ky], [kx + 90, ky + coneH]], { stroke: C.cool, lw: 2.6 });
    poly(f, [[kx - 90, ky - coneH], [kx, ky], [kx + 90, ky - coneH]], { stroke: C.warm, lw: 2.6 });
    // 费米面（填充）
    const fillY = ky - Ef * coneH * 0.5;
    const half = Math.abs(fillY - ky) * (90 / coneH);
    poly(f, [[kx - half, fillY], [kx + half, fillY], [kx + Math.abs(fillY - ky) < 1 ? 0 : half * (coneH - Math.abs(fillY - ky)) / coneH, ky]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.18)' } as any);
    dot(f, kx, ky, 5, C.green);
    text(f, 'K 点：线性色散 E=ħv_F|k|——无质量狄拉克费米子', kx - 120, ky + coneH + 26, { color: C.green, font: '12px sans-serif' });
    text(f, '二维蜂巢晶格 + 最近邻跳跃 → 线性锥：电子跑出光速 1/300 的速度', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '2004 年盖姆与诺沃肖洛夫用胶带撕出石墨烯——首个稳定二维晶体（2010 诺奖）',
      '零带隙半金属：载流子呈赝自旋、可被栅压连续调谐——凝聚态的相对论实验室',
      '石墨烯晶体管、柔性透明电极与膜科学——从实验室胶带到产业化的十五年',
    ]);
    heading(f, '石墨烯：二维世界里的相对论');
  },
});
registerViz(graphene);

/** 安德森局域化。 */
const andersonLocalization = defineViz({
  slug: 'anderson-localization', title: '安德森局域化', animated: true,
  params: {
    W: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: '无序强度 W（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const W = num(params, 'W', 1);
    const localized = W > 2.4;
    clear(f);
    // 无序势场（随机柱）
    const n = 26;
    const x0 = 50, y0 = h - 70, barMax = h * 0.42;
    const rand = (i: number, k: number): number => Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i / (n - 1)) * (w - 100);
      const pot = rand(i, 1) * W * (barMax / 5);
      seg(f, x, y0, x, y0 - pot - 8, `${C.dim}aa`, 3);
    }
    // 波函数
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = i / 300;
      const x = x0 + t * (w - 100);
      const env = localized
        ? Math.exp(-Math.abs(t - 0.5) * (W * 4.5))
        : Math.abs(Math.sin(t * Math.PI * 6 + f.t)) * (0.75 + 0.25 * Math.sin(t * Math.PI * 3));
      const osc = Math.sin(t * 60 - f.t * 5);
      pts.push([x, y0 - barMax * 0.75 - osc * env * 46]);
    }
    poly(f, pts, { stroke: localized ? C.warm : C.green, lw: 2.6 });
    text(f, localized
      ? `W=${W.toFixed(1)}：波函数指数局域（e^(−|x−x₀|/ξ)）——电子被无序"冻"住 → 绝缘体`
      : `W=${W.toFixed(1)}：波函数延展态漫游全链 → 导体（扩散输运）`,
      30, 44, { color: localized ? C.warm : C.green, font: '14px sans-serif' });
    text(f, '1958 安德森：无序足以让扩展态消失——金属-绝缘体转变的量子解释', 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '相干多重散射在强无序下形成驻波——电子不再输运，电阻发散（三维有迁移率边）',
      '安德森局域化 1977 年获诺贝尔奖；一维任意无序皆局域的定理由 DMRG 精确验证',
      '光子与声子也有局域化：无序光子晶体、拓扑保护态的对照组',
    ]);
    heading(f, '安德森局域化：无序冻住量子扩散');
  },
});
registerViz(andersonLocalization);
