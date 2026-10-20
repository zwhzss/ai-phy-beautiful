import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text } from '../canvas';

/** 波长(nm) → 可见光颜色；紫外/红外用紫/深红提示。 */
function colorOf(nm: number): string {
  if (nm < 380) return '#9b59f0';           // 紫外
  if (nm > 750) return '#7a1f1f';           // 红外
  const t = (nm - 380) / (750 - 380);
  const hue = (1 - t) * 270;                // 紫(270) → 红(0)
  return `hsl(${hue}, 90%, 58%)`;
}

/** P20 氢原子能级与跃迁。 */
const atomicLevels = defineViz({
  slug: 'atomic-levels',
  title: '氢原子能级与跃迁',
  params: {
    series: { type: 'select', options: ['莱曼系 (→n=1)', '巴尔末系 (→n=2)', '帕邢系 (→n=3)'], default: '巴尔末系 (→n=2)', label: '线系' },
    nMax: { type: 'range', min: 3, max: 9, default: 6, step: 1, label: '最高能级 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const series = str(params, 'series', '巴尔末系 (→n=2)');
    const nMax = Math.round(num(params, 'nMax', 6));
    const nf = series.startsWith('莱曼') ? 1 : series.startsWith('帕邢') ? 3 : 2;
    const Ry = 13.6; // eV
    const E = (n: number): number => -Ry / (n * n);

    clear(f);
    const left = w * 0.16, right = w * 0.62;
    const top = 70, bottom = h - 78;
    // 能级：E=0 在顶部（连续区边界），E(nMax) 靠下
    const yOf = (En: number): number => {
      const eMin = E(nMax);
      return bottom - ((En - eMin) / (0 - eMin)) * (bottom - top);
    };
    // 连续区
    seg(f, left, yOf(0), right, yOf(0), `${C.dim}aa`, 1.4);
    text(f, 'n=∞ 电离 (E=0)', right + 8, yOf(0) + 4, { color: C.dim, font: '11px sans-serif' });
    // 能级横线
    for (let n = 1; n <= nMax; n++) {
      const y = yOf(E(n));
      seg(f, left, y, right, y, n === nf ? C.green : C.accent, n === nf ? 2.2 : 1.6);
      text(f, `n=${n}  ${E(n).toFixed(2)} eV`, left - 8, y + 4, { align: 'right', color: C.dim, font: '11px sans-serif' });
    }
    // 跃迁箭头
    const photonColors: string[] = [];
    for (let ni = nf + 1; ni <= nMax; ni++) {
      const y1 = yOf(E(ni));
      const y2 = yOf(E(nf));
      const x = left + ((ni - nf) / (nMax - nf + 1)) * (right - left) * 0.9 + 30;
      const dE = E(nf) - E(ni); // 光子能量（正）
      const lamNm = 1240 / Math.abs(dE); // hc ≈ 1240 eV·nm
      const col = colorOf(lamNm);
      photonColors.push(`${ni}→${nf}: λ=${lamNm.toFixed(0)} nm`);
      // 箭头（向下 = 发射）
      seg(f, x, y1, x, y2, col, 2.4);
      poly(f, [[x, y2], [x - 4, y2 + 9], [x + 4, y2 + 9]], { stroke: col, lw: 1.6, fill: col } as any);
      text(f, `${lamNm.toFixed(0)}`, x + 6, (y1 + y2) / 2, { color: col, font: '10px sans-serif' });
    }
    // 右侧：可见光区示意
    const barX = w * 0.72, barW = 40, barTop = top, barH = 180;
    for (let i = 0; i <= 60; i++) {
      const nm = 380 + (i / 60) * 370;
      f.ctx.fillStyle = colorOf(nm);
      f.ctx.fillRect(barX, barTop + (i / 60) * 0 + ((60 - i) / 60) * 0 + (barH * i) / 60, barW, barH / 60 + 1);
    }
    // 上紫外下红外标注
    f.ctx.fillStyle = '#9b59f0';
    f.ctx.fillRect(barX, barTop - 22, barW, 20);
    f.ctx.fillStyle = '#7a1f1f';
    f.ctx.fillRect(barX, barTop + barH + 4, barW, 20);
    text(f, '紫外', barX + barW / 2, barTop - 8, { align: 'center', color: '#fff', font: '11px sans-serif' });
    text(f, '可见', barX + barW / 2, barTop + barH / 2, { align: 'center', color: '#fff', font: '11px sans-serif' });
    text(f, '红外', barX + barW / 2, barTop + barH + 18, { align: 'center', color: '#fff', font: '11px sans-serif' });
    text(f, '400nm', barX + barW + 6, barTop + 12, { color: C.dim, font: '10px sans-serif' });
    text(f, '700nm', barX + barW + 6, barTop + barH - 4, { color: C.dim, font: '10px sans-serif' });

    footnotes(f, [
      `${series}：E_n = −13.6/n² eV，跃迁光子能量 ΔE = E_初 − E_末（λ = 1240/ΔE nm）`,
      photonColors.slice(0, 4).join('　'),
      nf === 2 ? '巴尔末系 4→2=656nm 红光（Hα）是天文光谱最常见的谱线：星云的红色由此而来' :
        nf === 1 ? '莱曼系全在紫外（<400nm）：宇宙学中用莱曼-α 阵列探测遥远星系' :
          '帕邢系在近红外：低温氢气体放电时肉眼不可见，需红外探测',
    ]);
    heading(f, '氢原子能级与光谱线');
  },
});
registerViz(atomicLevels);

/** P21 物质波与驻波条件。 */
const deBroglieWave = defineViz({
  slug: 'de-broglie-wave',
  title: '物质波与驻波条件',
  params: {
    n: { type: 'range', min: 1, max: 8, default: 3, step: 1, label: '主量子数 n' },
    Z: { type: 'range', min: 1, max: 4, default: 1, step: 1, label: '核电荷数 Z' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 3));
    const Z = Math.round(num(params, 'Z', 1));
    const a0 = 0.529; // Å
    const rn = (n * n * a0) / Z;          // 玻尔半径 (Å)
    const lambda = (2 * Math.PI * rn) / n; // 驻波条件 2πr = nλ

    clear(f);
    const cx = w * 0.34, cy = h / 2 + 6;
    const R = Math.min(w * 0.26, h * 0.34);
    // 圆轨道
    f.ctx.beginPath();
    f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}88`;
    f.ctx.lineWidth = 1.2;
    f.ctx.stroke();
    // 轨道上的驻波（径向位移 sin(nφ)）
    const wave: [number, number][] = [];
    for (let i = 0; i <= 360; i++) {
      const phi = (i / 360) * Math.PI * 2;
      const r = R + 12 * Math.sin(n * phi);
      wave.push([cx + r * Math.cos(phi), cy + r * Math.sin(phi)]);
    }
    poly(f, wave, { stroke: C.accent, lw: 2.4 });
    // 核与电子
    dot(f, cx, cy, 7, C.hot);
    text(f, `+${Z}`, cx, cy + 4, { align: 'center', color: '#fff', font: '11px sans-serif' });
    const ePhi = (f.t * 0.9) % (Math.PI * 2);
    dot(f, cx + R * Math.cos(ePhi), cy + R * Math.sin(ePhi), 6, C.cool);
    // 波形周数
    text(f, `圆周上恰有 ${n} 个完整波`, cx, cy + R + 34, { align: 'center', color: C.accent, font: '12px sans-serif' });

    // 右侧读数面板
    const tx = w * 0.64, ty = h * 0.3;
    text(f, `玻尔半径 rₙ = n²·a₀/Z = ${rn.toFixed(3)} Å`, tx, ty, { color: C.fg, font: '14px sans-serif' });
    text(f, `驻波条件 2πr = nλ ⇒ λ = 2πrₙ/n = ${lambda.toFixed(3)} Å`, tx, ty + 26, { color: C.accent, font: '14px sans-serif' });
    text(f, `德布罗意 λ = h/p = h/(mv)`, tx, ty + 56, { color: C.cyan, font: '13px sans-serif' });
    text(f, `速度 v = 2πk/(n·m·?) … v = √(kZ e²/(m·r))`, tx, ty + 82, { color: C.dim, font: '12px sans-serif' });
    // 半径随 n² 增长
    const pts: [number, number][] = [];
    const bx = w * 0.64, by = h - 66, bw = w * 0.3, bh = 74;
    for (let i = 0; i <= 60; i++) {
      const nn = 1 + (i / 60) * 8;
      pts.push([bx + (i / 60) * bw, by - ((nn * nn) / 64) * bh]);
    }
    poly(f, pts, { stroke: C.warm, lw: 2 });
    text(f, 'rₙ ∝ n²', bx + bw - 4, by - bh - 6, { align: 'right', color: C.warm, font: '11px sans-serif' });
    seg(f, bx, by, bx + bw, by, C.grid, 1.2);

    footnotes(f, [
      '只有满足 2πr = nλ 的轨道才能形成稳定驻波 —— 玻尔"量子化条件"的波动解释（量子数 n 由此而来）',
      '德布罗意 1924：λ = h/p，1927 年电子衍射实验证实；粒子性与波动性是同一实体的两面',
      '驻波条件自动给出角动量 L = mvr = n·ħ —— 量子化不是人为规定，而是波动的自然结果',
    ]);
    heading(f, '物质波：圆轨道驻波与量子化');
  },
});
registerViz(deBroglieWave);
