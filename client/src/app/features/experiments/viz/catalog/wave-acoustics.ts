import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, curve, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** P58 驻波与管乐器。 */
const standingPipe = defineViz({
  slug: 'standing-pipe', title: '驻波与管乐器', animated: true,
  params: {
    pipe: { type: 'select', options: ['开管（两端开口）', '闭管（一端封闭）'], default: '开管（两端开口）', label: '管型' },
    open: { type: 'range', min: 0.2, max: 1, default: 0.6, step: 0.05, label: '开孔位置（管长比例）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const open = str(params, 'pipe', '开管（两端开口）').startsWith('开');
    const hole = num(params, 'open', 0.6);
    clear(f);
    const x0 = 70, x1 = w - 70, pipeY = h * 0.34, thick = 46;
    // 管体
    poly(f, [[x0, pipeY - thick / 2], [x1, pipeY - thick / 2], [x1, pipeY + thick / 2], [x0, pipeY + thick / 2]],
      { stroke: C.dim, lw: 2, fill: 'rgba(148,163,184,0.12)' } as any);
    // 有效长度（开孔改变基频）
    const eff = x0 + (x1 - x0) * hole;
    seg(f, eff, pipeY - thick / 2 - 8, eff, pipeY + thick / 2 + 8, C.hot, 2.4);
    text(f, '开孔≈缩短有效管长', eff + 6, pipeY - thick / 2 - 14, { color: C.hot, font: '11px sans-serif' });
    // 驻波包络（基频）
    const A = 26, k = (open ? Math.PI : Math.PI * 0.5) / Math.max((x1 - x0), 1) * (open ? 1 : 1);
    const mode = open ? (x: number) => Math.sin(((x - x0) * Math.PI * 2) / ((x1 - x0) * 2)) : (x: number) => Math.sin(((x - x0) * Math.PI) / ((x1 - x0) * 2));
    for (const s of [1, -1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 140; i++) {
        const x = x0 + (i / 140) * (x1 - x0);
        pts.push([x, pipeY + s * mode(x) * A]);
      }
      poly(f, pts, { stroke: s > 0 ? C.cool : `${C.cool}77`, lw: 2.2, dash: s > 0 ? undefined : [5, 4] } as any);
    }
    void k;
    // 波腹标记
    for (let n = 0; n <= 2; n++) {
      const x = x0 + (open ? n * (x1 - x0) : (n + 0.5) * (x1 - x0) / 2);
      if (x <= x1) dot(f, x, pipeY, 4, C.warm);
    }
    text(f, `基频 f₁ = v/${open ? '2L' : '4L'}（${open ? '开管' : '闭管'}）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '两端开口：两端是波腹；一端封闭：闭端是波节——边界条件决定谐波序列',
      '开管发所有谐波（亮音色），闭管只发奇次谐波（单簧管的圆润音色来源）',
      '按住笛孔等于把有效管长变短、频率升高——乐器演奏就是改变边界条件',
    ]);
    heading(f, '驻波管：声音的边界条件');
  },
});
registerViz(standingPipe);

/** P59 拍频。 */
const beats = defineViz({
  slug: 'beats', title: '拍频', animated: true,
  params: {
    f1: { type: 'range', min: 400, max: 460, default: 440, step: 1, label: '音叉 A 频率 (Hz)' },
    f2: { type: 'range', min: 400, max: 460, default: 444, step: 1, label: '音叉 B 频率 (Hz)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const f1 = num(params, 'f1', 440), f2 = num(params, 'f2', 444);
    const beat = Math.abs(f1 - f2);
    clear(f);
    const x0 = 50, x1 = w - 30, mid = h / 2 + 6;
    // 叠加波（低频包络可视化：缩放到拍周期）
    const scale = 0.02; // 视觉时间缩放
    const pts: [number, number][] = [];
    for (let i = 0; i <= 600; i++) {
      const t = (i / 600) * 4 * scale;
      const v = Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t);
      pts.push([x0 + (i / 600) * (x1 - x0), mid - v * (h * 0.16)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 1.6 });
    // 包络线 ±2cos(πΔf t)
    for (const s of [1, -1]) {
      const env: [number, number][] = [];
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * 4 * scale;
        env.push([x0 + (i / 200) * (x1 - x0), mid - s * 2 * Math.cos(Math.PI * beat * t) * (h * 0.16)]);
      }
      poly(f, env, { stroke: `${C.warm}aa`, lw: 1.4, dash: [6, 4] } as any);
    }
    seg(f, x0, mid, x1, mid, `${C.grid}aa`, 1);
    text(f, `拍频 = |f₁−f₂| = ${beat} Hz — 每秒强弱 ${beat} 次`, 30, 44, { color: C.warm, font: '14px sans-serif' });

    footnotes(f, [
      '两列近频率波叠加，相位差周期性走过同相（强）与反相（弱）——包络即拍',
      '乐器调音就是听拍：拍频归零即同音高；钢琴调律靠八度加五度的拍频校准',
      "若 f₁=f₂=440Hz，两音叉合起来却像一个会'喘气'的声音——相位差的听觉写照",
    ]);
    heading(f, '拍频：两个频率的对话');
  },
});
registerViz(beats);

/** P60 声速与温度。 */
const soundSpeed = defineViz({
  slug: 'sound-speed', title: '声速与温度',
  params: {
    T: { type: 'range', min: -40, max: 60, default: 15, step: 1, label: '空气温度 (℃)' },
    medium: { type: 'select', options: ['空气', '水', '钢铁'], default: '空气', label: '介质' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Tc = num(params, 'T', 15);
    const medium = str(params, 'medium', '空气');
    const v = medium === '空气' ? 331.3 * Math.sqrt(1 + Tc / 273.15) : medium === '水' ? 1497 : 5960;
    const mach = (340 / v).toFixed(2);
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: -40, xMax: 60, yMin: medium === '空气' ? 300 : 0, yMax: medium === '空气' ? 380 : 6500, inset: 46 });
    grid(f, vv, { divisions: 5, ticks: true });
    if (medium === '空气') {
      curve(f, vv, (t) => 331.3 * Math.sqrt(1 + t / 273.15), { color: C.accent, lw: 2.6, samples: 200 });
      dot(f, vv.sx(Tc), vv.sy(v), 7, C.warm);
      text(f, `${v.toFixed(1)} m/s`, vv.sx(Tc) + 10, vv.sy(v) - 10, { color: C.warm, font: '13px sans-serif' });
    } else {
      seg(f, vv.sx(-40), vv.sy(v), vv.sx(60), vv.sy(v), C.accent, 2.6);
      dot(f, vv.sx(Tc), vv.sy(v), 7, C.warm);
      text(f, `${v.toFixed(0)} m/s（近似常数）`, vv.sx(0), vv.sy(v) - 12, { color: C.warm, font: '13px sans-serif' });
    }
    void x0; void x1; void y0; void y1;
    text(f, '温度 (℃)', vv.sx(vv.xMax) - 4, vv.sy(vv.yMin) + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `15℃ 空气声速约 343 m/s ≈ Mach ${mach}；温度每升 1℃ 声速约增 0.6 m/s`,
      '声速由介质弹性与密度决定：钢铁中约 5960 m/s，水中约 1497 m/s',
      '超音速后波面堆积成激波——音爆的马赫锥角由 v/c_s 给出',
    ]);
    heading(f, '声速：温度与介质');
  },
});
registerViz(soundSpeed);

/** P61 声波多普勒效应。 */
const dopplerWave = defineViz({
  slug: 'doppler-wave', title: '声波多普勒效应', animated: true,
  params: {
    vs: { type: 'range', min: -80, max: 80, default: 45, step: 5, label: '声源速度 (m/s，负=远离)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const vs = num(params, 'vs', 45);
    const moving = Math.abs(vs) > 1;
    const toward = vs > 0;
    clear(f);
    // 声源轨迹（左→右）
    const sx = ((f.t * (0.3 + Math.abs(vs) / 100) * 0.4) % 1);
    const srcX = 60 + sx * (w - 120);
    const cy = h * 0.42;
    // 波面圆（历史波前，向前密集/向后稀疏）
    const speed = 260;
    for (let n = 0; n < 7; n++) {
      const age = ((f.t * 0.5 + n / 7) % 1) * 3.4;
      const originX = srcX - (moving ? vs * age * 1.6 : 0);
      const r = age * 68;
      if (r < 4) continue;
      const alpha = Math.max(0.08, 0.6 - age * 0.15);
      f.ctx.beginPath();
      f.ctx.arc(originX, cy, r, 0, Math.PI * 2);
      f.ctx.strokeStyle = `rgba(102,126,234,${alpha})`;
      f.ctx.lineWidth = 2;
      f.ctx.stroke();
    }
    dot(f, srcX, cy, 10, C.warm);
    text(f, `声源${moving ? (toward ? '向右接近 → 前方波面变密（音调变高）' : '向右远离 → 后方波面变疏（音调变低）') : '静止 — 各方向波面均匀'}`,
      30, 44, { color: C.warm, font: '13px sans-serif' });
    text(f, `v_s = ${vs} m/s，f' = f·c/(c∓v_s)`, 30, h - 40, { color: C.cyan, font: '12px sans-serif' });
    // 观察者
    dot(f, w - 70, cy + 6, 8, C.green);
    text(f, '观察者', w - 70, cy + 30, { align: 'center', color: C.green, font: '11px sans-serif' });

    footnotes(f, [
      "波前是声源'过去位置'画的圆：向前挤则波长变短频率升高，向后拉则相反",
      '救护车、赛车的音调变化，与星系红移的红移公式在本质上是同一个效应',
      '超音速时波面追不上——形成马赫锥，地面听到的音爆正是锥面扫过的一瞬',
    ]);
    heading(f, '声波多普勒：波面的挤压与拉伸');
  },
});
registerViz(dopplerWave);

/** P62 激波与马赫锥。 */
const shockWave = defineViz({
  slug: 'shock-wave', title: '激波与马赫锥', animated: true,
  params: {
    M: { type: 'range', min: 0.5, max: 3, default: 1.6, step: 0.1, label: '马赫数 M = v/c_s' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'M', 1.6);
    const supersonic = M > 1;
    clear(f);
    const cx = w * 0.34, cy = h / 2 + 6;
    // 飞行器
    poly(f, [[cx - 34, cy], [cx + 34, cy - 10], [cx + 34, cy + 10]], { stroke: C.warm, lw: 2, fill: 'rgba(237,137,54,0.4)' } as any);
    text(f, `M = ${M}`, cx - 30, cy - 34, { color: C.warm, font: '14px sans-serif' });
    if (supersonic) {
      // 马赫锥（两条斜线 + 锥内波纹）
      const mu = Math.asin(1 / M);
      const L = Math.min(w, h) * 0.52;
      for (const s of [1, -1]) {
        seg(f, cx, cy, cx - L * Math.cos(mu * 0.001), cy + s * L * Math.sin(mu), `${C.hot}cc`, 2.6);
        seg(f, cx, cy, cx - L, cy + s * L * Math.tan(mu), `${C.hot}cc`, 2.6);
      }
      for (let k = 1; k <= 4; k++) {
        const rr = k * 62;
        const a = rr * Math.tan(mu);
        const arc: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const th = -Math.PI / 2 + (i / 40) * Math.PI;
          arc.push([cx + Math.cos(th) * rr * 0.6, cy + Math.sin(th) * a]);
        }
        poly(f, arc, { stroke: `${C.cyan}55`, lw: 1.4 } as any);
      }
      text(f, `马赫角 μ = arcsin(1/M) = ${((mu * 180) / Math.PI).toFixed(1)}°`, 30, 44, { color: C.hot, font: '13px sans-serif' });
      text(f, '锥面掠过地面 → 音爆', cx + 60, cy + Math.tan(mu) * (Math.min(w, h) * 0.52) - 8, { color: C.cyan, font: '12px sans-serif' });
    } else {
      for (let k = 1; k <= 5; k++) {
        const rr = ((f.t * 90 + k * 60) % 300) + 20;
        f.ctx.beginPath(); f.ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        f.ctx.strokeStyle = `rgba(102,126,234,${Math.max(0.1, 0.55 - rr / 400)})`;
        f.ctx.lineWidth = 1.8; f.ctx.stroke();
      }
      text(f, '亚音速：波面超出声源，四面八方都能听见', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }

    footnotes(f, [
      '马赫锥母线是波前的包络：锥角只由马赫数决定，与飞行高度无关',
      '超音速投影、协和客机的音爆、爆炸的冲击波——同一几何的不同尺度',
      'M>1 时信息无法前传：飞行员听不见自己的音爆，地面却会被它击中',
    ]);
    heading(f, '激波与马赫锥');
  },
});
registerViz(shockWave);

/** P63 孤子。 */
const soliton = defineViz({
  slug: 'soliton', title: '孤子', animated: true,
  params: {
    amp: { type: 'range', min: 0.3, max: 1.5, default: 1, step: 0.1, label: '振幅（相对）' },
    collide: { type: 'select', options: ['单孤子行进', '双孤子相撞（互穿）'], default: '单孤子行进', label: '模式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const A = num(params, 'amp', 1);
    const two = str(params, 'collide', '单孤子行进').includes('双');
    clear(f);
    const x0 = 46, x1 = w - 30, mid = h / 2 + 6;
    seg(f, x0, mid, x1, mid, `${C.grid}aa`, 1);
    const sech = (x: number): number => 1 / Math.cosh(x);
    const wave: [number, number][] = [];
    const wave2: [number, number][] = [];
    const span = (x1 - x0);
    const t = (f.t * 0.5) % 4;
    if (two) {
      const c1 = x0 + ((t * 0.9) % 1) * span;
      const c2 = x1 - ((((t * 0.9) % 1)) * span);
      for (let i = 0; i <= 300; i++) {
        const x = x0 + (i / 300) * span;
        const v = A * 90 * sech((x - c1) / 42) + A * 90 * sech((x - c2) / 42);
        wave.push([x, mid - v]);
      }
    } else {
      const c = x0 + ((t * 0.8) % 1) * span;
      for (let i = 0; i <= 300; i++) {
        const x = x0 + (i / 300) * span;
        wave.push([x, mid - A * 90 * sech((x - c) / 46)]);
      }
    }
    poly(f, wave, { stroke: C.accent, lw: 2.8 });
    void wave2;
    text(f, two ? '相撞后各自穿过、形状与速度不变 — 非线性与色散精确抵消' : 'h(x,t) = A·sech²(x−ct)：形状永不变形地行进',
      30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      'KdV 方程的解：非线性让波变陡、色散让波摊平，两力平衡即孤子',
      "1834 年罗素在运河边看见'水丘'跑了几公里——1965 年才被方程严格解出",
      '光纤中的光孤子支撑跨洋通信；玻色-爱因斯坦凝聚里也能观察到物质波孤子',
    ]);
    heading(f, '孤子：不变形的波包');
  },
});
registerViz(soliton);

/** P64 受迫振动与共振。 */
const resonanceForced = defineViz({
  slug: 'resonance-forced', title: '受迫振动与共振', animated: true,
  params: {
    drive: { type: 'range', min: 0.2, max: 2.5, default: 1, step: 0.05, label: '驱动频率/固有频率' },
    damping: { type: 'range', min: 0.05, max: 0.6, default: 0.15, step: 0.05, label: '阻尼比 ζ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const wd = num(params, 'drive', 1);
    const zeta = num(params, 'damping', 0.15);
    const ampl = 1 / Math.sqrt(Math.pow(1 - wd * wd, 2) + Math.pow(2 * zeta * wd, 2));
    clear(f);
    // 幅频响应曲线
    const x0 = 56, x1 = w - 30, y0 = h - 60, y1 = 56;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, y0, x0, y1, C.grid, 1.3);
    const sx = (r: number) => x0 + (r / 2.5) * (x1 - x0);
    const sy = (A: number) => y0 - Math.min(A, 6) / 6 * (y0 - y1);
    const pts: [number, number][] = [];
    for (let i = 1; i <= 240; i++) {
      const r = (i / 240) * 2.5;
      const A = 1 / Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(2 * zeta * r, 2));
      pts.push([sx(r), sy(A)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // 共振峰标记（r = √(1-2ζ²)）
    const peak = Math.sqrt(Math.max(1 - 2 * zeta * zeta, 0));
    if (peak > 0.05) {
      seg(f, sx(peak), y0, sx(peak), y1, `${C.green}77`, 1.3);
      text(f, '共振峰', sx(peak) + 6, y1 + 12, { color: C.green, font: '11px sans-serif' });
    }
    dot(f, sx(wd), sy(ampl), 7, C.warm);
    text(f, `放大倍数 Q ≈ ${ampl.toFixed(2)}`, sx(wd) + 10, sy(ampl) - 8, { color: C.warm, font: '13px sans-serif' });
    text(f, '驱动频率比', x1 - 4, y0 + 18, { align: 'right', color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `阻尼比 ζ=${zeta}：阻尼越小共振峰越尖——${zeta < 0.2 ? '危险的锐峰，微小失谐也能积累大幅振动' : '较宽的峰，工程上常刻意加大阻尼'}`,
      "桥梁、高楼、天线塔都按'避开共振频率'设计；军队过桥要便步走就是这个道理",
      '乐器与收音机恰恰相反——它们要把共振峰调到目标频率上',
    ]);
    heading(f, '受迫振动：共振的放大与规避');
  },
});
registerViz(resonanceForced);

/** P65 波的色散。 */
const dispersion = defineViz({
  slug: 'dispersion', title: '波的色散', animated: true,
  params: {
    kind: { type: 'select', options: ['正常色散（水）', '反常色散（共振区）'], default: '正常色散（水）', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const normal = str(params, 'kind', '正常色散（水）').startsWith('正常');
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 60, y1 = 56;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, y0, x0, y1, C.grid, 1.3);
    const sx = (x: number) => x0 + ((x - 400) / 400) * (x1 - x0);
    // 相速度色散曲线（示意）：正常 v 随频率增而降；共振区翻转
    const vp = (nm: number): number => {
      if (normal) return 1.33 + 0.02 * (600 / nm - 1);
      const res = 500;
      return 1.33 + 0.12 / ((nm - res) / 20 + 0.001) * 0.02;
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const nm = 400 + (i / 240) * 400;
      const v = Math.max(1.2, Math.min(1.6, vp(nm)));
      pts.push([sx(nm), y0 - ((v - 1.2) / 0.4) * (y0 - y1) * 0.9]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    if (!normal) seg(f, sx(500), y1, sx(500), y0, `${C.hot}88`, 1.4);
    // 脉冲展宽示意
    text(f, normal ? '蓝光相速低于红光 → 棱镜中蓝光偏折更多' : '共振区附近折射率剧变 → 相速反常', 30, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '波长 (nm)', x1 - 4, y0 + 18, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, '相速 v_p', x0 + 6, y1 - 6, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      '色散 = 不同频率传播速度不同：白光因此被棱镜展开成彩虹',
      '光纤通信必须工作在色散最小的窗口（1550nm），否则脉冲展宽限制带宽',
      '反常色散出现在吸收线附近——介质共振与入射光频率共舞的印记',
    ]);
    heading(f, '色散：频率决定速度');
  },
});
registerViz(dispersion);
