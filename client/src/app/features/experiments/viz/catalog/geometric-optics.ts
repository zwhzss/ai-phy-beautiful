import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, seg, text } from '../canvas';

/** P12 折射、全反射与临界角。 */
const lensRefraction = defineViz({
  slug: 'lens-refraction',
  title: '折射与全反射',
  params: {
    medium: { type: 'select', options: ['水 n=1.33', '玻璃 n=1.5', '钻石 n=2.42'], default: '水 n=1.33', label: '介质' },
    theta1: { type: 'range', min: 0, max: 85, default: 50, step: 1, label: '入射角 θ₁ (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const medium = str(params, 'medium', '水 n=1.33');
    const n2 = medium.startsWith('水') ? 1.33 : medium.startsWith('钻石') ? 2.42 : 1.5;
    const n1 = 1;
    const th1 = (num(params, 'theta1', 50) * Math.PI) / 180;
    const sinC = n2 > n1 ? n1 / n2 : 0;
    const thetaC = n2 > n1 ? (Math.asin(sinC) * 180) / Math.PI : 0;
    const sin2 = (n1 / n2) * Math.sin(th1);
    const tir = sin2 > 1; // 光密→光疏才有全反射；此处光疏→光密不会 TIR
    const th2 = tir ? 0 : Math.asin(Math.min(1, sin2));

    clear(f);
    const cx = w / 2;
    const iface = h * 0.46;
    // 介质区域
    f.ctx.fillStyle = 'rgba(66, 153, 225, 0.10)';
    f.ctx.fillRect(0, iface, w, h - iface);
    f.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    f.ctx.fillRect(0, 0, w, iface);
    // 界面与法线
    seg(f, 30, iface, w - 30, iface, C.cool, 2.4);
    seg(f, cx, iface - h * 0.34, cx, iface + h * 0.34, `${C.dim}aa`, 1.4);
    text(f, `n₁ = ${n1}（空气）`, 40, iface - 14, { color: C.dim, font: '12px sans-serif' });
    text(f, `n₂ = ${n2}（${medium.split(' ')[0]}）`, 40, iface + 24, { color: C.cool, font: '12px sans-serif' });
    text(f, '法线', cx + 8, iface - h * 0.32, { color: C.dim, font: '11px sans-serif' });

    const R = Math.min(w, h) * 0.34;
    // 入射光线（从左上射向界面）
    const ix = cx - R * Math.sin(th1);
    const iy = iface - R * Math.cos(th1);
    seg(f, ix, iy, cx, iface, C.hot, 2.6);
    dot(f, ix, iy, 4, C.hot);
    // 箭头中点
    const mx = (ix + cx) / 2, my = (iy + iface) / 2;
    text(f, '→', mx - 4, my + 4, { color: C.hot, font: '14px sans-serif' });
    text(f, `θ₁ = ${((th1 * 180) / Math.PI).toFixed(0)}°`, ix - 8, iy - 8, { align: 'right', color: C.hot, font: '12px sans-serif' });

    if (n2 >= n1) {
      // 折射（光疏 → 光密，向法线偏折）
      const rx = cx + R * Math.sin(th2);
      const ry = iface + R * Math.cos(th2);
      seg(f, cx, iface, rx, ry, C.green, 2.6);
      text(f, `θ₂ = ${((th2 * 180) / Math.PI).toFixed(1)}°`, rx + 8, ry + 4, { color: C.green, font: '12px sans-serif' });
      // 反射光
      const fx = cx + R * Math.sin(th1);
      const fy = iface - R * Math.cos(th1);
      seg(f, cx, iface, fx, fy, `${C.warm}aa`, 1.6);
      footnotes(f, [
        `斯涅尔定律：n₁sinθ₁ = n₂sinθ₂ ⇒ ${n1}×sin${((th1 * 180) / Math.PI).toFixed(0)}° = ${n2}×sinθ₂，θ₂ = ${((th2 * 180) / Math.PI).toFixed(1)}°`,
        '光进入光密介质向法线偏折；折射率越大偏折越强 —— 钻石的高折射率产生强色散与"火彩"',
        '光疏→光密方向没有全反射；反向（水→空气）入射角超过临界角 C=arcsin(n₁/n₂) 才发生全反射（光纤原理）',
      ]);
      heading(f, '光的折射：向法线偏折');
    } else {
      // 全反射场景（此参数方向不发生，提示）
      footnotes(f, [`临界角 C = arcsin(${n1}/${n2}) = ${thetaC.toFixed(1)}°（反向入射时）`, '当前方向（空气→介质）不发生全反射']);
      heading(f, '折射');
    }
  },
});
registerViz(lensRefraction);
