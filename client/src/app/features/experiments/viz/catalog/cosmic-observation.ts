import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng } from '../canvas';

/** 折射望远镜。 */
const refractingTelescope = defineViz({
  slug: 'refracting-telescope', title: '折射望远镜', animated: true,
  params: { mag: { type: 'range', min: 10, max: 120, default: 40, step: 5, label: '放大率 (×)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mag = num(params, 'mag', 40);
    clear(f);
    const axY = h * 0.5;
    const objX = 60, objX2 = w - 190, eyeX = w - 60;
    // 光轴
    seg(f, objX, axY, eyeX, axY, `${C.grid}aa`, 1);
    // 物镜（左）与目镜（右）
    circle(f, objX + 14, axY, 54, { stroke: C.cool, lw: 3 });
    circle(f, objX + 14, axY, 54, { stroke: `${C.cool}44`, lw: 8 });
    text(f, '物镜 D', objX - 4, axY + 74, { color: C.cool, font: '12px sans-serif' });
    circle(f, eyeX - 60, axY, 22, { stroke: C.green, lw: 3 });
    text(f, '目镜', eyeX - 74, axY + 46, { color: C.green, font: '12px sans-serif' });
    // 平行光 → 汇聚到焦点 → 目镜准直
    const focusX = objX + 14 + 200;
    const off = 34;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
    for (const s of [-1, 1]) {
      seg(f, objX + 20, axY + s * off, focusX, axY, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2);
      seg(f, focusX, axY, eyeX - 66, axY + s * off * 0.28, `rgba(66,153,225,${0.5 + pulse * 0.5})`, 2);
    }
    dot(f, focusX, axY, 4, C.hot);
    text(f, '焦点', focusX - 12, axY - 12, { color: C.hot, font: '11px sans-serif' });
    text(f, `放大率 = f_物 ÷ f_目 = ${mag}×，实际视角放大但衍射极限不变`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `口径越大集光越多：集光力 ∝ D²，看到的最暗星等 ≈ +6.5 + 2.5·lg(D²/7)`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '折射镜的先天短板：色差——不同波长折射率不同，焦点散成彩虹',
      '长镜筒可减轻色差，但大镜片自重下垂，1 米口径是折射镜的工程天花板',
      '伽利略 1609 年的 20 倍镜筒看见木星卫星——望远镜把地心说敲出第一道裂缝',
    ]);
    heading(f, '折射望远镜：两片玻璃的四百年');
  },
});
registerViz(refractingTelescope);

/** 反射望远镜。 */
const reflectingTelescope = defineViz({
  slug: 'reflecting-telescope', title: '反射望远镜', animated: true,
  params: { ap: { type: 'range', min: 200, max: 10000, default: 6000, step: 200, label: '主镜口径 (mm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ap = num(params, 'ap', 6000);
    clear(f);
    const axY = h * 0.52;
    const mX = w - 130, sX = w * 0.5, eyX = sX + 10, eyY = 84;
    seg(f, 50, axY, mX, axY, `${C.grid}aa`, 1);
    // 主镜（凹面）
    const pts: [number, number][] = [];
    for (let i = -40; i <= 40; i++) pts.push([mX + (i / 40) * (i / 40) * 16, axY + i * 1.5]);
    poly(f, pts, { stroke: C.cool, lw: 4 });
    text(f, `主镜 D=${ap} mm`, mX - 60, axY + 74, { color: C.cool, font: '12px sans-serif' });
    // 斜副镜
    seg(f, sX - 14, axY - 26, sX + 14, axY + 2, C.warm, 4);
    text(f, '45° 副镜', sX - 26, axY + 34, { color: C.warm, font: '11px sans-serif' });
    // 光路
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
    for (const s of [-1, 1]) {
      seg(f, 50, axY + s * 40, mX, axY + s * 6, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2);
      seg(f, mX, axY + s * 6, sX, axY, `rgba(66,153,225,${0.5 + pulse * 0.5})`, 2);
    }
    seg(f, sX, axY, eyX, eyY, `rgba(72,187,120,${0.5 + pulse * 0.5})`, 3);
    circle(f, eyX, eyY, 14, { stroke: C.green, lw: 3 });
    text(f, '目镜/仪器', eyX + 20, eyY + 4, { color: C.green, font: '11px sans-serif' });
    text(f, '反射面无色差——口径可以一路做大，镜坯背面支撑即可', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `分辨角 θ ≈ 1.22 λ/D：D=${(ap / 1000).toFixed(1)} m 时可见光约 ${(0.55 / (ap / 1000) * 0.206).toFixed(0)} 毫角秒`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '牛顿 1668 年造出第一台实用反射镜——为摆脱色差把焦点折到筒外',
      '牛顿式看筒侧、卡塞格林式看镜后：副镜布局决定仪器怎么挂',
      '胡克、赫歇尔一路到 10 米级凯克——大口径的唯一路线是反射',
    ]);
    heading(f, '反射望远镜：口径为王');
  },
});
registerViz(reflectingTelescope);

/** 大气窗口与台址选择。 */
const atmosphericWindow = defineViz({
  slug: 'atmospheric-window', title: '大气窗口与台址选择', animated: true,
  params: { h2o: { type: 'range', min: 0, max: 100, default: 30, step: 5, label: '高空水汽 (ppm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const wet = num(params, 'h2o', 30);
    clear(f);
    // 波段分段：UV 挡 | 可见窗口 | IR 部分窗口 | 射电透明 | 微波
    const bands: [string, number, string, string][] = [
      ['紫外', 0.14, 'rgba(146,84,222,0.55)', '臭氧吸收'],
      ['X 射线', 0.1, 'rgba(245,101,101,0.55)', '完全吸收'],
      ['可见', 0.16, 'rgba(72,187,120,0.75)', '窗口'],
      ['近红外', 0.14, `rgba(237,137,54,${0.7 - wet / 300})`, '水汽带'],
      ['中远红外', 0.14, `rgba(236,201,75,${0.4 - wet / 500})`, '大部分吸收'],
      ['射电', 0.32, 'rgba(66,153,225,0.75)', '窗口'],
    ];
    const x0 = 50, bw = w - 100, by = h * 0.34, bh = 74;
    let x = x0;
    for (const [name, frac, color, note] of bands) {
      const bwd = bw * frac;
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + x * 0.02);
      poly(f, [[x, by], [x + bwd, by], [x + bwd, by + bh], [x, by + bh]],
        { stroke: `rgba(226,232,240,${pulse * 0.5})`, lw: 1.4, fill: color });
      text(f, name, x + bwd / 2, by + 30, { color: '#fff', font: '12px sans-serif', align: 'center' });
      text(f, note, x + bwd / 2, by + 52, { color: 'rgba(255,255,255,0.8)', font: '10px sans-serif', align: 'center' });
      x += bwd;
    }
    text(f, '波长 →（1 nm 至 1 m，对数分段）', x0, by - 12, { color: C.dim, font: '11px sans-serif' });
    text(f, `水汽 ${wet} ppm：红外窗口亮度随湿度塌缩——这就是台址要抢高山与极地的原因`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 视宁度示意
    const sy = h - 148;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const off = Math.sin(t * 9 + f.t * 3) * 8 * (0.4 + wet / 100);
      dot(f, 70 + t * (w - 200), sy + off, 2, `rgba(66,153,225,0.8)`);
    }
    text(f, '湍流让星光闪烁：视宁度决定地面成像的清晰上限', 70, sy + 44, { color: C.warm, font: '11px sans-serif' });
    footnotes(f, [
      '大气只给射电、可见光与几个近红外窗口——其余谱段必须上天观测',
      '海拔越高水汽越少：夏威夷莫纳克亚、智利帕拉纳尔、青海冷湖都是抢出来的',
      '射电波段除毫米波外全天透明——射电望远镜可以建在海边平地',
    ]);
    heading(f, '大气窗口：地球这床被子');
  },
});
registerViz(atmosphericWindow);

/** 空间望远镜。 */
const spaceTelescope = defineViz({
  slug: 'space-telescope', title: '空间望远镜', animated: true,
  params: { orbit: { type: 'select', options: ['近地轨道 LEO', '日地 L2 点'], default: '近地轨道 LEO', label: '轨道' } },
  draw: (f) => {
    const { w, h, params } = f;
    const l2 = String((params as Record<string, unknown>)['orbit'] ?? '').includes('L2');
    clear(f);
    const cx = w * 0.3, cy = h * 0.55;
    circle(f, cx, cy, 54, { fill: 'rgba(66,153,225,0.35)', stroke: C.cool, lw: 2 });
    text(f, '地球', cx - 16, cy + 4, { color: '#fff', font: '12px sans-serif' });
    if (!l2) {
      circle(f, cx, cy, 110, { stroke: `${C.dim}aa`, lw: 1.4, dash: [6, 5] });
      const a = f.t * 0.6;
      const sx = cx + Math.cos(a) * 110, sy = cy + Math.sin(a) * 110;
      poly(f, [[sx - 12, sy - 6], [sx + 12, sy - 6], [sx + 12, sy + 6], [sx - 12, sy + 6]],
        { stroke: C.warm, lw: 2, fill: 'rgba(237,137,54,0.5)' });
      text(f, '哈勃：547 km 近地轨道', cx + 74, cy - 122, { color: C.warm, font: '12px sans-serif' });
      text(f, '可维修（五次航天飞机任务）——但大气外仍受地影与辐射带约束', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      const sx = w * 0.72, sy = cy - 40;
      circle(f, sx, sy, 46, { stroke: C.yellow, lw: 2, fill: 'rgba(236,201,75,0.25)' });
      text(f, '太阳', sx - 14, sy + 4, { color: C.yellow, font: '11px sans-serif' });
      seg(f, sx - 60, sy + 70, sx - 60, sy + 120, `${C.dim}88`, 1.4);
      text(f, 'L2：150 万公里外与地球同步背日', sx - 120, sy + 140, { color: C.warm, font: '12px sans-serif' });
      const shield = 0.7 + 0.3 * Math.sin(f.t * 2);
      poly(f, [[cx + 90, cy - 96], [cx + 178, cy - 78], [cx + 178, cy - 70], [cx + 90, cy - 88]],
        { stroke: `rgba(245,101,101,${shield})`, lw: 3, fill: 'rgba(245,101,101,0.25)' });
      text(f, '韦伯：五层遮阳板 → 背日面 40 K', cx + 74, cy - 116, { color: C.hot, font: '12px sans-serif' });
      text(f, 'L2 让望远镜永远背对日地月，一次部署、终身冷暗——代价是不可维修', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, '没有大气吸收与抖动：紫外、红外、角分辨全部解锁', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '哈勃 1990 年入轨，主镜球差靠 COSTAR 修正——太空也可以修',
      '韦伯 2021 年奔向 L2，6.5 米拼接主镜在筒里折着发射，展开即定型',
      '发射整流镜口径与重量是硬约束——詹姆斯·韦伯的折叠设计为此而生',
    ]);
    heading(f, '空间望远镜：把眼睛送出大气');
  },
});
registerViz(spaceTelescope);

/** 射电望远镜。 */
const radioTelescope = defineViz({
  slug: 'radio-telescope', title: '射电望远镜', animated: true,
  params: { d: { type: 'range', min: 25, max: 500, default: 130, step: 5, label: '口径 D (m)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const D = num(params, 'd', 130);
    clear(f);
    // 抛物面
    const cx = w * 0.34, cy = h * 0.62, R = 88 + D / 8;
    const para: [number, number][] = [];
    for (let i = -1; i <= 1; i += 0.04) para.push([cx + i * R, cy - (1 - i * i) * R * 0.5]);
    poly(f, para, { stroke: C.cool, lw: 4 });
    seg(f, cx, cy - R * 0.5, cx, cy - R * 1.1, C.dim, 2);
    dot(f, cx, cy - R * 1.1, 7, C.warm);
    text(f, '馈源', cx + 12, cy - R * 1.1 + 4, { color: C.warm, font: '11px sans-serif' });
    // 入射平面波
    const pulse = (f.t * 40) % 30;
    for (let k = 0; k < 5; k++) {
      const yy = cy - R * 0.9 - k * 26 + pulse * 0.4;
      seg(f, 40, yy, cx - R * 0.9, yy, `rgba(236,201,75,${0.7 - k * 0.1})`, 2);
    }
    text(f, `口径 D=${D} m：λ=21cm 时分辨角 ≈ ${(0.21 / D * 206000).toFixed(0)} 角秒`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 方向图（右下）
    const px = w * 0.78, py = h * 0.5;
    for (let i = -180; i <= 180; i += 3) {
      const a = (i * Math.PI) / 180;
      const amp = Math.abs(Math.sin(a * 6) / (a * 6 + 1e-9)) * (0.7 + 0.3 * Math.sin(f.t * 2));
      const r = amp * 96;
      const ang = -Math.PI / 2 + a * 0.5;
      dot(f, px + Math.cos(ang) * r, py + Math.sin(ang) * r, 1.6, `rgba(66,153,225,0.9)`);
    }
    text(f, '主瓣与旁瓣（方向图）', px - 60, py + 116, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '射电波长是光的百万倍——衍射极限逼出公里级口径，于是有了干涉阵',
      '馈源接收后要致冷到几十开：接收机自己也在发光，冷才是灵敏度',
      '射电宁静区受法律保护——手机、雷达、微波炉都是天文学的敌人',
    ]);
    heading(f, '射电望远镜：听见不可见');
  },
});
registerViz(radioTelescope);

/** 干涉阵与综合孔径。 */
const interferometerArray = defineViz({
  slug: 'interferometer-array', title: '干涉阵与综合孔径', animated: true,
  params: { base: { type: 'range', min: 50, max: 500, default: 200, step: 10, label: '基线 B (m)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const B = num(params, 'base', 200);
    clear(f);
    // 两面天线
    const y = h * 0.68;
    const x1 = w * 0.2, x2 = x1 + B * 0.6;
    for (const x of [x1, x2]) {
      const pts: [number, number][] = [];
      for (let i = -1; i <= 1; i += 0.05) pts.push([x + i * 34, y - (1 - i * i) * 20]);
      poly(f, pts, { stroke: C.cool, lw: 3 });
      dot(f, x, y - 24, 4, C.warm);
    }
    text(f, '天线 A', x1 - 20, y + 26, { color: C.dim, font: '11px sans-serif' });
    text(f, '天线 B', x2 - 20, y + 26, { color: C.dim, font: '11px sans-serif' });
    seg(f, x1, y + 44, x2, y + 44, C.warm, 2);
    text(f, `基线 B=${B} m`, (x1 + x2) / 2 - 34, y + 64, { color: C.warm, font: '12px sans-serif' });
    // 平面波入射
    const pulse = (f.t * 46) % 34;
    for (let k = 0; k < 5; k++) {
      const yy = 66 + k * 22 - pulse;
      seg(f, 40, yy, w - 60, yy - 40, `rgba(236,201,75,${0.65 - k * 0.09})`, 2);
    }
    text(f, '同一波前先后到达两面天线——路程差就是干涉信号', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 干涉条纹（上部）
    const fy = h * 0.24;
    for (let i = 0; i < 46; i++) {
      const phase = Math.cos((i / 46) * Math.PI * (B / 70) + f.t * 1.6);
      const alpha = 0.15 + Math.max(0, phase) * 0.85;
      poly(f, [[60 + i * ((w - 140) / 46), fy - 26], [60 + i * ((w - 140) / 46) + 6, fy - 26],
        [60 + i * ((w - 140) / 46) + 6, fy + 26], [60 + i * ((w - 140) / 46), fy + 26]],
        { stroke: 'transparent', fill: `rgba(66,153,225,${alpha})` });
    }
    text(f, '相关后的干涉条纹：条纹越密 → 可分辨细节越细（θ ≈ λ/B）', 60, fy + 50, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '赖尔的综合孔径让地球自转替你扫描——基线在天空画出 u-v 覆盖',
      '需要原子钟级时间同步：几纳秒的误差就让条纹对不上',
      '事件视界望远镜用地球口径拍下 M87 黑洞阴影（2019）',
    ]);
    heading(f, '干涉阵：口径靠脑洞');
  },
});
registerViz(interferometerArray);

/** 自适应光学。 */
const adaptiveOptics = defineViz({
  slug: 'adaptive-optics', title: '自适应光学', animated: true,
  params: { rate: { type: 'range', min: 100, max: 2000, default: 1000, step: 100, label: '闭环带宽 (Hz)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const bw = num(params, 'rate', 1000);
    clear(f);
    // 畸变波前（上）
    const top = h * 0.3, amp = 26 * (1 - Math.min(1, bw / 2000) * 0.8);
    const bad: [number, number][] = [];
    const good: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const x = 60 + t * (w - 140);
      const turb = Math.sin(t * 11 + f.t * 5) * amp + Math.sin(t * 23 - f.t * 3) * amp * 0.5;
      bad.push([x, top + turb]);
      good.push([x, h * 0.62 + turb * (1 - Math.min(1, bw / 400)) * 0.12]);
    }
    poly(f, bad, { stroke: C.hot, lw: 2.6 });
    poly(f, good, { stroke: C.green, lw: 2.6 });
    seg(f, 60, top, w - 80, top, `${C.grid}88`, 1, );
    seg(f, 60, h * 0.62, w - 80, h * 0.62, `${C.grid}88`, 1);
    text(f, '入瞳波前：大气湍流把平面揉成波浪', 60, top - 22, { color: C.hot, font: '13px sans-serif' });
    text(f, '变形镜 1000 次/秒反向校正 → 出瞳波前恢复平直', 60, h * 0.62 - 22, { color: C.green, font: '13px sans-serif' });
    // 波前传感器示意
    const gx = w - 150, gy = h * 0.62;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const dx = Math.sin(f.t * 4 + r + c) * (1 - Math.min(1, bw / 2000)) * 5;
      poly(f, [[gx + c * 16 + dx, gy + r * 16], [gx + c * 16 + 14 + dx, gy + r * 16],
        [gx + c * 16 + 14 + dx, gy + r * 16 + 14], [gx + c * 16 + dx, gy + r * 16 + 14]],
        { stroke: `${C.cool}aa`, lw: 1, fill: 'rgba(66,153,225,0.18)' });
    }
    text(f, ' Shack-Hartmann 子孔径', gx - 6, gy + 76, { color: C.dim, font: '10px sans-serif' });
    text(f, `带宽 ${bw} Hz：必须跑赢湍流的毫秒节拍（f Greenwood 频率）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '激光钠导星在 90 公里高空打人工参考点——天然导星常常不够亮',
      '校正单元数决定能补多少阶像差：从几十到几千个促动器',
      '军方天际监视技术转民用后，地面 10 米镜逼近衍射极限',
    ]);
    heading(f, '自适应光学：与大气抢毫秒');
  },
});
registerViz(adaptiveOptics);

/** 天体测光观测。 */
const photometricObservation = defineViz({
  slug: 'photometric-observation', title: '天体测光观测', animated: true,
  params: { kind: { type: 'select', options: ['脉动变星', '凌星光变'], default: '脉动变星', label: '曲线类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const transit = String((params as Record<string, unknown>)['kind'] ?? '').includes('凌星');
    clear(f);
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.2, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    text(f, transit ? '亮度（归一）' : '亮度（归一）', 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, transit ? '时间（相位）→' : '时间（相位）→', w - 150, h - 86, { color: C.dim, font: '11px sans-serif' });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      let y: number;
      if (transit) {
        const p = (t + f.t * 0.15) % 5;
        y = p > 2 && p < 2.5 ? 0.965 : 1;
        if (p > 2.06 && p < 2.44) y = 0.965;
      } else {
        const p = (t + f.t * 0.3) % 5;
        y = 1 + 0.16 * Math.sin((p / 5) * Math.PI * 2) + 0.03 * Math.sin(p * 4);
      }
      pts.push([v.sx(t), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    text(f, transit ? '凌深 = (R_p/R_*)²：凹陷深度直接给出行星半径' : '脉动周期与光度相关——造父变星是量天尺的第一级',
      60, h - 66, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '测光就是给星光称重：宽带滤光片分出 UBV/ugriz 波段，颜色指数读出温度',
      '星等差 5 对应 100 倍流量——对数刻度是眼睛与星表共同的选择',
      '开普勒望远镜靠千分之一级测光找到五千多颗系外行星',
    ]);
    heading(f, '天体测光：给星光称重');
  },
});
registerViz(photometricObservation);

/** 恒星光谱观测。 */
const stellarSpectroscopy = defineViz({
  slug: 'stellar-spectroscopy', title: '恒星光谱观测', animated: true,
  params: { rv: { type: 'range', min: -400, max: 400, default: 0, step: 10, label: '径向速度 (km/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const rv = num(params, 'rv', 0);
    clear(f);
    const x0 = 60, x1 = w - 60, y0 = h * 0.34, bh = 58;
    // 连续谱渐变
    const grad = ['rgba(146,84,222,0.85)', 'rgba(66,153,225,0.85)', 'rgba(72,187,120,0.85)', 'rgba(236,201,75,0.85)', 'rgba(237,137,54,0.85)', 'rgba(245,101,101,0.85)'];
    const segN = grad.length;
    for (let i = 0; i < segN; i++) {
      poly(f, [[x0 + (i / segN) * (x1 - x0), y0], [x0 + ((i + 1) / segN) * (x1 - x0), y0],
        [x0 + ((i + 1) / segN) * (x1 - x0), y0 + bh], [x0 + (i / segN) * (x1 - x0), y0 + bh]],
        { stroke: 'transparent', fill: grad[i] });
    }
    // 吸收线（Hα、CaK 等）随 rv 平移
    const shift = (rv / 300000) * (x1 - x0);
    const lines: [number, string][] = [[0.18, 'Ca K'], [0.3, 'Hδ'], [0.44, 'Hβ'], [0.62, 'Na D'], [0.78, 'Hα']];
    for (const [t, name] of lines) {
      const x = x0 + t * (x1 - x0) + shift;
      poly(f, [[x - 3, y0], [x + 3, y0], [x + 3, y0 + bh], [x - 3, y0 + bh]],
        { stroke: 'transparent', fill: 'rgba(26,32,44,0.92)' });
      text(f, name, x - 12, y0 + bh + 20, { color: C.fg, font: '10px sans-serif' });
    }
    text(f, '连续谱与吸收线——每根线是某元素在恒星大气签下的名字', 60, 44, { color: C.cyan, font: '13px sans-serif' });
    // 速度标尺
    const my = y0 + bh + 54;
    seg(f, x0, my, x1, my, C.dim, 1.4);
    for (let i = 0; i <= 6; i++) {
      const x = x0 + (i / 6) * (x1 - x0);
      seg(f, x, my - 5, x, my + 5, C.dim, 1.4);
      text(f, `${-400 + (i * 800) / 6 | 0}`, x - 14, my + 22, { color: C.dim, font: '10px sans-serif' });
    }
    text(f, `径向速度 ${rv} km/s → 谱线整体位移 Δλ/λ = v/c（红移为正）`, x0, my + 46, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '谱线波长给出元素丰度，线宽给出温度压力与自转，整体位移给出速度',
      '哈勃正是靠星系谱线红移写下 Hubble 定律——宇宙膨胀的第一手证据',
      '系外行星的视向速度法：恒星被拽着摆，谱线一忽儿偏蓝一忽儿偏红',
    ]);
    heading(f, '恒星光谱：隔着光年做化学分析');
  },
});
registerViz(stellarSpectroscopy);

/** 三角视差测距。 */
const stellarParallax = defineViz({
  slug: 'stellar-parallax', title: '三角视差测距', animated: true,
  params: { p: { type: 'range', min: 50, max: 500, default: 180, step: 10, label: '视差 (毫角秒)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 180);
    clear(f);
    // 太阳与地球轨道
    const sx = w * 0.5, sy = h * 0.66;
    circle(f, sx, sy, 9, { fill: C.yellow });
    text(f, '太阳', sx - 16, sy + 26, { color: C.yellow, font: '11px sans-serif' });
    const rx = 150, ry = 54;
    const orb: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      orb.push([sx + Math.cos(a) * rx, sy + Math.sin(a) * ry]);
    }
    poly(f, orb, { stroke: `${C.cool}aa`, lw: 1.6, dash: [5, 4] });
    // 地球（轨道两端）
    const e1x = sx - rx, e2x = sx + rx;
    circle(f, e1x, sy, 7, { fill: C.cool });
    circle(f, e2x, sy, 7, { fill: C.cool });
    text(f, '6 月', e1x - 14, sy - 16, { color: C.cool, font: '10px sans-serif' });
    text(f, '12 月', e2x - 16, sy - 16, { color: C.cool, font: '10px sans-serif' });
    // 近星与远星
    const starX = w * 0.5, starY = h * 0.22;
    const wobble = Math.sin(f.t * 1.2) * 26;
    circle(f, starX + wobble, starY, 8, { fill: C.warm });
    text(f, '目标星', starX + wobble + 14, starY + 4, { color: C.warm, font: '11px sans-serif' });
    seg(f, e1x, sy, starX + wobble, starY, `rgba(236,201,75,0.85)`, 1.6);
    seg(f, e2x, sy, starX + wobble, starY, `rgba(236,201,75,0.85)`, 1.6);
    // 背景星（远）
    const rand = rng(7);
    for (let i = 0; i < 40; i++) dot(f, 40 + rand() * (w - 80), 36 + rand() * (h * 0.3), 1.6, `${C.dim}aa`);
    const halfAngle = p / 2;
    text(f, `视差 p = ${p} mas → 距离 d = 1/p = ${(1000 / p).toFixed(2)} 秒差距 = ${((1000 / p) * 3.26).toFixed(1)} 光年`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `半年基线（1.2 亿 km）两端观测，近星相对背景星的位移角 = ${halfAngle} mas`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '视差角的倒数就是秒差距——量天尺的第一级，其余全靠它定标',
      '贝塞尔 1838 年首次测出天鹅座 61 视差，日心说拿到几何实证',
      '盖亚卫星把 14 亿颗星的视差做成三维星图——毫角秒时代的银河系考古',
    ]);
    heading(f, '三角视差：量天尺第一级');
  },
});
registerViz(stellarParallax);

/** 宇宙距离阶梯。 */
const distanceLadder = defineViz({
  slug: 'distance-ladder', title: '宇宙距离阶梯', animated: true,
  params: { rung: { type: 'range', min: 1, max: 4, default: 4, step: 1, label: '阶梯级数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const rung = num(params, 'rung', 4);
    clear(f);
    const steps: [string, string, number][] = [
      ['三角视差', '~100 pc', 1],
      ['造父变星', '~30 Mpc', 2],
      ['Ia 超新星', '~红移 0.1', 3],
      ['宇宙学红移', '~视界 Gpc', 4],
    ];
    const baseY = h - 120, x0 = 70, bw = (w - 160) / 4;
    for (let i = 0; i < 4; i++) {
      const bh = 44 + i * 62;
      const active = i < rung;
      const pulse = active ? 0.7 + 0.3 * Math.sin(f.t * 2 + i) : 0.3;
      const x = x0 + i * bw;
      poly(f, [[x + 8, baseY - bh], [x + bw - 8, baseY - bh], [x + bw - 8, baseY], [x + 8, baseY]],
        { stroke: `rgba(102,126,234,${pulse})`, lw: 2, fill: active ? 'rgba(66,153,225,0.22)' : 'rgba(45,55,72,0.5)' });
      text(f, steps[i][0], x + bw / 2, baseY - bh + 24, { color: active ? C.cyan : C.dim, font: '13px sans-serif', align: 'center' });
      text(f, steps[i][1], x + bw / 2, baseY - bh + 44, { color: active ? C.warm : `${C.dim}88`, font: '11px sans-serif', align: 'center' });
      if (active) text(f, '✓', x + bw - 26, baseY - 12, { color: C.green, font: '16px sans-serif' });
    }
    text(f, '每一级用下一级定标——误差随级数累积', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `当前亮到第 ${rung} 级：距离模数 m − M = 5 lg d − 5`, 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '勒维特在哈佛计算女工岗位上发现造父变星的周光关系（1908）',
      '级间必须有重叠区交叉定标，金属丰度与尘埃修正都是系统误差来源',
      '阶梯顶端的 Ia 超新星发现宇宙加速——2011 年诺贝尔奖',
    ]);
    heading(f, '宇宙距离阶梯：一级压一级');
  },
});
registerViz(distanceLadder);

/** 星系红移巡天。 */
const redshiftSurvey = defineViz({
  slug: 'redshift-survey', title: '星系红移巡天', animated: true,
  params: { n: { type: 'range', min: 200, max: 3000, default: 1200, step: 100, label: '巡天星系数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'n', 1200);
    clear(f);
    const rand = rng(2024);
    // 纤维状点云：沿几条骨架聚集
    const anchors: [number, number][] = [];
    for (let i = 0; i < 7; i++) anchors.push([80 + rand() * (w - 160), 60 + rand() * (h - 160)]);
    for (let i = 0; i < n; i++) {
      const a = anchors[(rand() * anchors.length) | 0];
      const b = anchors[(rand() * anchors.length) | 0];
      const t = rand();
      const along = rand() < 0.7;
      let x: number, y: number;
      if (along) {
        x = a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * 34;
        y = a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 34;
      } else {
        x = a[0] + (rand() - 0.5) * 46;
        y = a[1] + (rand() - 0.5) * 46;
      }
      const z = rand();
      const color = z < 0.33 ? 'rgba(66,153,225,0.75)' : z < 0.66 ? 'rgba(236,201,75,0.75)' : 'rgba(245,101,101,0.75)';
      dot(f, x, y, 1.5, color);
    }
    text(f, '纤维、节点与空洞——宇宙网从星系红移里显形', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 红移色标
    const ly = h - 104;
    for (let i = 0; i < 100; i++) {
      const t = i / 100;
      const color = t < 0.33 ? 'rgba(66,153,225,0.9)' : t < 0.66 ? 'rgba(236,201,75,0.9)' : 'rgba(245,101,101,0.9)';
      poly(f, [[80 + i * ((w - 200) / 100), ly], [80 + i * ((w - 200) / 100) + 4, ly], [80 + i * ((w - 200) / 100) + 4, ly + 16], [80 + i * ((w - 200) / 100), ly + 16]],
        { stroke: 'transparent', fill: color });
    }
    text(f, '近 z=0', 80, ly + 34, { color: C.cool, font: '11px sans-serif' });
    text(f, '远 z=0.6', w - 130, ly + 34, { color: C.hot, font: '11px sans-serif' });
    text(f, `本次巡天绘制 ${n} 个星系的三维位置（红移定距）`, 80, ly - 10, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '红移巡天把二维天区扩展成三维地图——长城与空洞都是它的产出',
      'BAO 特征尺度是刻在分布里的标准尺，专用于称暗能量',
      'SDSS 与 2dF 把星系数做到百万量级，选择效应必须进统计修正',
    ]);
    heading(f, '星系红移巡天：给宇宙网画像');
  },
});
registerViz(redshiftSurvey);

/** 微波背景辐射观测。 */
const cmbDiscovery = defineViz({
  slug: 'cmb-discovery', title: '微波背景辐射观测', animated: true,
  params: { view: { type: 'select', options: ['全天各向异性', '黑体谱'], default: '全天各向异性', label: '视图' } },
  draw: (f) => {
    const { w, h, params } = f;
    const showSpectrum = String((params as Record<string, unknown>)['view'] ?? '').includes('黑体');
    clear(f);
    if (!showSpectrum) {
      // 椭圆全天图 + 涨落斑块
      const cx = w * 0.5, cy = h * 0.52, rx = w * 0.36, ry = h * 0.3;
      const rand = rng(1965);
      for (let i = 0; i < 900; i++) {
        const u = rand() * 2 - 1, v = rand() * 2 - 1;
        if (u * u + v * v > 1) continue;
        const dT = Math.sin(u * 9 + v * 5) * 0.5 + (rand() - 0.5);
        const k = Math.abs(dT);
        const color = dT > 0 ? `rgba(245,101,101,${0.25 + k * 0.6})` : `rgba(66,153,225,${0.25 + k * 0.6})`;
        dot(f, cx + u * rx, cy + v * ry, 3.4, color);
      }
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2);
      const el: [number, number][] = [];
      for (let i = 0; i <= 100; i++) {
        const a = (i / 100) * Math.PI * 2;
        el.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      poly(f, el, { stroke: `rgba(226,232,240,${pulse})`, lw: 2 });
      text(f, '全天温度涨落 ΔT/T ≈ 10⁻⁵（放大后如此斑斓）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '2.725 K 的黑体谱 + 百万分之一的涨落 = 宇宙最早的光', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 黑体谱与实验点
      const v = view(f, { xMin: 0, xMax: 30, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
      grid(f, v, { divisions: 6, ticks: true });
      const pts: [number, number][] = [];
      for (let i = 0; i <= 300; i++) {
        const x = (i / 300) * 30;
        const y = Math.pow(x, 3) / (Math.exp(x / 5.5) - 1);
        pts.push([v.sx(x), v.sy(y * 0.9)]);
      }
      poly(f, pts, { stroke: C.accent, lw: 3 });
      const rand = rng(31);
      for (let i = 0; i < 18; i++) {
        const x = 2 + rand() * 26;
        const y = Math.pow(x, 3) / (Math.exp(x / 5.5) - 1) * 0.9 + (rand() - 0.5) * 0.03;
        dot(f, v.sx(x), v.sy(y), 3.4, C.warm);
      }
      text(f, 'COBE/FIRAS 实验点与 2.725K 黑体理论曲线——史上最完美的黑体谱', 56, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '频率 (cm⁻¹) →', w - 150, h - 86, { color: C.dim, font: '11px sans-serif' });
      footnotes(f, [
        '彭齐亚斯与威尔逊的天线噪声除不掉——那正是 3K 大爆炸余温（1965）',
        '涨落是星系团的种子：原初密度扰动经引力塌缩长出今天的一切结构',
        'COBE、WMAP、Planck 三代卫星把宇宙学压进五个参数的精密时代',
      ]);
      heading(f, '微波背景：宇宙大爆炸的余温');
      return;
    }
    footnotes(f, [
      '彭齐亚斯与威尔逊的天线噪声除不掉——那正是 3K 大爆炸余温（1965）',
      '涨落是星系团的种子：原初密度扰动经引力塌缩长出今天的一切结构',
      'COBE、WMAP、Planck 三代卫星把宇宙学压进五个参数的精密时代',
    ]);
    heading(f, '微波背景：宇宙大爆炸的余温');
  },
});
registerViz(cmbDiscovery);

/** 脉冲星观测。 */
const pulsarDiscovery = defineViz({
  slug: 'pulsar-discovery', title: '脉冲星观测', animated: true,
  params: { period: { type: 'range', min: 14, max: 3000, default: 144, step: 14, label: '自转周期 (ms)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const P = num(params, 'period', 144);
    clear(f);
    // 中子星与灯塔
    const cx = w * 0.24, cy = h * 0.44;
    circle(f, cx, cy, 16, { fill: 'rgba(66,153,225,0.7)', stroke: C.cool, lw: 2 });
    text(f, '中子星', cx - 20, cy + 38, { color: C.cool, font: '11px sans-serif' });
    const tilt = 0.5;
    for (const s of [-1, 1]) {
      const a = f.t * (200 / P) * 4;
      const dir = s * tilt;
      const tipX = cx + Math.cos(a + dir) * 110;
      const tipY = cy + Math.sin(a + dir) * 110;
      poly(f, [[cx, cy], [tipX, tipY - 20], [tipX + 14, tipY]], { stroke: 'transparent', fill: `rgba(236,201,75,${0.3 + 0.25 * Math.sin(a)})` });
      seg(f, cx, cy, tipX, tipY, `rgba(236,201,75,0.75)`, 3);
    }
    text(f, '磁轴与转轴不重合 → 灯塔扫过地球', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 脉冲序列
    const px0 = w * 0.46, py = h * 0.72;
    seg(f, px0, py, w - 50, py, C.grid, 1.4);
    const nP = 5;
    const span = w - 50 - px0;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const phase = ((t * nP + f.t * (200 / P) * 0.5) % 1);
      const amp = Math.exp(-Math.pow((phase - 0.5) * 26, 2));
      const x = px0 + t * span;
      const y = py - amp * 74;
      if (i > 0) {
        const tPrev = (i - 1) / 200;
        const phasePrev = ((tPrev * nP + f.t * (200 / P) * 0.5) % 1);
        const ampPrev = Math.exp(-Math.pow((phasePrev - 0.5) * 26, 2));
        seg(f, px0 + tPrev * span, py - ampPrev * 74, x, y, C.green, 2.4);
      }
    }
    text(f, '射电脉冲序列：周期稳定如原子钟', px0, py + 26, { color: C.green, font: '11px sans-serif' });
    text(f, `P = ${P} ms${P < 300 ? '（毫秒脉冲星，可作时间基准）' : '（典型脉冲星）'}；Ṗ 变慢直接量出转动能损`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '1967 年剑桥学生贝尔收到一串精确周期信号，一度被当成外星人电报',
      '脉冲星是高速自转的中子星——10⁶ T 磁场、一茶匙物质重达亿吨',
      '双脉冲星轨道衰减与广义相对论逐年吻合——引力波的间接证据',
    ]);
    heading(f, '脉冲星：宇宙灯塔');
  },
});
registerViz(pulsarDiscovery);

/** 首次引力波观测。 */
const gw150914 = defineViz({
  slug: 'gw150914', title: '首次引力波观测（GW150914）', animated: true,
  params: { dur: { type: 'range', min: 0.2, max: 0.4, default: 0.2, step: 0.01, label: '信号时长 (s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const dur = num(params, 'dur', 0.2);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.4, yMax: 1.4, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    // chirp：频率与振幅随时间上升
    const pts: [number, number][] = [];
    const prog = (f.t * 0.6) % 1.3;
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 0.92;
      const chirp = Math.pow(t / 0.92, 3);
      const amp = 0.15 + chirp * 1.05;
      const freq = 8 + chirp * 46;
      const y = t < 0.92 ? amp * Math.sin(freq * t * 6) : 0;
      pts.push([v.sx(t), v.sy(y)]);
      if (t > prog) break;
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // 并合时刻
    seg(f, v.sx(0.92), v.sy(-1.4), v.sx(0.92), v.sy(1.4), C.hot, 1.6, );
    text(f, '并合', v.sx(0.92) - 14, v.sy(1.25), { color: C.hot, font: '11px sans-serif' });
    text(f, '应变 h（L Hanford 与 L Livingston 同步记录）', 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, `信号在 ${dur} 秒内从 35 扫到 250 Hz——频率上翘的蝌蚪波形`, 30, h - 66, { color: C.warm, font: '13px sans-serif' });
    text(f, '时间 →（旋进 → 并合 → 铃宕）', w - 240, h - 86, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      'h ≈ 10⁻²¹：4 公里臂长变化不到一个质子直径的千分之一',
      '2015-09-14，两台探测器相差 7 毫秒收到同一波形——排除本地噪声',
      '匹配滤波用数万广义相对论模板从噪声里捞信号——2017 年诺贝尔奖',
    ]);
    heading(f, 'GW150914：听见时空');
  },
});
registerViz(gw150914);

/** 中微子天文学。 */
const neutrinoObservation = defineViz({
  slug: 'neutrino-observation', title: '中微子天文学', animated: true,
  params: { depth: { type: 'range', min: 1, max: 5, default: 2, step: 1, label: '探测器深度 (km)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const depth = num(params, 'depth', 2);
    clear(f);
    // 地表与岩石
    const gY = h * 0.26;
    poly(f, [[0, gY], [w, gY], [w, h], [0, h]], { stroke: 'transparent', fill: 'rgba(45,55,72,0.55)' });
    poly(f, [[0, gY], [w, gY]], { stroke: C.warm, lw: 3 });
    text(f, '地面（宇宙线在此被吸收）', 30, gY - 12, { color: C.warm, font: '12px sans-serif' });
    // 宇宙线簇射（被挡住）
    for (let i = 0; i < 8; i++) seg(f, 60 + i * 14, 46, 80 + i * 18, gY - 4, `rgba(245,101,101,${0.5 - i * 0.05})`, 1.6);
    text(f, '宇宙线缪子：岩石挡住了', 60, 44, { color: C.hot, font: '12px sans-serif' });
    // 中微子穿过
    const dash = (f.t * 60) % 40;
    seg(f, w * 0.36 + dash * 0.3, 40, w * 0.56, h - 60, `rgba(72,187,120,${0.5 + 0.4 * Math.sin(f.t * 3)})`, 2.4);
    text(f, '中微子：直穿地球', w * 0.56 + 8, 60, { color: C.green, font: '12px sans-serif' });
    // 地下探测器水箱
    const tx = w * 0.6, ty = h - 60 - depth * 40;
    poly(f, [[tx, ty], [tx + 190, ty], [tx + 190, ty + 74], [tx, ty + 74]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.16)' });
    text(f, `超纯水切伦科夫探测器（深 ${depth} km）`, tx, ty - 10, { color: C.cool, font: '11px sans-serif' });
    // 切伦科夫光锥
    const hit = Math.sin(f.t * 2.5) > 0.7;
    if (hit) {
      const cx2 = tx + 96, cy2 = ty + 36;
      poly(f, [[cx2, cy2], [cx2 - 40, cy2 + 28], [cx2 + 40, cy2 + 28]],
        { stroke: 'transparent', fill: 'rgba(80,180,255,0.5)' });
      text(f, '蓝色切伦科夫锥', cx2 + 46, cy2 + 6, { color: '#7fd4ff', font: '11px sans-serif' });
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) dot(f, tx + 14 + c * 30, ty + 12 + r * 24, 3, `rgba(236,201,75,${0.4 + 0.4 * Math.sin(f.t * 2 + c + r)})`);
    text(f, '光电倍增管阵列记录闪光的环形图案', tx, ty + 92, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '中微子几乎不与物质作用——能携带恒星核心的机密直穿而出',
      '太阳中微子流量只有理论值三分之一：味振荡改写了标准模型',
      '超级神冈捕获 SN1987A 中微子——天文学多了一个新信使',
    ]);
    heading(f, '中微子天文学：看见不可见');
  },
});
registerViz(neutrinoObservation);

/** 宇宙线观测。 */
const cosmicRayObservation = defineViz({
  slug: 'cosmic-ray-observation', title: '宇宙线观测（广延大气簇射）', animated: true,
  params: { logE: { type: 'range', min: 18, max: 20.5, default: 19.7, step: 0.1, label: '原初能量 log₁₀E (eV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const logE = num(params, 'logE', 19.7);
    clear(f);
    const gY = h * 0.66;
    poly(f, [[0, gY], [w, gY], [w, h], [0, h]], { stroke: 'transparent', fill: 'rgba(45,55,72,0.5)' });
    poly(f, [[0, gY], [w, gY]], { stroke: C.warm, lw: 3 });
    // 簇射树
    const apexX = w * 0.3, apexY = 46;
    const rand = rng(88);
    const prog = (f.t * 0.7) % 1.2;
    const depth = 1;
    for (let i = 0; i < 46; i++) {
      const spread = (rand() - 0.5) * 1.9;
      const tEnd = Math.min(1, prog);
      const x = apexX + spread * (gY - apexY) * 0.62 * tEnd;
      const y = apexY + (gY - apexY) * tEnd;
      seg(f, apexX, apexY, x, y, `rgba(236,201,75,${0.14 + rand() * 0.3})`, 1.4);
      if (tEnd > 0.96) dot(f, x, y, 2.6, `rgba(66,153,225,${0.5 + rand() * 0.5})`);
    }
    text(f, '原初核子撞击大气 → 电磁与强子级联同时发展', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 地面阵列
    for (let i = 0; i < 9; i++) {
      const x = 70 + i * ((w - 150) / 8);
      poly(f, [[x - 12, gY], [x + 12, gY], [x + 9, gY + 16], [x - 9, gY + 16]],
        { stroke: `${C.green}cc`, lw: 1.6, fill: 'rgba(72,187,120,0.3)' });
      const hit = Math.sin(f.t * 3 - i * 0.5) > 0.5;
      if (hit) dot(f, x, gY - 8, 4, C.green);
    }
    text(f, '地面粒子探测器阵列（时间差重建方向）', 70, gY + 44, { color: C.green, font: '11px sans-serif' });
    // 能量与 Xmax
    text(f, `E ≈ 10^${logE.toFixed(1)} eV —— 比人造加速器高 ${((logE - 7.6) | 0)} 个数量级`, 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '簇射是薄饼状粒子盘，以光速扫过地面——最强事件一秒内落下上亿粒子',
      '荧光望远镜在夜空看到发光轨迹，与地面阵列交叉定标能谱',
      'GZK 截断之上仍有个别事件——最高能宇宙线来自哪里尚未定论',
    ]);
    heading(f, '宇宙线观测：天然粒子加速器');
  },
});
registerViz(cosmicRayObservation);

/** X 射线天文观测。 */
const xrayAstronomy = defineViz({
  slug: 'xray-astronomy', title: 'X 射线天文观测', animated: true,
  params: { graze: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '掠射角 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ang = num(params, 'graze', 1);
    clear(f);
    text(f, 'X 射线垂直入射会被吸收——只有掠射角极小才能被镜面"弹"一下', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 掠射镜面（嵌套抛物面近似）
    const y0 = h * 0.42;
    for (let k = 0; k < 4; k++) {
      const yy = y0 + k * 34;
      seg(f, 130, yy, w - 170, yy + 24, `rgba(66,153,225,${0.85 - k * 0.14})`, 3.4);
      text(f, `第 ${k + 1} 层嵌套镜`, w - 162, yy + 44, { color: C.dim, font: '9px sans-serif' });
    }
    // 入射与反射光线
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2.4);
    const incline = (ang / 3) * 24;
    for (let k = 0; k < 4; k++) {
      const yy = y0 + k * 34;
      seg(f, 40, yy - 40 + incline, 130, yy, `rgba(245,101,101,${0.55 + pulse * 0.45})`, 2);
      seg(f, 130, yy, w - 170, yy + 24, `rgba(236,201,75,${0.55 + pulse * 0.45})`, 2);
    }
    // 焦点与探测器
    const fx = w - 120, fy = y0 + 60;
    dot(f, fx, fy, 7, C.green);
    text(f, '焦面探测器', fx - 40, fy + 30, { color: C.green, font: '11px sans-serif' });
    text(f, `掠射角 ${ang.toFixed(1)}°：临界角之内才有全反射，角度越大被吸收越多`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '1962 年火箭实验发现天蝎座 X-1——X 射线天文学从零诞生',
      '钱德拉的同心嵌套镜让高能光子聚焦，铁 Kα 线展宽直接检验强场引力',
      '高能宇宙只能上天看：大气对 X 射线是不透光的铁板',
    ]);
    heading(f, 'X 射线天文：掠射的艺术');
  },
});
registerViz(xrayAstronomy);

/** 红外天文观测。 */
const infraredAstronomy = defineViz({
  slug: 'infrared-astronomy', title: '红外天文观测', animated: true,
  params: { T: { type: 'range', min: 30, max: 6000, default: 3000, step: 100, label: '目标温度 (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 3000);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    // 三个温度的黑体谱
    const curves: [number, string, string][] = [
      [5800, 'rgba(245,101,101,0.9)', '5800 K 恒星'],
      [T, 'rgba(237,137,54,1)', `${T} K 目标`],
      [30, 'rgba(66,153,225,0.9)', '30 K 分子云'],
    ];
    for (const [temp, color, label] of curves) {
      const peak = 2898 / temp * 1000; // 转到画布 x 单位
      const pts: [number, number][] = [];
      for (let i = 1; i <= 300; i++) {
        const x = (i / 300) * 10;
        const xm = x * (3000 / 2898); // 画布单位→微米比例
        const y = Math.pow(xm, 3) / (Math.exp(Math.min(40, xm * 5000 / temp)) - 1);
        const norm = Math.pow(5000 / temp, 3) * 0.5;
        pts.push([v.sx(x), v.sy(Math.min(1.1, y * norm))]);
      }
      poly(f, pts, { stroke: color, lw: 2.4 });
      text(f, label, v.sx(0.15), v.sy(1.08) + (curves.indexOf(curves.find(c => c[0] === temp)!) * 0), { color, font: '11px sans-serif' });
      void peak;
    }
    text(f, '维恩位移：越冷的天体辐射峰越靠红外——尘埃后的恒星育婴室只能用红外看', 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '波长 →（示意：紫外/可见/红外分段）', w - 260, h - 86, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '望远镜与探测器自己都在发光——韦伯镜面主动制冷到 40 K 以下',
      '地面只剩几个近红外窗口，中远红外必须上天',
      '尘埃对红外的消光远小于可见光——红外是看穿分子云的钥匙',
    ]);
    heading(f, '红外天文：冷世界的窗口');
  },
});
registerViz(infraredAstronomy);

/** 伽马射线天文观测。 */
const gammaAstronomy = defineViz({
  slug: 'gamma-astronomy', title: '伽马射线天文观测', animated: true,
  params: { E: { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: '光子能量 (GeV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const E = num(params, 'E', 1);
    clear(f);
    // 电子对产生
    const cx = w * 0.3, cy = h * 0.46;
    const prog = (f.t * 0.7) % 1.4;
    seg(f, 40, cy - 30, cx, cy, `rgba(245,101,101,${0.5 + 0.5 * Math.sin(f.t * 3)})`, 2.6);
    text(f, 'γ 光子', 44, cy - 44, { color: C.hot, font: '12px sans-serif' });
    if (prog > 0.3) {
      seg(f, cx, cy, cx + 150, cy - 70, C.cool, 3);
      seg(f, cx, cy, cx + 150, cy + 70, C.warm, 3);
      text(f, 'e⁻', cx + 158, cy - 66, { color: C.cool, font: '13px sans-serif' });
      text(f, 'e⁺', cx + 158, cy + 74, { color: C.warm, font: '13px sans-serif' });
      dot(f, cx, cy, 6, C.hot);
      text(f, '电子对产生：单光子在原子核库仑场中转化', cx - 60, cy + 108, { color: C.dim, font: '11px sans-serif' });
    }
    // 量能器（簇射发展）
    const bx = w * 0.66, by = h * 0.32;
    for (let L = 0; L < 5; L++) {
      for (let c = 0; c <= L; c++) {
        const x = bx + (c - L / 2) * 26;
        const y = by + L * 34;
        const pulse = 0.35 + 0.45 * Math.abs(Math.sin(f.t * 3 + L));
        dot(f, x, y, 6, `rgba(236,201,75,${pulse})`);
      }
    }
    text(f, '量能器：逐层倍增读出总能量', bx - 78, by + 196, { color: C.dim, font: '11px sans-serif' });
    text(f, `E = ${E.toFixed(1)} GeV：能量越高簇射越浅、越集中在前段`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `对应康普顿波长 λ = ${(0.197 / E).toFixed(3)} fm——比原子核还小`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '卫星用符合望远镜标记入射方向，地面切伦科夫镜捕捉簇射的微弱蓝光',
      '1967 年自由号偶然记录伽马暴——宇宙最剧烈的爆发由此登场',
      '费米 LAT 与切伦科夫阵列把伽马天文学推到 100 GeV 以上',
    ]);
    heading(f, '伽马射线天文：接住最暴躁的光子');
  },
});
registerViz(gammaAstronomy);

/** 凌星法搜寻系外行星。 */
const exoplanetTransit = defineViz({
  slug: 'exoplanet-transit', title: '凌星法搜寻系外行星', animated: true,
  params: { rp: { type: 'range', min: 0.5, max: 2.5, default: 1.2, step: 0.1, label: '行星半径 (R⊕)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const rp = num(params, 'rp', 1.2);
    clear(f);
    // 恒星与凌过行星
    const sx = w * 0.3, sy = h * 0.4;
    const R = 92;
    circle(f, sx, sy, R, { fill: 'rgba(236,201,75,0.85)', stroke: C.yellow, lw: 2 });
    const orbR = Math.sqrt(Math.max(0.1, Math.pow(R, 2) - Math.pow((f.t * 60) % (R * 2 + 120) - R - 60, 2)));
    const px = sx + ((f.t * 70) % (R * 2 + 160)) - R - 80;
    const pr = 10 + rp * 6;
    circle(f, px, sy - 6, pr, { fill: 'rgba(26,32,44,0.95)', stroke: `${C.dim}cc`, lw: 1.6 });
    text(f, '行星', px - 12, sy - 6 - pr - 8, { color: C.fg, font: '10px sans-serif' });
    text(f, '恒星', sx - 14, sy + 4, { color: '#3a2a10', font: '12px sans-serif' });
    void orbR;
    // 光变曲线
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0.94, yMax: 1.02, inset: 46, insetBottom: 96 });
    const depth = Math.pow((pr / R) * 3.4, 2);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      const p = (t + f.t * 0.5) % 10;
      let y = 1;
      if (p > 4.4 && p < 5.6) {
        y = 1 - depth;
        if (p > 4.5 && p < 5.5) y = 1 - depth;
      }
      pts.push([v.sx(t), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    text(f, '亮度', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `凌深 = (R_p/R_*)² ≈ ${(depth * 100).toFixed(2)}%：深度给半径、周期给轨道`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '时间 →（地球凌日仅约 1% 深度，万分之一级测光才够用）', 56, h - 86, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '开普勒望远镜盯同一片天区四年，一次确认两千余颗行星',
      '恒星黑子会伪装成假信号——多波段与径向速度交叉验证是必须的',
      '凌星光谱：行星大气在凌星时吸收星光，谱线里透出成分',
    ]);
    heading(f, '凌星法：一颗行星的阴影');
  },
});
registerViz(exoplanetTransit);

/** 视向速度法搜寻系外行星。 */
const exoplanetRv = defineViz({
  slug: 'exoplanet-rv', title: '视向速度法搜寻系外行星', animated: true,
  params: { K: { type: 'range', min: 1, max: 500, default: 12, step: 1, label: '速度半幅 K (m/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const K = num(params, 'K', 12);
    clear(f);
    // 恒星与行星绕转
    const cx = w * 0.28, cy = h * 0.42;
    const wob = 6 + Math.min(14, K / 26);
    const a = f.t * 1.4;
    circle(f, cx, cy, 44, { fill: 'rgba(236,201,75,0.9)' });
    circle(f, cx + Math.cos(a) * wob, cy + Math.sin(a) * wob * 0.4, 12, { fill: 'rgba(66,153,225,0.9)' });
    const orbit: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      orbit.push([cx + Math.cos(t) * 120, cy + Math.sin(t) * 44]);
    }
    poly(f, orbit, { stroke: `${C.dim}88`, lw: 1.4, dash: [5, 4] });
    text(f, '恒星被伴星拽着小幅摆动', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '视线方向 ← →', cx - 54, cy + 74, { color: C.dim, font: '10px sans-serif' });
    // RV 曲线
    const v = view(f, { xMin: 0, xMax: 10, yMin: -1.3, yMax: 1.3, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      pts.push([v.sx(t), v.sy(Math.sin(((t + f.t * 0.3) % 10) / 10 * Math.PI * 2))]);
    }
    poly(f, pts, { stroke: C.green, lw: 2.6 });
    text(f, '谱线多普勒位移 → 视向速度（蓝 ← → 红）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `K = ${K} m/s（地球对太阳 ≈ 0.09 m/s——类地行星已逼近测量极限）`, 56, h - 86, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '1995 年 51 Peg b 的 4.2 天周期震动学界——热木星改写了行星形成理论',
      '质量下限 m sin i：轨道不侧视时只称得出下限',
      '校准激光梳把谱线定标稳到厘米每秒——找类地行星的门槛',
    ]);
    heading(f, '视向速度法：恒星在摆');
  },
});
registerViz(exoplanetRv);

/** 太阳观测。 */
const solarObservation = defineViz({
  slug: 'solar-observation', title: '太阳观测', animated: true,
  params: { phase: { type: 'select', options: ['光球白光', '磁场磁图', '日震振荡'], default: '光球白光', label: '观测通道' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['phase'] ?? '');
    clear(f);
    const cx = w * 0.42, cy = h * 0.5, R = Math.min(w, h) * 0.32;
    circle(f, cx, cy, R, { fill: 'rgba(236,201,75,0.9)', stroke: C.yellow, lw: 3 });
    if (mode.includes('白光')) {
      const rand = rng(21);
      for (let i = 0; i < 7; i++) {
        const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * R * 0.86;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const sz = 8 + rand() * 14;
        circle(f, x, y, sz, { fill: 'rgba(26,32,44,0.9)' });
        circle(f, x, y, sz + 4, { stroke: 'rgba(245,101,101,0.5)', lw: 3 });
      }
      text(f, '黑子：强磁场抑制对流的低温区（仍有 4000 K）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else if (mode.includes('磁图')) {
      const rand = rng(21);
      for (let i = 0; i < 260; i++) {
        const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * R;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const v = Math.sin(x * 0.08) * Math.cos(y * 0.07) + (rand() - 0.5);
        dot(f, x, y, 5, v > 0 ? `rgba(245,101,101,${0.4 + Math.abs(v) * 0.5})` : `rgba(66,153,225,${0.4 + Math.abs(v) * 0.5})`);
      }
      text(f, '磁图：红蓝交替的双极磁区——黑子成对出现的地方', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const wob = Math.sin(f.t * 3 + i) * 7;
        const x = cx + Math.cos(a) * (R * 0.7 + wob), y = cy + Math.sin(a) * (R * 0.7 + wob);
        dot(f, x, y, 3.6, `rgba(245,101,101,${0.5 + 0.4 * Math.sin(f.t * 3 + i)})`);
      }
      text(f, '日震：光球振荡的 p 模反演内部结构——像给太阳做 CT', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, '太阳常数 ≈ 1361 W/m²：0.1% 的光变就是气候尺度的强迫', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '唯一能看清表面的恒星——黑子、耀斑与振荡都在它脸上直播',
      '色球与日冕的加热问题：比光球高百万度却离热源更远，至今未闭合',
      'SDO 与帕克探测器把空间天气预报变成可业务化的科学',
    ]);
    heading(f, '太阳观测：最近的恒星实验室');
  },
});
registerViz(solarObservation);

/** 日冕观测。 */
const coronagraphy = defineViz({
  slug: 'coronagraphy', title: '日冕观测（日冕仪）', animated: true,
  params: { contrast: { type: 'range', min: 3, max: 9, default: 6, step: 1, label: '对比度 10⁻ⁿ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'contrast', 6);
    clear(f);
    const cx = w * 0.36, cy = h * 0.5;
    // 光球（被挡盘遮住）
    circle(f, cx, cy, 84, { fill: 'rgba(236,201,75,0.95)' });
    const occ = 0.6 + 0.4 * Math.sin(f.t * 2);
    circle(f, cx, cy, 96, { stroke: `rgba(26,32,44,${occ})`, lw: 4, fill: 'rgba(26,32,44,0.94)' });
    text(f, '挡盘遮住光球', cx - 44, cy + 4, { color: C.dim, font: '11px sans-serif' });
    // 日冕环（露出）
    for (let k = 0; k < 7; k++) {
      const a0 = (k / 7) * Math.PI * 2 + f.t * 0.2;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = a0 + t * 0.7;
        const r = 104 + Math.sin(t * Math.PI) * 52;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      poly(f, pts, { stroke: `rgba(146,84,222,${0.5 + 0.3 * Math.sin(f.t * 2 + k)})`, lw: 2.4 });
    }
    text(f, '日冕：只有挡住光球才现形', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 衍射漏光示意（右侧）
    const bx = w * 0.74, by = h * 0.3;
    for (let r = 1; r <= 5; r++) {
      const alpha = Math.pow(10, -n * r / 5) * 6;
      circle(f, bx, by, 20 + r * 22, { stroke: `rgba(236,201,75,${Math.min(0.85, alpha + 0.06)})`, lw: 2.4 });
    }
    text(f, `衍射漏光被压到 10⁻ⁿ：级次掩模与锯齿挡盘协同`, bx - 96, by + 156, { color: C.warm, font: '11px sans-serif' });
    text(f, `当前抑制比 10⁻${n}——日冕亮度只有光球的百万分之一`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '李奥 1931 年发明日冕仪，把每年几分钟的日食变成全天候常规观测',
      '日全食期间月球是完美挡盘——贝利珠与色球的黄金校准窗口',
      '日冕物质抛射的发现直接催生空间天气预警——太阳风暴会掐断卫星与电网',
    ]);
    heading(f, '日冕观测：挡住光才看得见');
  },
});
registerViz(coronagraphy);

/** 掩星观测。 */
const stellarOccultation = defineViz({
  slug: 'stellar-occultation', title: '掩星观测', animated: true,
  params: { size: { type: 'range', min: 10, max: 400, default: 90, step: 10, label: '目标直径 (km)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const size = num(params, 'size', 90);
    clear(f);
    // 星与掩过的小天体
    const sy = h * 0.32;
    const sx = w * 0.5;
    const prog = (f.t * 0.5) % 1.6;
    dot(f, sx, sy, 5, C.yellow);
    text(f, '背景恒星', sx + 12, sy - 8, { color: C.yellow, font: '11px sans-serif' });
    const ox = sx - 240 + prog * 480;
    circle(f, ox, sy, 26, { fill: 'rgba(100,116,139,0.9)', stroke: C.dim, lw: 2 });
    text(f, '小行星', ox - 22, sy + 46, { color: C.dim, font: '11px sans-serif' });
    text(f, '影带扫过观测站：星光在亚秒尺度内熄灭又复燃', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 光变曲线（下）
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.2, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const dur = size / 20;
    const pts: [number, number][] = [];
    const p = (prog * 6.2) % 10;
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      let y = 1;
      const dt = t - p;
      if (Math.abs(dt) < dur / 2) {
        const edge = dur / 2 - Math.abs(dt);
        y = Math.min(1, Math.max(0, edge * 14));
        y = 1 - y;
      }
      // 衍射涟漪
      if (Math.abs(Math.abs(dt) - dur / 2) < 0.4) y = 1 + Math.sin(dt * 60) * 0.08;
      pts.push([v.sx(t), v.sy(Math.min(1.18, Math.max(0, y)))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    text(f, `掩星时长 × 切向速度 = 横向尺度 → 直径 ≈ ${size} km`, 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '时间 →（边缘的衍射涟漪还携带大气与环系信息）', 56, h - 86, { color: C.warm, font: '11px sans-serif' });
    footnotes(f, [
      '掩影带只有几十公里宽——全球移动观测队守株待兔',
      '多站同时观测可勾出轮廓；淡出图样能判断目标有没有大气',
      '冥王星掩星测径（1988）与新视野号互校，成为行星际导航经典',
    ]);
    heading(f, '掩星观测：借影量天');
  },
});
registerViz(stellarOccultation);

/** 天体测量观测。 */
const astrometry = defineViz({
  slug: 'astrometry', title: '天体测量观测（盖亚）', animated: true,
  params: { prec: { type: 'range', min: 1, max: 1000, default: 100, step: 10, label: '精度 (μas)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prec = num(params, 'prec', 100);
    clear(f);
    text(f, '恒星的位置账本：视差（周年摆动）+ 自行（长期漂移）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 参考网格 + 带自行的星位
    const rand = rng(404);
    const y0 = h * 0.3;
    for (let i = 0; i < 14; i++) {
      const x = 60 + i * ((w - 130) / 13);
      seg(f, x, y0 - 12, x, y0 + 96, `${C.grid}77`, 1);
    }
    seg(f, 50, y0 + 42, w - 60, y0 + 42, `${C.grid}aa`, 1.2);
    // 星位与移动轨迹
    for (let i = 0; i < 9; i++) {
      const x0 = 80 + rand() * (w - 180);
      const drift = (rand() - 0.5) * 130;
      const amp = 10 + rand() * 16;
      const phase = rand() * 6;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 60; k++) {
        const t = k / 60;
        pts.push([60 + ((x0 - 60 + drift * t + Math.sin(t * 6.28 + phase + f.t * 0.6) * amp) % (w - 120)), y0 + 42 + Math.cos(t * 6.28 + phase + f.t * 0.6) * amp * 0.5]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.35 + rand() * 0.4})`, lw: 1.6 });
      dot(f, pts[pts.length - 1][0], pts[pts.length - 1][1], 3.4, C.warm);
    }
    // 精度环
    const px = w * 0.82, py = h * 0.76;
    const r = Math.max(3, Math.log10(prec) * 6);
    circle(f, px, py, r, { stroke: C.hot, lw: 2, dash: [4, 3] });
    dot(f, px, py, 2.4, C.yellow);
    text(f, `${prec} μas 精度环`, px - 46, py + r + 22, { color: C.hot, font: '11px sans-serif' });
    text(f, `盖亚的 10 μas ≈ 在月球上看清一枚硬币的厚度`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '天体测量以遥远射电源建立惯性参考架——位置账本的共同零点',
      '视差给距离、自行加视向速度给三维速度：恒星的六维相空间',
      '盖亚释放十亿星数据，银盘翘曲与并合残骸接连被读出',
    ]);
    heading(f, '天体测量：给星星记账');
  },
});
registerViz(astrometry);

/** 引力透镜时间延迟。 */
const lensingTimeDelay = defineViz({
  slug: 'lensing-time-delay', title: '引力透镜时间延迟', animated: true,
  params: { delay: { type: 'range', min: 10, max: 200, default: 100, step: 5, label: '时延 (天)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const delay = num(params, 'delay', 100);
    clear(f);
    // 前景星系与背景类星体的多重像
    const cx = w * 0.32, cy = h * 0.48;
    const R = 54;
    const pulse = 0.6 + 0.4 * Math.sin(f.t * 2);
    circle(f, cx, cy, R, { stroke: `rgba(146,84,222,${pulse})`, lw: 3, fill: 'rgba(146,84,222,0.2)' });
    text(f, '前景星系（透镜）', cx - 52, cy + R + 24, { color: '#9254de', font: '11px sans-serif' });
    // 爱因斯坦环上的四个像
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const x = cx + Math.cos(a) * (R + 34), y = cy + Math.sin(a) * (R + 34);
      const bright = Math.sin(f.t * 2 + k * 1.5) > 0 ? 1 : 0.4;
      dot(f, x, y, 7, `rgba(236,201,75,${bright})`);
      text(f, `像${k + 1}`, x + 10, y + 4, { color: C.warm, font: '10px sans-serif' });
    }
    text(f, '背景类星体被透镜成多个像——光程各不相同', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 两条光变曲线（错时）
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.3, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    for (let k = 0; k < 2; k++) {
      const off = k * (delay / 100) * 1.4;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 260; i++) {
        const t = (i / 260) * 10;
        const p = (t + off + f.t * 0.3) % 10;
        const y = 0.7 + 0.22 * Math.sin(p * 2.1) * Math.cos(p * 0.7) + k * 0.28;
        pts.push([v.sx(t), v.sy(y)]);
      }
      poly(f, pts, { stroke: k === 0 ? C.cool : C.green, lw: 2.2 });
    }
    text(f, `两条光变曲线错开约 ${delay} 天——时延 × 几何 = 哈勃常数`, 56, 44, { color: C.warm, font: '12px sans-serif' });
    text(f, '时间 →（像 1 与像 2 走过的路不一样长）', w - 260, h - 86, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '时延法是称哈勃常数的独立一杆秤——与 CMB 推断、本地测距三方并立',
      '透镜模型与前景星系质量分布的简并是主要系统误差',
      '哈勃张力：三种方法给出的 H₀ 不一致，可能是新物理的裂缝',
    ]);
    heading(f, '引力透镜时间延迟：错时的回声');
  },
});
registerViz(lensingTimeDelay);

/** Ia 超新星宇宙学。 */
const supernovaCosmology = defineViz({
  slug: 'supernova-cosmology', title: 'Ia 超新星宇宙学', animated: true,
  params: { omegaL: { type: 'range', min: 0, max: 1, default: 0.7, step: 0.05, label: 'Ω_Λ（暗能量占比）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const oL = num(params, 'omegaL', 0.7);
    clear(f);
    // 光变曲线（标准izable）
    const sx = w * 0.26, sy = h * 0.36;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * 10;
      const p = (t + f.t * 0.4) % 12;
      const y = p < 2 ? 0.3 + p * 0.35 : Math.exp(-(p - 2.7) * 0.42);
      pts.push([40 + t * ((sx * 2) / 10), sy + 44 - y * 74]);
    }
    poly(f, pts, { stroke: C.hot, lw: 2.8 });
    text(f, 'Ia 光变：宽度定亮度（越宽越亮，可校准）', 40, sy - 46, { color: C.hot, font: '12px sans-serif' });
    // 距离残差 vs 红移（右）
    const v = view(f, { xMin: 0, xMax: 1, yMin: -0.4, yMax: 0.4, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const pts2: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const z = (i / 120) * 0.9 + 0.02;
      const accel = oL * 0.5 * z - (1 - oL) * 0.25 * z;
      pts2.push([v.sx(z), v.sy(accel * Math.min(1, z * 2.2))]);
    }
    poly(f, pts2, { stroke: C.accent, lw: 3 });
    const rand = rng(98);
    for (let i = 0; i < 30; i++) {
      const z = 0.05 + rand() * 0.9;
      const accel = oL * 0.5 * z - (1 - oL) * 0.25 * z;
      dot(f, v.sx(z), v.sy(accel * Math.min(1, z * 2.2) + (rand() - 0.5) * 0.12), 3.4, C.warm);
    }
    text(f, `Ω_Λ = ${oL.toFixed(2)}：${oL > 0.4 ? '高红移超新星比预期更暗——宇宙在加速' : '无暗能量时高红移超新星应更亮'}`, 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '红移 z →', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, 'Δ(m−M)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '1998 年两个团队同时宣布加速膨胀——2011 年诺贝尔物理学奖',
      'Ia 爆发来自白矮星逼近钱德拉塞卡极限——同一批炸法才配叫标准烛光',
      '暗能量占宇宙总能量七成——当代物理学标注的最大空白',
    ]);
    heading(f, 'Ia 超新星：照亮加速膨胀');
  },
});
registerViz(supernovaCosmology);

/** 天体偏振观测。 */
const polarimetry = defineViz({
  slug: 'polarimetry', title: '天体偏振观测', animated: true,
  params: { angle: { type: 'range', min: 0, max: 180, default: 60, step: 5, label: '偏振角 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ang = num(params, 'angle', 60);
    clear(f);
    // 偏振椭圆
    const cx = w * 0.3, cy = h * 0.44;
    const a = (ang * Math.PI) / 180;
    const el: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI * 2;
      const x0 = Math.cos(t) * 76, y0 = Math.sin(t) * 30;
      el.push([cx + x0 * Math.cos(a) - y0 * Math.sin(a), cy + x0 * Math.sin(a) + y0 * Math.cos(a)]);
    }
    poly(f, el, { stroke: C.cool, lw: 2.6 });
    seg(f, cx - 96 * Math.cos(a), cy - 96 * Math.sin(a), cx + 96 * Math.cos(a), cy + 96 * Math.sin(a), `rgba(236,201,75,${0.6 + 0.4 * Math.sin(f.t * 2)})`, 2, );
    text(f, `电矢量振动方向：偏振角 ${ang}°`, cx - 96, cy + 118, { color: C.warm, font: '12px sans-serif' });
    text(f, '偏振光的电矢量在振动——自然光是随机方向的叠加', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 马吕斯曲线（右）
    const v = view(f, { xMin: 0, xMax: 180, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 180; i++) pts.push([v.sx(i), v.sy(Math.pow(Math.cos((i * Math.PI) / 180), 2))]);
    poly(f, pts, { stroke: C.green, lw: 2.6 });
    dot(f, v.sx(ang), v.sy(Math.pow(Math.cos(a), 2)), 5, C.hot);
    text(f, 'I = I₀ cos²θ（马吕斯定律）', w - 320, 44, { color: C.green, font: '12px sans-serif' });
    text(f, '检偏角 θ →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `法拉第旋转角 ∝ λ² ∫n_e B dl：偏振图 = 磁场图`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '散射光的偏振度与散射角相关——反射光在布鲁斯特角变完全线偏振',
      '尘埃偏振是星际磁场与核坍缩方向的唯一探针',
      'CMB 的 B 模搜索要先剔除尘埃偏振——前景与信号的拉锯战',
    ]);
    heading(f, '天体偏振：看不见的几何');
  },
});
registerViz(polarimetry);

/** 时域巡天。 */
const timeDomainAstronomy = defineViz({
  slug: 'time-domain-astronomy', title: '时域巡天', animated: true,
  params: { cadence: { type: 'range', min: 1, max: 30, default: 7, step: 1, label: '重访周期（天）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const cad = num(params, 'cadence', 7);
    clear(f);
    text(f, '同一片天区反复拍——图像相减暴露变化的那一个', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 视场网格与扫描
    const cols = 6, rows = 4;
    const x0 = 60, y0 = 74, cw = (w - 130) / cols, ch = 66;
    const scan = Math.floor((f.t * 1.4) % (cols * rows));
    const rand = rng(17);
    const transient = 13;
    for (let i = 0; i < cols * rows; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const x = x0 + c * cw, y = y0 + r * ch;
      const active = i === scan;
      poly(f, [[x + 3, y + 3], [x + cw - 6, y + 3], [x + cw - 6, y + ch - 6], [x + 3, y + ch - 6]],
        { stroke: active ? C.green : `${C.grid}aa`, lw: active ? 2.4 : 1.2, fill: active ? 'rgba(72,187,120,0.14)' : 'rgba(45,55,72,0.4)' });
      if (i === transient && active) {
        dot(f, x + cw / 2, y + ch / 2, 7, `rgba(245,101,101,${0.6 + 0.4 * Math.sin(f.t * 6)})`);
        text(f, '暂现源！', x + cw / 2 + 12, y + ch / 2 + 4, { color: C.hot, font: '11px sans-serif' });
      } else if (rand() < 0.5) {
        dot(f, x + 8 + rand() * (cw - 20), y + 8 + rand() * (ch - 20), 2, `${C.dim}cc`);
      }
    }
    // 告警链
    const ay = h - 104;
    const chain = ['发现差异', '坐标告警', '全球跟进', '多波段证认'];
    for (let i = 0; i < 4; i++) {
      const x = 70 + i * ((w - 160) / 4);
      const on = (f.t * 0.8) % 1 > i / 4;
      poly(f, [[x, ay], [x + 96, ay], [x + 96, ay + 34], [x, ay + 34]],
        { stroke: on ? C.cool : `${C.grid}aa`, lw: 1.8, fill: on ? 'rgba(66,153,225,0.2)' : 'rgba(45,55,72,0.5)' });
      text(f, chain[i], x + 14, ay + 22, { color: on ? '#fff' : C.dim, font: '12px sans-serif' });
      if (i < 3) text(f, '→', x + 104, ay + 22, { color: C.warm, font: '14px sans-serif' });
    }
    text(f, `重访周期 ${cad} 天：太快浪费时间、太慢漏掉爆发——节奏即发现率`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '暂现源：超新星、潮汐瓦解、引力波对应体——宇宙里没有永远不变的天区',
      'GW170817 的千新星 11 小时内被全球跟进——多信使已成日常流程',
      '薇拉·鲁宾天文台 LSST 把年发现量推到十万量级',
    ]);
    heading(f, '时域巡天：盯住会变的天空');
  },
});
registerViz(timeDomainAstronomy);

/** 观测光谱仪。 */
const spectrograph = defineViz({
  slug: 'spectrograph', title: '观测光谱仪', animated: true,
  params: { lpg: { type: 'range', min: 150, max: 3600, default: 1200, step: 50, label: '光栅刻线 (条/mm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lpg = num(params, 'lpg', 1200);
    clear(f);
    // 狭缝 → 平行光 → 光栅 → 分光
    const sy = h * 0.5, slitX = 70, gratX = w * 0.42;
    seg(f, slitX, sy - 26, slitX, sy + 26, C.dim, 4);
    text(f, '狭缝', slitX - 14, sy + 48, { color: C.dim, font: '11px sans-serif' });
    // 光栅
    for (let i = 0; i < 9; i++) seg(f, gratX, sy - 60 + i * 15, gratX + 26, sy - 60 + i * 15 + 8, C.cool, 2.4);
    text(f, `${lpg} 条/mm`, gratX - 24, sy + 84, { color: C.cool, font: '11px sans-serif' });
    // 入射
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2.4);
    for (const s of [-1, 1]) seg(f, slitX + 6, sy + s * 20, gratX, sy + s * 46, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2);
    // 色散扇（不同波长不同角度）
    const waves: [string, string][] = [
      ['紫 400nm', 'rgba(146,84,222,0.95)'],
      ['青 480nm', 'rgba(66,153,225,0.95)'],
      ['绿 530nm', 'rgba(72,187,120,0.95)'],
      ['黄 580nm', 'rgba(236,201,75,0.95)'],
      ['红 680nm', 'rgba(245,101,101,0.95)'],
    ];
    const spread = 1200 / lpg;
    waves.forEach(([name, color], i) => {
      const a = (-0.5 + i / 4) * spread * 0.9;
      const tipX = w - 74, tipY = sy + Math.sin(a) * 150;
      seg(f, gratX + 26, sy, tipX, tipY, color, 2.6);
      dot(f, tipX, tipY, 4, color);
      text(f, name, tipX - 74, tipY + 4, { color, font: '10px sans-serif' });
    });
    text(f, '光栅方程 mλ = d(sinθᵢ + sinθₘ)：同一角位置对应不同波长', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `刻线越密 → 色散越大；分辨率还受狭缝宽度与焦长限制`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '棱镜靠折射、光栅靠衍射——现代天文光谱仪几乎全是光栅的',
      '多光纤导入让一次观测上千目标——SDSS 巡天的工程核心',
      '注入校准激光频率梳后，径向速度精度进入厘米每秒时代',
    ]);
    heading(f, '观测光谱仪：把光摊平');
  },
});
registerViz(spectrograph);

/** SETI 信号搜索。 */
const setiSignalSearch = defineViz({
  slug: 'seti-signal-search', title: 'SETI 信号搜索', animated: true,
  params: { bw: { type: 'range', min: 1, max: 1000, default: 10, step: 1, label: '信号带宽 (Hz)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const bwHz = num(params, 'bw', 10);
    clear(f);
    // 频谱瀑布图
    const x0 = 60, y0 = 66, fw = w - 130, fh = h * 0.5;
    const cols = 90, rows = 16;
    const cw = fw / cols, chh = fh / rows;
    const rand = rng(55);
    const lineCol = 46 + Math.sin(f.t * 0.5) * 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const noise = 0.12 + rand() * 0.3;
        let a = noise;
        const isLine = Math.abs(c - lineCol) < Math.max(0.6, bwHz / 220);
        if (isLine) a = 0.92;
        const color = isLine ? `rgba(72,187,120,${a})` : `rgba(66,153,225,${a * 0.8})`;
        poly(f, [[x0 + c * cw, y0 + r * chh], [x0 + (c + 1) * cw, y0 + r * chh],
          [x0 + (c + 1) * cw, y0 + (r + 1) * chh], [x0 + c * cw, y0 + (r + 1) * chh]],
          { stroke: 'transparent', fill: color });
      }
    }
    poly(f, [[x0, y0], [x0 + fw, y0], [x0 + fw, y0 + fh], [x0, y0 + fh]], { stroke: `${C.grid}aa`, lw: 1.4 });
    text(f, '频率 →', x0 + fw - 60, y0 + fh + 22, { color: C.dim, font: '11px sans-serif' });
    text(f, '时间 ↓', x0 - 4, y0 - 8, { color: C.dim, font: '11px sans-serif' });
    const isNarrow = bwHz < 100;
    text(f, isNarrow ? '绿色窄线：疑似窄带信号——自然源的谱宽远大于几赫兹' : '带宽过宽：信号摊进噪声——自然源与人造干扰都混进来了',
      30, 44, { color: isNarrow ? C.green : C.warm, font: '13px sans-serif' });
    // 判据卡
    const by = h - 108;
    const checks = ['多普勒漂移（星际信号应因公转移频）', '重复回访命中', '多台站符合排除干扰'];
    checks.forEach((c, i) => {
      const on = (f.t * 0.5) % 1 > i / 3;
      text(f, `${on ? '✓' : '·'} ${c}`, 60, by + i * 24, { color: on ? C.green : C.dim, font: '12px sans-serif' });
    });
    text(f, `当前搜索带宽 ${bwHz} Hz：越窄越像技术文明，但越容易错过`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '德雷克 1960 年奥兹玛计划开启有组织搜寻——至今仍在扩大通量',
      '窄带是技术指纹：自然射电源的谱宽要宽得多',
      '没有信号也是科学：Breakthrough Listen 把上限推进了数个量级',
    ]);
    heading(f, 'SETI：在噪声里找针');
  },
});
registerViz(setiSignalSearch);

/** 暗能量巡天。 */
const darkEnergySurvey = defineViz({
  slug: 'dark-energy-survey', title: '暗能量巡天', animated: true,
  params: { z: { type: 'range', min: 0.2, max: 1.3, default: 0.7, step: 0.05, label: '观测红移 z' } },
  draw: (f) => {
    const { w, h, params } = f;
    const z = num(params, 'z', 0.7);
    clear(f);
    text(f, '弱引力透镜：背景星系形状被前景物质系统性扭曲（放大 1000×）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 前景物质团
    const rand = rng(707);
    const halos: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) halos.push([80 + rand() * (w - 160), 80 + rand() * (h * 0.42), 40 + rand() * 60]);
    for (const [hx, hy, hr] of halos) {
      circle(f, hx, hy, hr, { stroke: 'rgba(146,84,222,0.35)', lw: 2, fill: 'rgba(146,84,222,0.12)' });
    }
    // 背景星系的切变形状
    const gy0 = h * 0.5;
    for (let i = 0; i < 34; i++) {
      const x = 60 + rand() * (w - 120);
      const y = gy0 + rand() * (h * 0.3);
      let best: [number, number, number] | null = null;
      for (const hh of halos) {
        const d = Math.hypot(hh[0] - x, hh[1] - y);
        if (d < hh[2] * 2.2 && (!best || d < Math.hypot(best[0] - x, best[1] - y))) best = hh;
      }
      const wob = Math.sin(f.t * 1.6 + i) * 0.1;
      let ang = rand() * Math.PI, ecc = 0.25;
      if (best) {
        const dx = x - best[0], dy = y - best[1];
        ang = Math.atan2(dy, dx) + Math.PI / 2 + wob;
        ecc = 0.55;
      }
      const len = 16, wid = len * (1 - ecc);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      seg(f, x - ca * len, y - sa * len, x + ca * len, y + sa * len, `rgba(66,153,225,0.85)`, 3);
      seg(f, x - sa * wid, y + ca * wid, x + sa * wid, y - ca * wid, `rgba(66,153,225,0.6)`, 2);
    }
    text(f, '紫色轮廓 = 前景暗物质团；背景椭圆的排列就是剪切场', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    text(f, `观测红移 z=${z.toFixed(2)}：${z > 1 ? '更远的样本约束增长更久的历史' : '近端样本统计强但增长历史短'}`, 30, h - 120, { color: C.cyan, font: '12px sans-serif' });
    footnotes(f, [
      '暗能量看不见摸不着，只能靠它改写宇宙几何与结构增长的方式间接称出来',
      'BAO 是刻在星系分布里的标准尺，与弱透镜、超新星联合定 w',
      'DESI 与 Rubin 时代将检验 w 是否随时间变化——若是，物理学要改写',
    ]);
    heading(f, '暗能量巡天：称量空无');
  },
});
registerViz(darkEnergySurvey);

/** 食双星测质量。 */
const eclipsingBinary = defineViz({
  slug: 'eclipsing-binary', title: '食双星测质量', animated: true,
  params: { incl: { type: 'range', min: 60, max: 90, default: 88, step: 1, label: '轨道倾角 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const inc = num(params, 'incl', 88);
    clear(f);
    // 轨道俯视（左）
    const cx = w * 0.26, cy = h * 0.4;
    const a1 = 54, a2 = 88;
    const orb: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      orb.push([cx + Math.cos(t) * a1, cy + Math.sin(t) * a1 * (inc / 90)]);
    }
    poly(f, orb, { stroke: `${C.dim}88`, lw: 1.4, dash: [5, 4] });
    const th = f.t * 1.3;
    const x1 = cx + Math.cos(th) * a1, y1 = cy + Math.sin(th) * a1 * (inc / 90);
    const x2 = cx - Math.cos(th) * a2, y2 = cy - Math.sin(th) * a2 * (inc / 90);
    circle(f, x1, y1, 24, { fill: 'rgba(236,201,75,0.95)' });
    circle(f, x2, y2, 16, { fill: 'rgba(66,153,225,0.95)' });
    text(f, '两星绕共同质心', cx - 54, cy + 122, { color: C.dim, font: '11px sans-serif' });
    // 光变曲线（右）
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0.6, yMax: 1.06, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    const depth1 = 0.34 * Math.sin((inc * Math.PI) / 180);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 10;
      const p = (t + f.t * 0.35) % 10;
      let y = 1 - 0.02;
      const dip = (c: number, wd: number, d: number) => Math.abs(p - c) < wd ? d * (1 - Math.abs(p - c) / wd) : 0;
      y -= dip(2.5, 0.42, depth1) + dip(7.5, 0.5, depth1 * 0.62);
      y -= 0.03 * Math.cos((p / 10) * Math.PI * 2); // 反射/椭球效应
      pts.push([v.sx(t), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    text(f, '食变光变曲线：主食（深）与次食（浅）', 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '时间（相位）→', w - 140, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `倾角 ${inc}°：越接近 90° 食越深；半径比、倾角与速度幅值联立解出 M 与 R`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '食双星是唯一不依赖模型直接测恒星质量的途径——理论的基准点',
      '食深给半径比、径向速度给速度幅值、食时给倾角——三式联立',
      '大陵五的食变支撑了爱丁顿的恒星内部理论，也量出中子星紧凑度',
    ]);
    heading(f, '食双星：把恒星放上天平');
  },
});
registerViz(eclipsingBinary);
