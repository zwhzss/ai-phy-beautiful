import type { SceneContext, SceneInstance } from '../types';

/**
 * 悬链线（P06）：均质柔性链条/电缆在重力下的平衡形状 y = a·cosh(x/a)。
 * 物理：只受重力的柔性绳索，张力水平分量恒定 → 悬链线而非抛物线；
 *       a = H/(λg) 为水平张力与线密度之比，a 越小垂度越大。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const bag = { geos: [] as { dispose(): void }[], mats: [] as { dispose(): void }[], texs: [] as { dispose(): void }[] };
  const geo = <T extends { dispose(): void }>(g: T) => { bag.geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T) => { bag.mats.push(m); return m; };

  // —— 星空 + 网格 ——
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  const starGeo = geo(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }));
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  const grid = new THREE.GridHelper(22, 22, 0x334155, 0x1e293b);
  grid.position.y = -3.2;
  group.add(grid);

  // —— 两个悬点 ——
  const anchorGeo = geo(new THREE.SphereGeometry(0.16, 16, 16));
  const anchorMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.5, roughness: 0.4 }));
  const A = new THREE.Vector3(-4.5, 1.8, 0);
  const B = new THREE.Vector3(4.5, 1.8, 0);
  [A, B].forEach((p) => { const m = new THREE.Mesh(anchorGeo, anchorMat); m.position.copy(p); group.add(m); });

  // —— 悬链线曲线 ——
  const N = 160;
  const curveGeo = geo(new THREE.BufferGeometry());
  curveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const curveMat = mat(new THREE.LineBasicMaterial({ color: 0x06b6d4 }));
  const curve = new THREE.Line(curveGeo, curveMat);
  group.add(curve);

  // —— 对照抛物线（仅在均布水平载荷时成立） ——
  const parGeo = geo(new THREE.BufferGeometry());
  parGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const parMat = mat(new THREE.LineDashedMaterial({ color: 0xf472b6, gapSize: 0.22, dashSize: 0.3 }));
  const parabola = new THREE.Line(parGeo, parMat);
  group.add(parabola);

  // —— 张力矢量箭头（沿线切向，底部水平分量恒定） ——
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.1, 0xf59e0b, 0.28, 0.14,
  );
  group.add(arrow);

  // —— 说明面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 640; infoCv.height = 200;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = geo(new THREE.CanvasTexture(infoCv));
  const infoMat = mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }));
  const infoPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(7.6, 2.375)), infoMat);
  infoPlane.position.set(0, 4.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(0, 2.6, 12);

  // 悬链线参数：a 越小链越"松"。动画中缓慢改变 a 展示形状族。
  const spanHalf = 4.5;
  const sagOf = (a: number) => a * (Math.cosh(spanHalf / a) - 1);

  let drawInfo = false;
  return {
    update(t) {
      const a = 2.6 + 1.6 * Math.sin(t * 0.35); // 2.0 ~ 4.2
      const aClamped = Math.max(1.6, a);
      const sag = sagOf(aClamped);
      const y0 = 1.8;

      const arr = curveGeo.getAttribute('position') as import('three').BufferAttribute;
      const parr = parGeo.getAttribute('position') as import('three').BufferAttribute;
      // 悬链线固定两端点：y = a·cosh(x/a) − a·cosh(spanHalf/a)，中点下垂 sag
      for (let i = 0; i <= N; i++) {
        const x = -spanHalf + (2 * spanHalf * i) / N;
        arr.setXYZ(i, x, y0 + aClamped * (Math.cosh(x / aClamped) - Math.cosh(spanHalf / aClamped)), 0);
        // 抛物线对照：同跨度、同垂度
        parr.setXYZ(i, x, y0 - sag * (1 - (x / spanHalf) ** 2), 0);
      }
      arr.needsUpdate = true;
      parr.needsUpdate = true;
      parabola.computeLineDistances();

      // 中点张力方向：切向 dy/dx = sinh(x/a)
      const xMid = 0;
      const slope = Math.sinh(xMid / aClamped);
      const dir = new THREE.Vector3(1, -slope, 0).normalize();
      const yMid = y0 + aClamped * (Math.cosh(xMid / aClamped) - Math.cosh(spanHalf / aClamped));
      arrow.position.set(xMid + 0.2, yMid, 0.4);
      arrow.setDirection(dir);
      // 底部张力 T₀ = λg·a；线密度 λ 固定 → T ∝ a
      arrow.setLength(0.6 + 0.16 * aClamped, 0.28, 0.14);

      if (!drawInfo || Math.floor(t * 4) % 2 === 0) {
        drawInfo = true;
        infoCtx.clearRect(0, 0, 640, 200);
        infoCtx.fillStyle = 'rgba(7,11,20,0.78)';
        infoCtx.beginPath();
        (infoCtx as CanvasRenderingContext2D & { roundRect(x: number, y: number, w: number, h: number, r: number): void })
          .roundRect(4, 4, 632, 192, 16);
        infoCtx.fill();
        infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.stroke();

        infoCtx.textAlign = 'center';
        infoCtx.fillStyle = '#f8fafc';
        infoCtx.font = 'bold 34px "PingFang SC", sans-serif';
        infoCtx.fillText('悬链线  y = a·cosh(x/a)', 320, 48);

        infoCtx.font = '30px "PingFang SC", sans-serif';
        infoCtx.fillStyle = '#06b6d4';
        infoCtx.fillText(`青线：悬链线（a = ${aClamped.toFixed(2)}）`, 320, 96);
        infoCtx.fillStyle = '#f472b6';
        infoCtx.fillText('粉虚线：抛物线（同跨度同垂度）', 320, 136);
        infoCtx.fillStyle = '#94a3b8';
        infoCtx.font = '26px "PingFang SC", sans-serif';
        infoCtx.fillText('橙箭头 = 张力方向（水平分量 H = λga 恒定）', 320, 176);
        infoTex.needsUpdate = true;
      }

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      bag.geos.forEach((g) => g.dispose());
      bag.mats.forEach((m) => m.dispose());
      bag.texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
