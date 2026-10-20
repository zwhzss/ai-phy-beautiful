import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 法布里-珀罗干涉仪。 */
const fabryPerot = defineViz({
  slug: 'fabry-perot', title: '法布里-珀罗干涉仪', animated: true,
  params: {
    R: { type: 'range', min: 0.5, max: 0.98, default: 0.9, step: 0.02, label: '反射率 R' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const refl = num(params, 'R', 0.9);
    const finesse = Math.PI * Math.sqrt(refl) / (1 - refl);
    clear(f);
    // 平行板腔（多光束）
    const cx = w * 0.3, yTop = h * 0.24, yBot = h * 0.68;
    seg(f, cx - 60, yTop, cx + 60, yTop, C.cool, 5);
    seg(f, cx - 60, yBot, cx + 60, yBot, C.cool, 5);
    text(f, `高反膜 R=${refl}`, cx - 44, yTop - 14, { color: C.cool, font: '11px sans-serif' });
    // 多光束（来回反射的光线扇）
    const inY = yTop + 26;
    seg(f, 40, inY - 40, cx - 56, inY, C.hot, 2.4);
    let yy = inY;
    for (let k = 0; k < 7; k++) {
      const yNext = yy + (yBot - yTop) * 0.16;
      seg(f, cx - 56, yy, cx + 56, yNext, `rgba(255,170,80,${0.9 - k * 0.1})`, 1.8);
      seg(f, cx + 56, yNext, cx - 56, yNext + (yBot - yTop) * 0.16, `rgba(255,170,80,${0.8 - k * 0.1})`, 1.8);
      yy = yNext + (yBot - yTop) * 0.16;
      if (yy > yBot) break;
      // 出射光束
      seg(f, cx - 56, yy, cx - 56 - 70, yy + 34, `rgba(16,185,129,${0.8 - k * 0.09})`, 1.8);
    }
    // 透射峰（右下角）
    const x0 = w * 0.62, y0 = h - 56, y1 = h * 0.56;
    seg(f, x0, y0, w - 40, y0, C.grid, 1.2);
    seg(f, x0, y0, x0, y1, C.grid, 1.2);
    const air: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const phi = (i / 300) * Math.PI * 6;
      const T0 = Math.pow(1 - refl, 2) / Math.pow(1 - refl, 2 + 2 * refl * Math.cos(phi));
      const phase = i * 0.02 + f.t * 3;
      air.push([x0 + (i / 300) * (w - 40 - x0), y0 - Math.min(T0 * (0.75 + 0.25 * Math.sin(phase)), 1) * (y0 - y1)]);
    }
    poly(f, air, { stroke: C.green, lw: 2.4 });
    text(f, `精细度 F≈${finesse.toFixed(0)}：${finesse > 15 ? '透射峰极锐——高分辨光谱的利器' : '峰较宽（反射率不足）'}`,
      x0 + 6, y1 - 8, { color: C.green, font: '12px sans-serif' });
    text(f, '多光束干涉：无穷级反射的等振幅叠加把峰磨尖', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      'Airy 函数透射谱：反射率越高 finesse 越大、峰越细——分辨率可达 GHz 级',
      '激光谐振腔就是 F-P：纵模间隔 c/2L，选频与稳频皆靠它',
      'LIGO 的 4km 臂本质是巨型 F-P 腔（增强腔提高有效光程）',
    ]);
    heading(f, '法布里-珀罗：多光束把峰磨尖');
  },
});
registerViz(fabryPerot);

/** 菲涅耳双棱镜。 */
const fresnelBiprism = defineViz({
  slug: 'fresnel-biprism', title: '菲涅耳双棱镜', animated: true,
  params: {
    lam: { type: 'range', min: 400, max: 700, default: 633, step: 10, label: '波长 (nm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lam = num(params, 'lam', 633);
    const hue = ((lam - 400) / 300) * 240;
    const color = `hsl(${360 - hue},85%,60%)`;
    clear(f);
    const yMid = h / 2 + 6;
    // 点源
    dot(f, w * 0.1, yMid, 7, C.warm);
    text(f, 'S', w * 0.1 - 6, yMid - 16, { color: C.warm, font: '13px sans-serif' });
    // 双棱镜（两个薄楔）
    const bx = w * 0.38;
    poly(f, [[bx, yMid - 8], [bx + 34, yMid - 60], [bx + 34, yMid - 8]], { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.25)' } as any);
    poly(f, [[bx, yMid + 8], [bx + 34, yMid + 60], [bx + 34, yMid + 8]], { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.25)' } as any);
    // 上下两束光（虚光源干涉）
    seg(f, w * 0.1, yMid, bx, yMid - 6, color, 2);
    const vS1Y = yMid - 66, vS2Y = yMid + 66;
    seg(f, bx + 34, yMid - 40, w * 0.62, vS1Y, `${color}cc`, 1.8);
    seg(f, bx + 34, yMid + 40, w * 0.62, vS2Y, `${color}cc`, 1.8);
    seg(f, w * 0.62, vS1Y, w * 0.86, yMid - 30, `${color}cc`, 1.6);
    seg(f, w * 0.62, vS2Y, w * 0.86, yMid + 30, `${color}cc`, 1.6);
    // 虚光源
    dot(f, w * 0.62, vS1Y, 5, `${color}aa`);
    dot(f, w * 0.62, vS2Y, 5, `${color}aa`);
    text(f, '虚光源 S₁、S₂', w * 0.62 + 10, vS1Y - 10, { color: C.dim, font: '11px sans-serif' });
    // 屏与条纹
    const sx = w * 0.88;
    seg(f, sx, yMid - 80, sx, yMid + 80, C.dim, 3);
    for (let k = -7; k <= 7; k++) {
      const yy = yMid + k * 11;
      const a = Math.cos(k * 1.7) ** 2;
      poly(f, [[sx, yy - 4], [sx + 14, yy - 4], [sx + 14, yy + 4], [sx, yy + 4]],
        { stroke: 'transparent', fill: `rgba(255,255,255,${0.15 + a * 0.8})` } as any);
    }
    text(f, `λ=${lam}nm：一个点源被劈成两个相干虚源——分波前干涉的教科书`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '菲涅耳用两块薄楔把波前一分为二——杨氏双缝之外的第三种经典干涉方案',
      '条纹间距 Δy=λD/d：测间距即测波长——19 世纪光学计量的基准法',
      '镜子半波损失的相位突变在双棱镜中同样可见——半波损失的直接观测位',
    ]);
    heading(f, '菲涅耳双棱镜：劈开波前');
  },
});
registerViz(fresnelBiprism);

/** 菲涅耳波带片。 */
const zonePlate = defineViz({
  slug: 'zone-plate', title: '菲涅耳波带片', animated: true,
  params: {
    n: { type: 'range', min: 3, max: 12, default: 7, step: 1, label: '波带数 N' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'n', 7));
    clear(f);
    const cx = w * 0.34, cy = h / 2 + 6;
    // 同心环（透明/遮挡交替）
    for (let k = N; k >= 1; k--) {
      const r = Math.sqrt(k) * 26;
      f.ctx.beginPath(); f.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      f.ctx.fillStyle = k % 2 === 0 ? 'rgba(66,153,225,0.5)' : 'rgba(10,10,30,0.55)';
      f.ctx.fill();
      f.ctx.strokeStyle = `${C.cool}66`; f.ctx.lineWidth = 1; f.ctx.stroke();
    }
    dot(f, cx, cy, 4, C.warm);
    text(f, `半径 r_k = √(k·λ·f)：遮去偶数带 → 中心亮斑（无透镜聚焦）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 焦点与会聚
    const fx = w * 0.72;
    for (let k = -3; k <= 3; k++) {
      seg(f, cx + 60, cy + k * 34, fx, cy, `rgba(16,185,129,${0.35 + Math.abs(k) * 0.1})`, 1.6);
    }
    const pulse = 0.7 + 0.3 * Math.sin(f.t * 4);
    dot(f, fx, cy, 9, `rgba(255,250,200,${pulse})`);
    text(f, '焦点', fx - 14, cy + 26, { color: '#fffbeb', font: '11px sans-serif' });
    // 一二级衍射
    text(f, `N=${N}：每个透光带的子波在焦点同相叠加——菲涅耳半波带法的实体化`, 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '波带片是无透镜的聚焦元件：X 射线无法用玻璃聚焦，波带片是软 X 射线显微镜的物镜',
      '相位波带片（全部透光、相位差 π）效率高十倍——同步辐射与 EUV 光刻的关键件',
      "它把衍射从'限制“变成”工具'——菲涅耳理论的工程化身",
    ]);
    heading(f, '波带片：用衍射聚焦');
  },
});
registerViz(zonePlate);

/** 相干长度与时间相干性。 */
const coherenceLength = defineViz({
  slug: 'coherence-length', title: '相干长度', animated: true,
  params: {
    lam: { type: 'range', min: 0.2, max: 10, default: 1, step: 0.1, label: '谱宽 Δλ（窄←→宽，相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dlam = num(params, 'lam', 1);
    const lCoh = 1 / dlam; // 相干长度 ∝ λ²/Δλ
    const sinc = (x: number): number => (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
    clear(f);
    const x0 = 60, y0 = h - 56, y1 = 64;
    const vv = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.2, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 干涉条纹可见度（包络）
    const vis: [number, number][] = [];
    const fring: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const d = (i / 400) * 10;
      const env = Math.abs(sinc(d / Math.max(lCoh, 0.2)));
      vis.push([vv.sx(d), vv.sy(env * 0.92)]);
      fring.push([vv.sx(d), vv.sy(env * 0.92 * (0.5 + 0.5 * Math.cos(d * 6 + f.t * 0.5)))]);
    }
    poly(f, fring, { stroke: `${C.cool}aa`, lw: 1.4 });
    poly(f, vis, { stroke: C.warm, lw: 2.6, dash: [7, 5] } as any);
    // 相干长度标记
    const lc = Math.min(lCoh, 10);
    seg(f, vv.sx(0), vv.sy(0.37), vv.sx(lc), vv.sy(0.37), C.green, 2);
    text(f, `L_c ≈ λ²/Δλ = ${lc.toFixed(1)}（相对）`, vv.sx(lc) + 8, vv.sy(0.37) - 8, { color: C.green, font: '12px sans-serif' });
    void x0; void y0; void y1;
    text(f, `Δλ=${dlam.toFixed(1)}：${dlam < 1.5 ? '窄谱（激光级）——包络长、可产生长程干涉' : '宽谱（白光级）——几微米外条纹消失'}`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '时间相干性=谱宽的倒数：白光条纹只有几条、氦氖激光可达数百米——同一几何的天壤之别',
      "迈克尔逊测恒星角直径就是找'可见度归零'的臂长差——傅里叶光谱学的原型",
      '光学相干断层扫描（OCT）用低相干光的包络定位组织深度——眼科成像的主力',
    ]);
    heading(f, '相干长度：条纹能走多远');
  },
});
registerViz(coherenceLength);
