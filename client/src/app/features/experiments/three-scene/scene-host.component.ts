import { Component, OnDestroy, ViewChild, ElementRef, Input, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { getSceneLoader } from './scene-registry';
import type { SceneInstance } from './types';

/**
 * 3D 场景宿主：动态加载 three 与场景模块，管理渲染循环 / 缩放 / 释放。
 * 首次进入才加载 three 独立 chunk（L2 懒加载，见《架构设计》§6.2）。
 */
@Component({
  selector: 'app-scene-host',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="scene-wrap" #host>
      <div class="scene-overlay" *ngIf="loading()">🌌 正在加载 3D 场景…</div>
      <div class="scene-overlay error" *ngIf="error()">{{ error() }}</div>
      <div class="scene-hint" *ngIf="!loading() && !error()">拖拽旋转 · 滚轮缩放</div>
    </div>
  `,
  styles: [`
    .scene-wrap { position: relative; width: 100%; height: 100%; min-height: 430px;
      background: radial-gradient(ellipse at 30% 20%, #101a33 0%, #070b14 70%);
      border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    .scene-wrap canvas { display: block; }
    .scene-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: #94a3b8; font-size: 0.95rem; background: rgba(7,11,20,0.65); z-index: 2; }
    .scene-overlay.error { color: #fc8181; }
    .scene-hint { position: absolute; left: 12px; bottom: 10px; font-size: 0.72rem; color: #64748b;
      background: rgba(15,23,42,0.6); padding: 0.2rem 0.6rem; border-radius: 10px; pointer-events: none; z-index: 2; }
  `],
})
export class SceneHostComponent implements OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  @Input({ required: true })
  set sceneSlug(slug: string) {
    if (slug && slug !== this._slug) {
      this._slug = slug;
      void this.boot(slug);
    }
  }
  get sceneSlug(): string {
    return this._slug;
  }

  loading = signal(true);
  error = signal('');

  private _slug = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private camera: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private controls: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private scene: any = null;
  private instance: SceneInstance | null = null;
  private raf = 0;
  private lastT = 0;
  private startT = 0;
  private ro: ResizeObserver | null = null;
  private disposed = false;

  private async boot(slug: string): Promise<void> {
    this.disposeAll();
    this.disposed = false;
    this.loading.set(true);
    this.error.set('');
    const loader = getSceneLoader(slug);
    if (!loader) {
      this.error.set('该展项暂无 3D 场景');
      this.loading.set(false);
      return;
    }
    try {
      const [three, addons, sceneMod] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        loader(),
      ]);
      if (this.disposed) return;
      const el = this.hostRef.nativeElement;
      const w = el.clientWidth || 820;
      const h = Math.max(el.clientHeight || 460, 430);

      const renderer = new three.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);

      const scene = new three.Scene();
      scene.background = new three.Color(0x070b14);
      scene.fog = new three.FogExp2(0x070b14, 0.012);

      const camera = new three.PerspectiveCamera(55, w / h, 0.1, 8000);
      camera.position.set(0, 7, 16);

      const controls = new addons.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 3;
      controls.maxDistance = 220;

      // 基础光照（场景可自行增补）
      scene.add(new three.AmbientLight(0x8fa3c7, 0.8));
      const key = new three.DirectionalLight(0xffffff, 1.4);
      key.position.set(6, 10, 8);
      scene.add(key);

      this.renderer = renderer;
      this.scene = scene;
      this.camera = camera;
      this.controls = controls;

      this.instance = sceneMod.create({ THREE: three, scene, camera, renderer, width: w, height: h });

      this.ro = new ResizeObserver(() => {
        const rw = el.clientWidth || w;
        const rh = Math.max(el.clientHeight || h, 430);
        renderer.setSize(rw, rh);
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
      });
      this.ro.observe(el);

      this.startT = performance.now() / 1000;
      this.lastT = 0;
      const loop = (nowMs: number) => {
        this.raf = requestAnimationFrame(loop);
        const t = nowMs / 1000 - this.startT;
        const dt = this.lastT ? Math.min(0.05, t - this.lastT) : 0.016;
        this.lastT = t;
        controls.update();
        this.instance?.update(t, dt);
        renderer.render(scene, camera);
      };
      this.raf = requestAnimationFrame(loop);
      this.loading.set(false);
    } catch (e) {
      if (this.disposed) return;
      this.error.set(`3D 场景加载失败：${(e as Error)?.message ?? e}`);
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.disposeAll();
  }

  private disposeAll(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro?.disconnect();
    this.ro = null;
    try {
      this.instance?.dispose();
    } catch {
      /* ignore */
    }
    this.instance = null;
    try {
      this.controls?.dispose();
    } catch {
      /* ignore */
    }
    this.controls = null;
    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch {
        /* ignore */
      }
      const canvas = this.renderer.domElement as HTMLCanvasElement | undefined;
      canvas?.parentElement?.removeChild(canvas);
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
  }
}
