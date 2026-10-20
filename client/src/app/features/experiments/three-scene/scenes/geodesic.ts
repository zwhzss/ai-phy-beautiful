import type { SceneContext, SceneInstance } from '../types';
/**
 * Geodesic（P136）：弯曲时空中的测地线——行星轨道的几何本性。
 * 物理：在史瓦西度规赤道面内数值积分测地线方程（Binet 形式）
 *   d²u/dφ² + u = GM/h² + 3GM·u²/c²,  u = 1/r
 * 右端第一项为牛顿极限（椭圆），3GMu²/c² 为时空曲率修正（近日点进动）。
 * 自由落体即惯性运动：测试粒子沿测地线，四维加速度 aᵘ = 0。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // Spacetime funnel: z = -c_f/r (in 2D slice)
  const cFunnel = 1.5;
  const radius = 4;
  const segs = 100;
  const rings = 40;
  const funnelGeo = new THREE.BufferGeometry();
  const funnelVerts: number[] = [];
  const funnelUvs: number[] = [];

  for (let j = 0; j <= rings; j++) {
    const r = 0.5 + (j / rings) * (radius - 0.5);
    const z = -cFunnel / Math.max(r, 0.3);
    for (let i = 0; i <= segs; i++) {
      const theta = (i / segs) * 2 * Math.PI;
      funnelVerts.push(r * Math.cos(theta), z, r * Math.sin(theta));
      funnelUvs.push(i / segs, j / rings);
    }
  }

  const funnelIndices: number[] = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i;
      const b = a + 1;
      const c = a + segs + 1;
      const d = c + 1;
      funnelIndices.push(a, b, c);
      funnelIndices.push(b, d, c);
    }
  }

  funnelGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(funnelVerts), 3));
  funnelGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(funnelUvs), 2));
  funnelGeo.setIndex(funnelIndices);
  funnelGeo.computeVertexNormals();

  const funnelMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide,
    wireframe: false
  });
  const funnel = new THREE.Mesh(funnelGeo, funnelMat);
  group.add(funnel);

  // —— 测地线方程 RK4 数值积分（几何单位 G=c=1）——
  const eps = 0.12;              // ε = 3GM/c²（长度量纲，曲率强度）
  const rs = (2 / 3) * eps;      // r_s = 2GM/c²
  const p0 = 1.4;                // 半通径（初值，牛顿极限下 p = h²/GM）
  const e0 = 0.35;               // 偏心率（初值，取近心点出发）
  const aN = 1 / p0;             // GM/h²（牛顿项）
  const dPhi = 0.005;            // 积分步长
  const phiTotal = 2.5 * 2 * Math.PI;
  const rhs = (u: number) => aN - u + eps * u * u; // u'' = GM/h² − u + 3GMu²/c²

  const geoU: number[] = [(1 + e0) / p0]; // u(0) = 1/r_近心点
  const geoPhi: number[] = [0];
  let u = geoU[0], w = 0, phi = 0;        // w = du/dφ
  for (let i = 0; i * dPhi < phiTotal && u < 1 / 0.4; i++) {
    const k1u = w, k1w = rhs(u);
    const k2u = w + dPhi / 2 * k1w, k2w = rhs(u + dPhi / 2 * k1u);
    const k3u = w + dPhi / 2 * k2w, k3w = rhs(u + dPhi / 2 * k2u);
    const k4u = w + dPhi * k3w, k4w = rhs(u + dPhi * k3u);
    u += dPhi / 6 * (k1u + 2 * k2u + 2 * k3u + k4u);
    w += dPhi / 6 * (k1w + 2 * k2w + 2 * k3w + k4w);
    phi += dPhi;
    geoU.push(u);
    geoPhi.push(phi);
  }

  // Geodesic trajectory（真实轨道：偏心椭圆 + 相对论近日点进动）
  const toZ = (r: number) => -cFunnel / Math.max(r, 0.3);
  const geoPts: import('three').Vector3[] = [];
  for (let i = 0; i < geoU.length; i++) {
    const r = 1 / geoU[i];
    geoPts.push(new THREE.Vector3(r * Math.cos(geoPhi[i]), toZ(r), r * Math.sin(geoPhi[i])));
  }
  const geoLineGeo = new THREE.BufferGeometry();
  geoLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geoPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const geoLineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 });
  group.add(new THREE.Line(geoLineGeo, geoLineMat));

  // 近心点进动：连续 u 极大点的 Δφ 平均值减去牛顿的 2π
  const periPhi: number[] = [];
  for (let i = 1; i + 1 < geoU.length; i++) {
    if (geoU[i] > geoU[i - 1] && geoU[i] >= geoU[i + 1]) periPhi.push(geoPhi[i]);
  }
  const precessionDeg =
    periPhi.length >= 2
      ? ((periPhi[periPhi.length - 1] - periPhi[0]) / (periPhi.length - 1) - 2 * Math.PI) * 180 / Math.PI
      : NaN;

  // 漏斗曲面 z = −c_f/r 的高斯曲率（图函数数值公式 K = (f'f''/r)/(1+f'²)²）
  const gaussianK = (r: number) => {
    const fp = cFunnel / (r * r);
    const fpp = -2 * cFunnel / (r * r * r);
    return (fp * fpp / r) / Math.pow(1 + fp * fp, 2);
  };

  // Orbiting particle（沿已积分测地线运动）
  const particleGeo = new THREE.SphereGeometry(0.12, 12, 8);
  const particleMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const particle = new THREE.Mesh(particleGeo, particleMat);
  group.add(particle);

  // Central mass sphere
  const massGeo = new THREE.SphereGeometry(0.4, 24, 16);
  const massMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed });
  group.add(new THREE.Mesh(massGeo, massMat));

  // —— 信息面板（测地线方程、进动、曲率与等效原理）——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 384;
  infoCanvas.height = 180;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(6.4, 3.0);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(0, 3.4, 0);
  group.add(infoPlot);

  const loopSec = 18; // 约 18 秒走完已积分轨道
  const speedIdx = geoPts.length / loopSec;
  let animIdx = 0;
  let lastPanelT = -1;
  return {
    update(t, dt) {
      animIdx += speedIdx * dt;
      if (animIdx >= geoPts.length - 1) animIdx = 0; // 循环重放
      const idx = Math.min(geoPts.length - 1, Math.floor(animIdx));
      particle.position.copy(geoPts[idx]);

      // 面板 5 Hz 刷新（读数与轨迹同源）
      if (t - lastPanelT > 0.2) {
        lastPanelT = t;
        const rr = 1 / geoU[idx];
        const phDeg = geoPhi[idx] * 180 / Math.PI;
        const kk = gaussianK(rr);
        infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
        infoCtx.fillRect(0, 0, 384, 180);
        infoCtx.font = '12px monospace';
        infoCtx.fillStyle = '#f8fafc';
        infoCtx.fillText('测地线方程 d²u/dφ² + u = GM/h² + 3GMu²/c² (u=1/r)', 12, 26);
        infoCtx.fillStyle = '#7dd3fc';
        infoCtx.fillText('弯曲时空中的直线：自由落体 aᵘ=0，惯性运动沿测地线', 12, 48);
        infoCtx.strokeStyle = '#1e293b';
        infoCtx.lineWidth = 1;
        infoCtx.beginPath(); infoCtx.moveTo(12, 58); infoCtx.lineTo(372, 58); infoCtx.stroke();
        infoCtx.fillStyle = '#fbbf24';
        infoCtx.fillText(`r = ${rr.toFixed(3)}    φ = ${phDeg.toFixed(1)}°`, 12, 80);
        infoCtx.fillStyle = '#22c55e';
        infoCtx.fillText(`近日点进动 Δφ = ${isFinite(precessionDeg) ? precessionDeg.toFixed(1) : '--'}°/圈（牛顿极限为 0）`, 12, 102);
        infoCtx.fillStyle = '#f472b6';
        infoCtx.fillText(`漏斗曲率 K = ${kk.toFixed(3)}   r_s = 2GM/c² = ${rs.toFixed(3)}`, 12, 124);
        infoCtx.fillStyle = '#94a3b8';
        infoCtx.fillText(`初值 p=${p0} e=${e0}  RK4 步 Δφ=${dPhi}  共 2.5 圈`, 12, 146);
        infoCtx.fillStyle = '#64748b';
        infoCtx.fillText('橙色球=测试粒子；黄线=已积分测地线', 12, 168);
        infoTex.needsUpdate = true;
      }
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if(mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
      infoTex.dispose();
    }
  };
}
