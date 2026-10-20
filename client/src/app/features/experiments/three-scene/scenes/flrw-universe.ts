import type { SceneContext, SceneInstance } from '../types';
/** FLRW universe（P148）：膨胀宇宙，标度因子 a(t)。
 *  本模型（k=0 平坦空间切片）：物质主导期 a(t) = (t/3)^{2/3}（t<3，大爆炸 a(0)=0），
 *  暗能量主导期 a(t) = e^{0.4(t−3)}（t≥3，两段在 t=3 处 a=1 连续）；H = ȧ/a 由同一 aOf 数值差分。
 *  静态 a(t) 曲线、星系壳层膨胀动画与面板读数共用同一 aOf——严格同源。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 唯一的 a(t)（曲线、动画、读数共用） ——
  const T_SWITCH = 3, TDRAW = 7; // 物质期切换时刻 / 时间轴显示上限（a(7)≈4.95，世界尺度可控）
  const aOf = (t: number): number => (t < T_SWITCH ? Math.pow(t / T_SWITCH, 2 / 3) : Math.exp(0.4 * (t - T_SWITCH)));

  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // Grid of galaxies on expanding sphere
  const galaxyCount = 80;
  const galaxyPositions: import('three').Vector3[] = [];
  const galaxyMeshes: import("three").Mesh[] = [];

  for (let i = 0; i < galaxyCount; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / galaxyCount);
    const phi = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 1.0;
    galaxyPositions.push(new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta)
    ));

    const colors = [0x38bdf8, 0xfb923c, 0x4ade80, 0xf472b6, 0xfbbf24];
    const gGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 8, 6);
    const gMat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
    const mesh = new THREE.Mesh(gGeo, gMat);
    mesh.position.copy(galaxyPositions[i]);
    group.add(mesh);
    galaxyMeshes.push(mesh);
  }

  // Scale factor curve (a vs proper time) — 与动画共用 aOf，t 轴上限 TDRAW
  const N = 200;
  const curvePts: import('three').Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TDRAW;
    curvePts.push(new THREE.Vector3(t, aOf(t), 3.5));
  }
  const curveGeo = new THREE.BufferGeometry();
  curveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(curvePts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(curveGeo, new THREE.LineBasicMaterial({ color: 0xa78bfa })));

  // Axis for plot
  const axPts: import('three').Vector3[] = [];
  axPts.push(new THREE.Vector3(0, 0, 3.5)); axPts.push(new THREE.Vector3(TDRAW, 0, 3.5));
  axPts.push(new THREE.Vector3(0, 0, 3.5)); axPts.push(new THREE.Vector3(0, 5.2, 3.5));
  const axGeo = new THREE.BufferGeometry();
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(axPts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(axGeo, new THREE.LineBasicMaterial({ color: 0x64748b })));

  // Labels
  const mkLabel = (text: string, x: number, y: number, z: number, color: string) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(2.0, 0.38, 1);
    group.add(sprite);
  };

  mkLabel('a(t) — 标度因子', 3.5, 5.45, 3.5, '#a78bfa');
  mkLabel('t (proper time, 0~7)', 3.5, -0.4, 3.5, '#94a3b8');
  mkLabel('a', 0.3, 4.8, 3.5, '#94a3b8');

  // Panel for a(t) and H(t)
  const panelCv = document.createElement('canvas');
  panelCv.width = 200; panelCv.height = 140;
  const pctx = panelCv.getContext('2d')!;
  const panelTex = new THREE.CanvasTexture(panelCv);
  const panelMat = new THREE.MeshBasicMaterial({ map: panelTex, transparent: true });
  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.96), panelMat);
  group.add(panelMesh);
  panelMesh.position.set(-3.5, 3.2, 2.0);

  function drawPanel(aVal: number, t: number) {
    pctx.clearRect(0, 0, 200, 140);
    pctx.fillStyle = '#1e293b';
    pctx.fillRect(0, 0, 200, 140);
    pctx.fillStyle = '#f8fafc';
    pctx.font = '14px monospace';
    pctx.fillText(`t = ${t.toFixed(1)}`, 10, 26);
    pctx.fillText(`a(t) = ${aVal.toFixed(3)}`, 10, 46);
    // Hubble parameter H = ȧ/a —— 与 a(t) 同一 aOf 数值差分（同源）
    const dh = 0.01;
    const H = (aOf(t + dh) - aOf(t)) / dh / aVal;
    pctx.fillText(`H(t) ≈ ${H.toFixed(3)}`, 10, 66);
    pctx.fillStyle = '#94a3b8';
    pctx.font = '11px monospace';
    pctx.fillText('a: t^⅔ → exp[0.4(t−3)]', 10, 88);
    pctx.fillText('曲率 k=0 平坦（k=±1 未画）', 10, 106);
    pctx.fillText('单调膨胀：a(t) 持续增大，v ∝ d', 10, 124);
    panelTex.needsUpdate = true;
  }

  let animT = 0;
  return {
    update(t, dt) {
      animT += dt;

      // 动画在曲线定义域内循环：t ∈ [0.25, TDRAW]（14s 一轮，a 从 ~0.19 到 ~4.95）
      const tProper = 0.25 + (TDRAW - 0.25) * ((animT % 14) / 14);
      const aVal = aOf(tProper); // 与静态曲线同一函数

      // Expand galaxies monotonically: 壳层半径 ∝ a(t)
      galaxyMeshes.forEach((mesh, i) => {
        const basePos = galaxyPositions[i];
        mesh.position.set(
          basePos.x * aVal,
          basePos.y * aVal,
          basePos.z * aVal,
        );
      });

      // 面板 5Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawPanel(aVal, tProper);
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
      panelTex.dispose();
      starGeo.dispose(); starMat.dispose();
    }
  };
}
