import type { SceneContext, SceneInstance } from '../types';

/**
 * 宇宙网（Cosmic Web）：暗物质骨架上的纤维状大尺度结构点云。
 * 物理：星系沿纤维聚集、节点处形成超星系团，空洞几乎无物——N 体模拟的典型产物。
 * 引力不稳定性：12s 一轮从近均匀散布塌缩成网状结构，密度对比增长 δ/δ₀ = (t/t₀)^{2/3}
 * （物质主导期），位置 = 散布态 + (纤维/节点态 − 散布态)·(t/t₀)^{2/3}，面板 5Hz 同源读数。
 * 纤维计数与几何同源：统计粒子实际铺到的不同节点对连线数。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // 结构节点（团簇中心）
  const nodeN = 46;
  const nodes: import('three').Vector3[] = [];
  for (let i = 0; i < nodeN; i++) {
    nodes.push(new THREE.Vector3((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 34, (Math.random() - 0.5) * 70));
  }

  // 粒子：节点团簇 + 纤维（节点连线中点附近）
  const clusterN = 2400;
  const fiberN = 1600;
  const total = clusterN + fiberN;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const cNode = new THREE.Color(0x9db4ff);
  const cFiber = new THREE.Color(0x5e81ff);
  const cVoid = new THREE.Color(0x3b4a7a);
  // 不同节点对（= 真实纤维条数）
  const fiberPairs = new Set<number>();
  // 均匀散布初态（线性时期，供结构增长动画插值）
  const scatterPos = new Float32Array(total * 3);

  const gauss = (): number => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  let i = 0;
  for (; i < clusterN; i++) {
    const n = nodes[i % nodeN];
    const spread = 2.2 + Math.random() * 2.4;
    positions[i * 3] = n.x + gauss() * spread;
    positions[i * 3 + 1] = n.y + gauss() * spread * 0.7;
    positions[i * 3 + 2] = n.z + gauss() * spread;
    const c = Math.random() < 0.75 ? cNode : cVoid;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = 1.4 + Math.random() * 1.6;
  }
  for (; i < total; i++) {
    const a = Math.floor(Math.random() * nodeN);
    let b = Math.floor(Math.random() * nodeN);
    if (b === a) b = (b + 1) % nodeN;
    fiberPairs.add(Math.min(a, b) * nodeN + Math.max(a, b));
    const t = Math.random();
    const jitter = 1.4;
    positions[i * 3] = nodes[a].x + (nodes[b].x - nodes[a].x) * t + gauss() * jitter;
    positions[i * 3 + 1] = nodes[a].y + (nodes[b].y - nodes[a].y) * t + gauss() * jitter * 0.7;
    positions[i * 3 + 2] = nodes[a].z + (nodes[b].z - nodes[a].z) * t + gauss() * jitter;
    colors[i * 3] = cFiber.r;
    colors[i * 3 + 1] = cFiber.g;
    colors[i * 3 + 2] = cFiber.b;
    sizes[i] = 0.9 + Math.random() * 1.0;
  }
  const fiberLineN = fiberPairs.size; // 真实纤维条数（被粒子铺到的不同节点对）
  // 均匀散布初态：与节点云同尺度的盒子内随机
  for (let k = 0; k < total; k++) {
    scatterPos[k * 3] = (Math.random() - 0.5) * 70;
    scatterPos[k * 3 + 1] = (Math.random() - 0.5) * 34;
    scatterPos[k * 3 + 2] = (Math.random() - 0.5) * 70;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(sizes, 1));
  const structPos = Float32Array.from(positions); // 成熟网状终态（塌缩目标）

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float psize;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * (220.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor, a * 0.9);
      }`,
    vertexColors: true,
  });

  const cloud = new THREE.Points(geo, mat);
  group.add(cloud);

  // ===== 面板：纤维/节点/空洞计数 + SDSS巡天说明 =====
  const infoCv = document.createElement('canvas'); infoCv.width = 600; infoCv.height = 160;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const panelMat = new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false });
  const panel = new THREE.Sprite(panelMat);
  panel.scale.set(6.5, (6.5 * 160) / 600, 1); panel.position.set(0, 6.5, 0); panel.renderOrder = 999;
  group.add(panel);

  function drawInfo(g: number, tRel: number): void {
    infoCtx.clearRect(0, 0, 600, 160);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(0, 0, 600, 160);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 2; infoCtx.strokeRect(0, 0, 600, 160);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText('宇宙大尺度结构（引力不稳定性：均匀散布 → 纤维/节点塌缩）', 20, 30);
    infoCtx.fillStyle = '#9db4ff'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText(`节点（超星系团）: ${nodeN}个 | 纤维（节点对连线）: ${fiberLineN}条（铺 ${fiberN} 颗粒子）`, 20, 56);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('SDSS巡天: 覆盖约 1/4 天区, 红移范围 z≈0.1~0.3, 探测超 10⁶ 星系', 20, 82);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '14px "PingFang SC", sans-serif';
    infoCtx.fillText('颜色: 蓝=节点团簇 | 青=纤维丝 | 暗蓝=空洞 | 增长 12s 一轮循环', 20, 106);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 17px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：t/t₀ = ${tRel.toFixed(2)}  δ/δ₀ = (t/t₀)^{2/3} = ${g.toFixed(2)}`, 20, 134);
    infoTex.needsUpdate = true;
  }
  drawInfo(1, 1);

  ctx.camera.position.set(0, 14, 72);

  return {
    update(t, dt) {
      group.rotation.y = t * 0.035;
      group.rotation.x = Math.sin(t * 0.08) * 0.06;
      // 结构增长：δ/δ₀ = (t/t₀)^{2/3}（物质主导期线性增长），12s 一轮由散布态塌缩成网
      const tRel = (t % 12) / 12;
      const g = Math.pow(tRel, 2 / 3);
      for (let k = 0, n = total * 3; k < n; k++) {
        positions[k] = scatterPos[k] + (structPos[k] - scatterPos[k]) * g;
      }
      geo.attributes['position'].needsUpdate = true;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(g, tRel);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      infoTex.dispose();
      panelMat.dispose();
      scene.remove(group);
    },
  };
}
