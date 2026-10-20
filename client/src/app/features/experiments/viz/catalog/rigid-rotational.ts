import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view } from '../canvas';

/** P46 斜面与摩擦力。 */
const inclinedPlane = defineViz({
  slug: 'inclined-plane', title: '斜面与摩擦力', animated: true,
  params: {
    angle: { type: 'range', min: 0, max: 60, default: 30, step: 1, label: '斜面倾角 (°)' },
    mu: { type: 'range', min: 0, max: 0.9, default: 0.4, step: 0.05, label: '摩擦系数 μ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const th = (num(params, 'angle', 30) * Math.PI) / 180;
    const mu = num(params, 'mu', 0.4);
    clear(f);
    const bx = w / 2, by = h - 80, L = Math.min(w * 0.55, 420);
    // 斜面
    poly(f, [[bx - L / 2, by], [bx + L / 2, by], [bx + L / 2, by - L * Math.tan(th)]], { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.15)' } as any);
    // 物块沿面位置（动画：加速下滑或静止）
    const slide = mu < Math.tan(th);
    const prog = slide ? ((f.t * 0.35) % 1) : 0.35;
    const px = bx + L / 2 - prog * L;
    const py = by - (px - (bx - L / 2)) * Math.tan(th);
    poly(f, [[px - 16, py], [px + 16, py], [px + 16, py - 26], [px - 16, py - 26]], { stroke: C.warm, lw: 2, fill: 'rgba(237,137,54,0.35)' } as any);
    // 力箭头：重力/支持/摩擦
    const g = 70;
    seg(f, px, py - 13, px, py - 13 + g, C.hot, 2.4);
    text(f, 'mg', px + 5, py + g - 10, { color: C.hot, font: '11px sans-serif' });
    const nx = Math.sin(th), ny = Math.cos(th);
    seg(f, px, py - 13, px + nx * 46, py - 13 - ny * 46, C.cool, 2);
    text(f, 'N', px + nx * 50, py - 13 - ny * 50, { color: C.cool, font: '11px sans-serif' });
    if (!slide) {
      seg(f, px, py - 13, px - Math.cos(th) * 40, py - 13 - Math.sin(th) * -40, C.green, 2);
      text(f, 'f 静摩擦', px - 96, py - 6, { color: C.green, font: '11px sans-serif' });
    }
    text(f, slide ? 'μ < tanθ：加速下滑' : 'μ ≥ tanθ：保持静止', 30, 44, { color: slide ? C.hot : C.green, font: '13px sans-serif' });

    footnotes(f, [
      `倾角 ${((th * 180) / Math.PI).toFixed(0)}°、μ=${mu}：tanθ=${Math.tan(th).toFixed(2)}，滑动条件一目了然`,
      '临界角 μ=tanθ：摩擦角概念的几何解释——传送带与刹车设计都从这里起步',
      "把物体所受各力沿斜面分解，是'先分解再合成'这一力学方法的第一课",
    ]);
    heading(f, '斜面：受力分解与摩擦判据');
  },
});
registerViz(inclinedPlane);

/** P47 圆周运动与向心力。 */
const circularMotion = defineViz({
  slug: 'circular-motion', title: '圆周运动与向心力', animated: true,
  params: {
    r: { type: 'range', min: 1, max: 6, default: 3, step: 0.5, label: '半径 r (m)' },
    v: { type: 'range', min: 1, max: 30, default: 12, step: 1, label: '线速度 v (m/s)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'r', 3), v = num(params, 'v', 12);
    const ac = (v * v) / R;
    clear(f);
    const cx = w / 2, cy = h / 2 + 10, px = Math.min(w, h) * 0.3;
    const scale = px / 6;
    const rr = R * scale;
    // 轨道与质点
    f.ctx.beginPath(); f.ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 1.6; f.ctx.stroke();
    const a = f.t * (v / R) * 0.6;
    const mx = cx + rr * Math.cos(a), my = cy + rr * Math.sin(a);
    dot(f, mx, my, 11, C.warm);
    // 速度（切向）与向心力（径向）
    seg(f, mx, my, mx - Math.sin(a) * 56, my + Math.cos(a) * 56, C.cool, 2.4);
    text(f, 'v', mx - Math.sin(a) * 62, my + Math.cos(a) * 62, { color: C.cool, font: '13px sans-serif' });
    seg(f, mx, my, mx + Math.cos(a) * 66, my + Math.sin(a) * 66, C.hot, 2.6);
    text(f, 'F=mv²/r', mx + Math.cos(a) * 72, my + Math.sin(a) * 72, { color: C.hot, font: '11px sans-serif' });
    text(f, `a_c = ${ac.toFixed(1)} m/s²　${(ac / 9.8).toFixed(1)} g`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      `r=${R} m、v=${v} m/s：向心加速度 v²/r，速度越大、半径越小，需要的向心力越猛`,
      '向心力不是新力：重力、摩擦、张力都可以充当——过山车顶点靠重力分量，转弯靠静摩擦',
      '速度方向时刻改变，所以匀速圆周运动依然是加速运动——加速度指向圆心',
    ]);
    heading(f, '圆周运动：向心力与临界条件');
  },
});
registerViz(circularMotion);

/** P48 科里奥利力。 */
const coriolis = defineViz({
  slug: 'coriolis', title: '科里奥利力', animated: true,
  params: {
    hemi: { type: 'select', options: ['北半球', '南半球'], default: '北半球', label: '半球' },
    speed: { type: 'range', min: 0.3, max: 2, default: 1, step: 0.1, label: '径向速度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const north = str(params, 'hemi', '北半球') === '北半球';
    const spd = num(params, 'speed', 1);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 旋转盘
    f.ctx.beginPath(); f.ctx.arc(cx, cy, Math.min(w, h) * 0.36, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 2; f.ctx.stroke();
    // 径向运动轨迹（受科氏力偏转）
    const dir = north ? 1 : -1;
    const path: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 3.4;
      const rad = 16 + t * 44 * spd;
      const bend = dir * t * t * 0.24;
      path.push([cx + rad * Math.cos(bend), cy + rad * Math.sin(bend) * 0.8]);
    }
    poly(f, path, { stroke: C.warm, lw: 2.6 });
    dot(f, path[0][0], path[0][1], 6, C.cool);
    dot(f, path[path.length - 1][0], path[path.length - 1][1], 6, C.hot);
    text(f, `轨迹向${north ? '右' : '左'}偏转（${north ? '北' : '南'}半球）`, 30, 44, { color: C.warm, font: '13px sans-serif' });
    text(f, 'F = −2m(ω×v) 惯性力', cx - 90, h - 40, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "旋转参考系中运动物体会受到垂直于速度的科里奥利力——圆盘上的'直线'在地面看是曲线",
      '北半球向右偏：气旋逆时针、河流右岸侵蚀、远程炮弹要校正落点',
      '大气环流的三圈环流、信风方向全都由它组织——地球自转写在天气里',
    ]);
    heading(f, '科里奥利力：旋转世界的偏向');
  },
});
registerViz(coriolis);

/** P49 角动量守恒。 */
const angularMomentum = defineViz({
  slug: 'angular-momentum', title: '角动量守恒', animated: true,
  params: {
    arm: { type: 'range', min: 0.3, max: 1, default: 0.9, step: 0.05, label: '手臂收拢比例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'arm', 0.9);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const baseSpin = 1.1, R = Math.min(w, h) * 0.3;
    // 转速 ∝ 1/收拢度（示意：k 小→转快）
    const omega = baseSpin / (0.35 + k * 0.75);
    const ang = f.t * omega;
    // 转动者（双臂质点）
    for (const s of [1, -1]) {
      const px = cx + Math.cos(ang) * R * k * s;
      const py = cy + Math.sin(ang) * R * k * s * 0.6;
      seg(f, cx, cy, px, py, C.cool, 2.4);
      dot(f, px, py, 12, C.warm);
    }
    dot(f, cx, cy, 6, C.dim);
    // 角速度环
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 1.5; a += 0.1) ring.push([cx + Math.cos(ang + a) * (R * k + 26), cy + Math.sin(ang + a) * (R * k + 26) * 0.6]);
    poly(f, ring, { stroke: `${C.green}aa`, lw: 2 });
    text(f, `ω ∝ 1/${k.toFixed(2)} ≈ ${(1 / k).toFixed(2)}×`, cx - 60, 46, { color: C.green, font: '14px sans-serif' });
    text(f, 'L = Iω = 常数', cx - 52, h - 40, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '收拢手臂转动惯量 I 减小，角速度 ω 反比增大——花样滑冰旋转加速的原理',
      '力矩为零时角动量守恒，与动量、能量并列为三大守恒律',
      '行星在近日点加速也是同一回事：扫面积守恒（开普勒第二定律）就是角动量守恒',
    ]);
    heading(f, '角动量守恒：转速与收拢');
  },
});
registerViz(angularMomentum);

/** P50 刚体转动与转动惯量。 */
const rigidRotation = defineViz({
  slug: 'rigid-rotation', title: '刚体转动与转动惯量', animated: true,
  params: {
    shape: { type: 'select', options: ['细杆(轴在中心)', '细杆(轴在端点)', '圆环', '圆盘'], default: '细杆(轴在中心)', label: '形状' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const shape = str(params, 'shape', '细杆(轴在中心)');
    const I = shape.includes('端点') ? 'ML²/3' : shape === '圆环' ? 'MR²' : shape === '圆盘' ? 'MR²/2' : 'ML²/12';
    clear(f);
    const cx = w / 2, cy = h / 2 + 10, ang = f.t * 1.2;
    const S = Math.min(w, h) * 0.3;
    f.ctx.save();
    f.ctx.translate(cx, cy); f.ctx.rotate(ang);
    if (shape.startsWith('细杆')) {
      const pivotLeft = shape.includes('端点');
      const x0 = pivotLeft ? 0 : -S, x1 = pivotLeft ? S * 2 : S;
      poly(f, [[x0, -7], [x1, -7], [x1, 7], [x0, 7]], { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.35)' } as any);
      dot(f, pivotLeft ? 0 : 0, 0, 6, C.warm);
      if (pivotLeft) { f.ctx.restore(); } else { f.ctx.restore(); }
      dot(f, cx + (pivotLeft ? S : 0) * Math.cos(ang) * 0, cy, 0.1, C.dim); // 轴点已在原点
    } else if (shape === '圆环') {
      f.ctx.beginPath(); f.ctx.arc(0, 0, S, 0, Math.PI * 2);
      f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 12; f.ctx.stroke();
    } else {
      f.ctx.beginPath(); f.ctx.arc(0, 0, S, 0, Math.PI * 2);
      f.ctx.fillStyle = 'rgba(66,153,235,0.35)'; f.ctx.fill();
      f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    }
    f.ctx.restore();
    dot(f, cx, cy, 6, C.warm);
    text(f, `I = ${I}`, 30, 44, { color: C.cyan, font: '15px sans-serif' });

    footnotes(f, [
      '转动惯量由质量分布决定：同样质量，离轴越远越难转——门开在边缘省力',
      '平行轴定理：移轴后 I = I_cm + Md²，质心轴与新轴只差一个距离项',
      '圆环 I=MR² 大于圆盘 MR²/2：滚下斜面时圆环把更多能量留给转动，反而滚得慢',
    ]);
    heading(f, '转动惯量：形状决定惯性');
  },
});
registerViz(rigidRotation);

/** P51 陀螺进动与章动。 */
const gyroscopic = defineViz({
  slug: 'gyroscopic', title: '陀螺进动与章动', animated: true,
  params: {
    tilt: { type: 'range', min: 5, max: 45, default: 20, step: 1, label: '倾角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const tilt = (num(params, 'tilt', 20) * Math.PI) / 180;
    clear(f);
    const cx = w / 2, cy = h - 96, H = Math.min(h * 0.6, 340);
    const prec = f.t * 0.8;
    // 竖直轴
    seg(f, cx, cy, cx, cy - H - 20, `${C.dim}aa`, 1.4);
    text(f, '竖直轴', cx + 8, cy - H - 24, { color: C.dim, font: '11px sans-serif' });
    // 陀螺轴（绕竖直进动）
    const tipX = cx + Math.sin(tilt) * H * Math.cos(prec);
    const tipY = cy - Math.cos(tilt) * H;
    const tipZ = Math.sin(tilt) * H * Math.sin(prec);
    const persp = 1 + tipZ / (H * 6);
    const tx = cx + (tipX - cx) * persp, ty = tipY;
    seg(f, cx, cy, tx, ty, C.cool, 3);
    // 陀螺转子
    f.ctx.beginPath();
    f.ctx.ellipse(tx, ty, 30 * persp, 12 * persp, prec, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(66,153,235,0.5)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    // 进动轨迹
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.08) {
      const px = cx + Math.sin(tilt) * H * Math.cos(a);
      const pz = Math.sin(tilt) * H * Math.sin(a);
      ring.push([cx + (px - cx) * (1 + pz / (H * 6)), cy - Math.cos(tilt) * H]);
    }
    poly(f, ring, { stroke: `${C.warm}77`, lw: 1.4, dash: [5, 4] } as any);
    text(f, `倾角 ${((tilt * 180) / Math.PI).toFixed(0)}°，进动周期 ${((2 * Math.PI) / 0.8).toFixed(1)} s`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '重力矩不改变角动量大小，只改变其方向——自转轴画锥，这就是进动',
      '陀螺仪的定轴性支撑导航：飞机、船舶与航天器的惯性制导核心',
      '章动是进动上的小幅抖动——地球自转轴也在绕黄极画圈，周期约 26000 年',
    ]);
    heading(f, '陀螺进动：不倒的秘密');
  },
});
registerViz(gyroscopic);

/** P52 潮汐力。 */
const tidalForce = defineViz({
  slug: 'tidal-force', title: '潮汐力', animated: true,
  params: {
    moonDist: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '月地距离（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'moonDist', 1);
    clear(f);
    const ex = w * 0.36, ey = h / 2 + 6, R = 46;
    const mx = w * 0.78, my = h / 2 + 6;
    // 地球与潮汐椭球（呼吸形变）
    const bulge = 14 / d;
    f.ctx.beginPath();
    f.ctx.ellipse(ex, ey, R + bulge + Math.sin(f.t * 1.4) * 3, R - bulge * 0.5, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(56,130,215,0.35)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    dot(f, ex, ey, 18, '#3b82f6');
    // 月球
    dot(f, mx, my, 16, C.dim);
    text(f, '月球', mx - 18, my - 26, { color: C.dim, font: '12px sans-serif' });
    // 引力梯度箭头（近侧强远侧弱）
    seg(f, ex + R + bulge + 6, ey, ex + R + bulge + 46, ey, C.hot, 2.6);
    seg(f, ex - R - bulge - 46, ey, ex - R - bulge - 6, ey, `${C.hot}77`, 1.6);
    text(f, '近侧拉力强', ex + R + bulge + 8, ey - 10, { color: C.hot, font: '11px sans-serif' });
    text(f, '远侧弱', ex - R - bulge - 66, ey - 10, { color: `${C.hot}aa`, font: '11px sans-serif' });
    seg(f, ex + R + bulge + 6, ey, mx - 24, ey, `${C.dim}55`, 1);

    footnotes(f, [
      `月地距离 ×${d}：潮汐力是引力的差值（梯度），与距离三次方成反比——越近潮差越猛`,
      "两侧的'拉力差'把海水拉成椭球：面向月球与背向月球各凸起一次 → 每天两次涨落",
      '月球被地球潮汐锁定永远一面朝我们；木卫二的潮汐加热甚至维持着地下海洋',
    ]);
    heading(f, '潮汐力：引力的梯度');
  },
});
registerViz(tidalForce);

/** P53 引力弹弓。 */
const gravityAssist = defineViz({
  slug: 'gravity-assist', title: '引力弹弓', animated: true,
  params: {
    prograde: { type: 'select', options: ['顺行掠过（加速）', '逆行掠过（减速）'], default: '顺行掠过（加速）', label: '掠过方向' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fast = str(params, 'prograde', '顺行掠过（加速）').startsWith('顺行');
    clear(f);
    const px = w * 0.45, py = h / 2 + 6, R = 40;
    // 行星轨道运动方向
    dot(f, px, py, R, C.warm);
    text(f, '行星', px - 20, py - R - 12, { color: C.warm, font: '12px sans-serif' });
    seg(f, px + R + 30, py - 74, px + R + 96, py - 74, `${C.warm}aa`, 2.4);
    text(f, 'V_p →', px + R + 100, py - 70, { color: C.warm, font: '12px sans-serif' });
    // 探测器双曲线轨迹（顺行/逆行镜像）
    const path: [number, number][] = [];
    const s = fast ? 1 : -1;
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * 6 - 3;
      const x = t * 74;
      const y = s * (120 - 150 / (1 + Math.exp(-Math.abs(t) * 1.4))) * (t > 0 ? 1 : -1) * (fast ? 1 : -1);
      path.push([px + x * 0.62, py + y * 0.62]);
    }
    poly(f, path, { stroke: C.cyan, lw: 2.6 });
    dot(f, px - 168, py + (fast ? -86 : 86), 6, C.cool);
    dot(f, px + 168, py + (fast ? 96 : -96), 7, C.hot);
    text(f, '探测器入射', 30, 44, { color: C.cool, font: '12px sans-serif' });
    text(f, fast ? '出射更快（相对行星系）— 能量来自行星公转' : '出射更慢 — 反向借力减速', 30, 66, { color: fast ? C.hot : C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '在行星参考系看是弹性碰撞：速度只换方向不改大小；换回日心系则增减了 2×V_p',
      '旅行者一号借木星与土星加速才达到第三宇宙速度——引力弹弓是深空探测的免费燃料',
      '伽利略号探测木星、卡西尼号借金星与地球五次借力——航线设计是天体力学的芭蕾',
    ]);
    heading(f, '引力弹弓：借行星的速度');
  },
});
registerViz(gravityAssist);

/** P54 霍曼转移轨道。 */
const hohmann = defineViz({
  slug: 'hohmann', title: '霍曼转移轨道', animated: true,
  params: {
    dest: { type: 'select', options: ['地球 → 火星', '地球 → 木星'], default: '地球 → 火星', label: '目标' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const toMars = str(params, 'dest', '地球 → 火星').includes('火星');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const r1 = Math.min(w, h) * 0.19;
    const r2 = toMars ? r1 * 1.52 : r1 * 5.2;
    const drawOrbit = (r: number, color: string, lw: number, dash?: number[]) => {
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.05) pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.62]);
      poly(f, pts, { stroke: color, lw, ...(dash ? { dash } : {}) } as any);
    };
    drawOrbit(r1, `${C.cool}aa`, 1.6);
    drawOrbit(r2, `${C.warm}aa`, 1.6);
    // 转移椭圆（近日点 r1 远日点 r2）
    const aT = (r1 + r2) / 2, cT = aT - r1;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const th = Math.PI + (i / 120) * Math.PI;
      pts.push([cx + cT + aT * Math.cos(th), cy + aT * Math.sin(th) * 0.62]);
    }
    poly(f, pts, { stroke: C.green, lw: 2.4, dash: [7, 5] } as any);
    // 太阳与行星
    dot(f, cx, cy, 13, C.warm);
    const t1 = (f.t * 0.5) % (Math.PI * 2);
    dot(f, cx + r1 * Math.cos(t1), cy + r1 * Math.sin(t1) * 0.62, 7, C.cool);
    const t2 = Math.PI + ((f.t * 0.5) / Math.sqrt(Math.pow(r2 / r1, 3))) % (Math.PI * 2);
    dot(f, cx + r2 * Math.cos(t2), cy + r2 * Math.sin(t2) * 0.62, 7, C.hot);
    text(f, '地球', cx + r1 * Math.cos(t1) - 16, cy + r1 * Math.sin(t1) * 0.62 - 14, { color: C.cool, font: '11px sans-serif' });
    text(f, toMars ? '火星' : '木星', cx + r2 * Math.cos(t2) - 16, cy + r2 * Math.sin(t2) * 0.62 - 14, { color: C.hot, font: '11px sans-serif' });
    text(f, '转移椭圆（Δv₁ 近日点加速 → Δv₂ 圆化）', 30, 44, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      `地球→${toMars ? '火星' : '木星'}：两次点火的最小能量方案，航程约半个转移周期`,
      '开普勒第三定律决定飞行时间：半长轴立方与周期平方成正比——去火星约 9 个月',
      '错失窗口就多烧燃料：霍曼转移的入门处与到达处必须与目标行星同步',
    ]);
    heading(f, '霍曼转移：最低能耗的星际摆渡');
  },
});
registerViz(hohmann);

/** P55 完全失重与轨道运动。 */
const weightlessness = defineViz({
  slug: 'weightlessness', title: '完全失重与轨道运动', animated: true,
  params: {
    alt: { type: 'range', min: 200, max: 40000, default: 400, step: 100, label: '轨道高度 (km)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const alt = num(params, 'alt', 400);
    clear(f);
    const cx = w / 2, cy = h / 2 + 20, R = Math.min(w, h) * 0.2;
    // 地球
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(56,130,215,0.5)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    text(f, '地球', cx - 18, cy + 4, { color: '#fff', font: '13px sans-serif' });
    // 轨道（高度→半径示意）
    const rr = R + 24 + (alt / 40000) * Math.min(w, h) * 0.26;
    f.ctx.beginPath(); f.ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 1.4; f.ctx.setLineDash([6, 5]); f.ctx.stroke(); f.ctx.setLineDash([]);
    // 卫星（自由下落）
    const a = f.t * 1.1;
    const sx = cx + rr * Math.cos(a), sy = cy + rr * Math.sin(a);
    dot(f, sx, sy, 8, C.warm);
    // 速度与引力箭头
    seg(f, sx, sy, sx - Math.sin(a) * 44, sy + Math.cos(a) * 44, C.cyan, 2);
    seg(f, sx, sy, sx + Math.cos(a) * 34, sy + Math.sin(a) * 34, `${C.hot}aa`, 2);
    text(f, 'v', sx - Math.sin(a) * 50, sy + Math.cos(a) * 50, { color: C.cyan, font: '12px sans-serif' });
    text(f, 'g≈8.7 m/s²（400km 处仍有 87% 地面引力！）', 30, 44, { color: C.hot, font: '12px sans-serif' });

    footnotes(f, [
      `轨道高度 ${alt} km：宇航员不是'没有引力'，而是与空间站一起以约 7.7 km/s 持续下落`,
      "速度不够会坠回（弹道），太快会逸出（逃逸）——轨道是恰好'总也落不到'的精密速度`,",
      '微重力环境让蛋白晶体生长、材料制备与失重实验成为可能',
    ]);
    heading(f, '轨道即自由落体：失重的真相');
  },
});
registerViz(weightlessness);

/** P56 混沌双摆。 */
const pendulumChaos = defineViz({
  slug: 'pendulum-chaos', title: '混沌双摆', animated: true,
  params: {
    l2: { type: 'range', min: 0.3, max: 1, default: 0.7, step: 0.05, label: '下摆长度比例' },
    seed: { type: 'range', min: 1, max: 10, default: 3, step: 1, label: '初条件微扰种子' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const l2r = num(params, 'l2', 0.7);
    const sd = num(params, 'seed', 3);
    clear(f);
    // 简化双摆：两个单摆串联（演示用近似动力学，非严格数值积分）
    const L1 = Math.min(h * 0.3, 170), L2 = L1 * l2r;
    const g = 9.8;
    const th1 = 1.1 * Math.cos(f.t * 2.1 + sd * 0.7) * Math.exp(-f.t * 0);
    const th2 = 1.4 * Math.cos(f.t * 3.1 + sd * 1.3);
    const px = w / 2, py = 64;
    const x1 = px + L1 * Math.sin(th1), y1 = py + L1 * Math.cos(th1);
    const x2 = x1 + L2 * Math.sin(th1 + th2), y2 = y1 + L2 * Math.cos(th1 + th2);
    seg(f, px, py, x1, y1, C.cool, 2.4);
    seg(f, x1, y1, x2, y2, C.warm, 2.4);
    dot(f, px, py, 4, C.dim);
    dot(f, x1, y1, 9, C.cool);
    dot(f, x2, y2, 9, C.warm);
    // 轨迹（末端质点历史轨迹用时间参数采样）
    const trail: [number, number][] = [];
    for (let i = 0; i <= 150; i++) {
      const tt = f.t - i * 0.02;
      if (tt < 0) break;
      const a1 = 1.1 * Math.cos(tt * 2.1 + sd * 0.7);
      const a2 = 1.4 * Math.cos(tt * 3.1 + sd * 1.3);
      const tx = px + L1 * Math.sin(a1) + L2 * Math.sin(a1 + a2);
      const ty = py + L1 * Math.cos(a1) + L2 * Math.cos(a1 + a2);
      trail.push([tx, ty]);
    }
    poly(f, trail, { stroke: `${C.warm}55`, lw: 1.2 });
    text(f, `微扰种子 ${sd}：改变初条件，轨迹面目全非`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '双摆只有两个自由度，却无法解析求解——轨迹看似随机却永不重复',
      '对初条件的指数敏感即混沌：初始 1° 的差别，十秒后方向完全不同（蝴蝶效应的力学版）',
      '真实双摆需数值积分（龙格-库塔）；此处为教学近似，重点看轨迹的不可预测性',
    ]);
    heading(f, '混沌双摆：确定性中的不可预测');
  },
});
registerViz(pendulumChaos);

/** P57 滚动与滑动摩擦。 */
const rollingFriction = defineViz({
  slug: 'rolling-friction', title: '滚动与滑动摩擦', animated: true,
  params: {
    mode: { type: 'select', options: ['滑动（拖动）', '滚动（轮子）'], default: '滚动（轮子）', label: '运动方式' },
    slope: { type: 'range', min: 0, max: 20, default: 6, step: 1, label: '斜面倾角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rolling = str(params, 'mode', '滚动（轮子）').startsWith('滚动');
    const ang = (num(params, 'slope', 6) * Math.PI) / 180;
    clear(f);
    const by = h - 90, L = Math.min(w * 0.7, 560);
    poly(f, [[60, by], [60 + L, by - L * Math.tan(ang)]], { stroke: C.dim, lw: 2.4 } as any);
    const muDyn = rolling ? 0.005 : 0.35;
    const prog = ((f.t * (rolling ? 0.22 : 0.12)) % 1);
    const px = 60 + prog * L;
    const py = by - (px - 60) * Math.tan(ang);
    if (rolling) {
      dot(f, px, py - 14, 14, C.cool);
      // 滚动标记（辐条）
      const rot = (px - 60) / 14;
      for (let k = 0; k < 4; k++) {
        const aa = rot + (k * Math.PI) / 2;
        seg(f, px, py - 14, px + Math.cos(aa) * 12, py - 14 + Math.sin(aa) * 12, '#fff', 1.4);
      }
    } else {
      poly(f, [[px - 14, py - 4], [px + 14, py - 4], [px + 14, py - 26], [px - 14, py - 26]], { stroke: C.warm, lw: 2, fill: 'rgba(237,137,54,0.35)' } as any);
    }
    text(f, rolling ? 'μ_滚 ≈ 0.005（轴承）' : 'μ_滑 ≈ 0.35', 30, 44, { color: rolling ? C.green : C.hot, font: '13px sans-serif' });
    text(f, `滑动摩擦 ≈ 滚动摩擦的 ${(0.35 / 0.005).toFixed(0)} 倍（同材料示意）`, 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '滚动时接触点瞬时静止，阻力主要来自形变迟滞而非滑动剪切——所以轮子省力',
      '车胎气压不足→形变增大→滚动摩擦上升→费油：省油从打足气开始',
      '斜面倾角越大下滑越快；摩擦系数决定它是否一开始就能动（tanθ 与 μ 的比较）',
    ]);
    heading(f, '滚与滑：摩擦的两种形态');
  },
});
registerViz(rollingFriction);
