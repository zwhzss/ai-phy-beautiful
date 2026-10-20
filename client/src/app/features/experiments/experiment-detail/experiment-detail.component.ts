import { Component, OnInit, OnDestroy, signal, computed, ViewChild, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { ApiService, Experiment } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NarrationService } from '../../../core/services/narration.service';
import { ParamConfig } from '../components/param-panel/param-panel.component';
import { vizSchema } from '../viz';
import { VizCanvasComponent } from '../components/viz-canvas/viz-canvas.component';
import { ParamPanelComponent } from '../components/param-panel/param-panel.component';
import { FormulaPanelComponent } from '../components/formula-panel/formula-panel.component';
import { NarrationOverlayComponent } from '../components/narration-overlay/narration-overlay.component';
import { AiTeachPanelComponent } from '../components/ai-teach-panel/ai-teach-panel.component';
import { AiGraphCanvasComponent } from '../components/ai-graph-canvas/ai-graph-canvas.component';
import { SceneHostComponent } from '../three-scene/scene-host.component';
import { hasScene } from '../three-scene/scene-registry';

@Component({
  selector: 'app-experiment-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, NgIf, NgFor, VizCanvasComponent, ParamPanelComponent, FormulaPanelComponent, NarrationOverlayComponent, AiTeachPanelComponent, AiGraphCanvasComponent, SceneHostComponent],
  template: `
    <div class="experiment-page" *ngIf="experiment(); else loading">
      <!-- Header -->
      <div class="exp-header">
        <div>
          <nav class="breadcrumb">
            <a routerLink="/">首页</a>
            <span class="crumb-sep">/</span>
            <a [routerLink]="['/']" [queryParams]="{ difficulty: experiment()!.difficulty }">{{ experiment()!.level }}</a>
            <ng-container *ngIf="experiment()!.category as cat">
              <span class="crumb-sep">/</span>
              <a [routerLink]="['/']" [queryParams]="categoryQuery()">{{ cat.name }}</a>
            </ng-container>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">{{ experiment()!.title }}</span>
          </nav>
          <h1>{{ experiment()!.title }}</h1>
          <div class="exp-meta">
            <span class="badge badge-{{ experiment()!.difficulty }}">{{ getDifficultyLabel(experiment()!.difficulty) }}</span>
          </div>
        </div>
        <div class="exp-actions">
          <button (click)="startNarration()" class="btn-narrate" *ngIf="!isNarrating">
            🎧 开始讲解
          </button>
          <button (click)="toggleBookmark()" class="btn-bookmark">
            {{ isBookmarked ? '★ 已收藏' : '☆ 收藏' }}
          </button>
        </div>
      </div>

      <div class="narration-notice" *ngIf="narrationNotice()">
        {{ narrationNotice() }}
      </div>

      <!-- Main Content -->
      <div class="exp-content">
        <!-- Visualization Area -->
        <div class="viz-area">
          <!-- 当前生效版本是 AI 版：有 graph 就画 AI 图形；没有 graph 就明确提示，
               不再退回种子图形 —— 否则会出现「文稿/配音是 AI 版、图形是种子版」的错配。 -->
          <!-- 2D/3D 视图切换（仅具备 3D 场景的展项显示） -->
          <div class="view-switch" *ngIf="has3D()">
            <button type="button" [class.active]="viewMode === '2d'" (click)="setViewMode('2d')">◫ 2D 解释图</button>
            <button type="button" [class.active]="viewMode === '3d'" (click)="setViewMode('3d')">◈ 3D 沉浸场景</button>
          </div>

          <ng-container *ngIf="viewMode === '2d' || !has3D()">
          <ng-container *ngIf="isAiSource; else seedViz">
            <div class="viz-block" *ngIf="parsedGraph(); else aiNoGraph">
              <div class="viz-tag">AI 图形（随参数实时重绘）</div>
              <app-ai-graph-canvas
                [graph]="parsedGraph()"
                [params]="params"
                [width]="800"
                [height]="520"
              ></app-ai-graph-canvas>
            </div>

            <ng-template #aiNoGraph>
              <div class="viz-block viz-empty">
                <div class="viz-tag">AI 版</div>
                <p class="viz-empty-title">AI 版暂无图形数据</p>
                <p class="viz-empty-hint">
                  当前生效的是 AI 版教学内容，但这一版没有给出图形数据。为避免「文稿/配音是 AI 版、图形却是种子版」的错配，
                  此处不显示种子版图形：可在「AI 教学」里重新生成，或点「📄 文稿（种子版）」切回种子版查看其图形。
                </p>
              </div>
            </ng-template>
          </ng-container>
          </ng-container>

          <!-- L2 3D 沉浸场景（three 独立 chunk 懒加载） -->
          <div class="viz-block scene-block" *ngIf="viewMode === '3d' && has3D()">
            <div class="viz-tag">3D 沉浸场景 · Three.js</div>
            <app-scene-host [sceneSlug]="experiment()!.slug"></app-scene-host>
          </div>

          <ng-template #seedViz>
            <viz-canvas
              [experimentSlug]="experiment()!.slug"
              [params]="params"
              [width]="800"
              [height]="520"
            ></viz-canvas>
          </ng-template>

          <!-- Parameter Panel -->
          <param-panel
            [schema]="paramsSchema"
            (paramsChange)="onParamChange($event)"
          ></param-panel>

          <!-- AI 教学面板（todo.txt 需求 1：AI 教学 tab + 流式生成 + 取消/重新生成） -->
          <app-ai-teach-panel
            [experimentId]="experiment()!.id"
            [slug]="experiment()!.slug"
            (generated)="onAiGenerated()"
          ></app-ai-teach-panel>
        </div>

        <!-- Info Panel -->
        <div class="info-panel">
          <!-- Description -->
          <section class="info-section">
            <h2>简介</h2>
            <p>{{ experiment()?.description }}</p>
          </section>

          <!-- Formulas -->
          <formula-panel [formulas]="parsedFormulas()"></formula-panel>

          <!-- History -->
          <section class="info-section" *ngIf="parsedHistory()?.background">
            <h2>历史背景</h2>
            <p>{{ parsedHistory()?.background }}</p>
            <div class="mathematician" *ngIf="parsedHistory()?.mathematician">
              <strong>👤 {{ parsedHistory().mathematician }}</strong>
              <p>{{ parsedHistory()?.story }}</p>
            </div>
          </section>

          <!-- Applications -->
          <section class="info-section" *ngIf="parsedApps().length">
            <h2>实际应用</h2>
            <ul>
              <li *ngFor="let app of parsedApps()">
                <strong>{{ app.title }}</strong>
                <p>{{ app.desc }}</p>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <!-- Narration Overlay -->
      <narration-overlay
        *ngIf="isNarrating"
        [experimentSlug]="experiment()!.slug"
        [graph]="parsedGraph()"
        [contentSource]="experiment()!.content_source ?? 'seed'"
        [params]="params"
        [paramsSchema]="paramsSchema"
        (exit)="exitNarration()"
      ></narration-overlay>
    </div>

    <ng-template #loading>
      <div class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .view-switch { display: flex; gap: 0.5rem; margin-bottom: 0.7rem; }
    .view-switch button { padding: 0.45rem 1.1rem; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; cursor: pointer; font-size: 0.88rem; color: #4a5568; }
    .view-switch button.active { background: linear-gradient(135deg, #667eea, #764ba2); border-color: transparent; color: #fff; font-weight: 600; }
    .scene-block { position: relative; }
    .experiment-page { max-width: 1400px; margin: 0 auto; }
    .exp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .breadcrumb { font-size: 0.875rem; color: #718096; margin-bottom: 0.5rem; }
    .breadcrumb a { color: #667eea; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .crumb-sep { color: #cbd5e0; margin: 0 0.35rem; }
    .crumb-current { color: #4a5568; }
    .exp-header h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .exp-meta { display: flex; gap: 0.75rem; align-items: center; }
    .badge { padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
    .badge-basic { background: #c6f6d5; color: #22543d; }
    .badge-intro { background: #bee3f8; color: #2a4365; }
    .badge-intermediate { background: #feebc8; color: #7b341e; }
    .badge-advanced { background: #fed7d7; color: #742a2a; }
    .badge-professional { background: #e9d8fd; color: #44337a; }
    .badge-academic { background: #fed7d7; color: #742a2a; }
    .exp-actions { display: flex; gap: 0.75rem; }
    .btn-narrate { padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
    .btn-bookmark { padding: 0.75rem 1.5rem; background: white; color: #a0aec0; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 1rem; }
    .exp-content { display: grid; grid-template-columns: 1fr 380px; gap: 1.5rem; }
    .viz-area { display: flex; flex-direction: column; gap: 1rem; }
    .viz-block { position: relative; }
    .viz-empty { background: #fff; border: 1px dashed #cbd5e0; border-radius: 12px; padding: 2rem; }
    .viz-empty-title { color: #2d3748; font-weight: 600; font-size: 1.05rem; margin: 0.75rem 0 0.5rem; }
    .viz-empty-hint { color: #718096; font-size: 0.85rem; line-height: 1.8; margin: 0; }
    .viz-tag { position: absolute; top: 8px; right: 12px; z-index: 2; background: rgba(237,137,54,0.9); color: #fff; font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 8px; }
    .info-panel { display: flex; flex-direction: column; gap: 1.25rem; }
    .info-section { background: white; padding: 1.25rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .info-section h2 { font-size: 1.1rem; margin-bottom: 0.75rem; color: #2d3748; }
    .info-section p { font-size: 0.9rem; color: #4a5568; line-height: 1.7; }
    .mathematician { margin-top: 0.75rem; padding: 0.75rem; background: #f7fafc; border-radius: 8px; }
    .mathematician p { font-size: 0.85rem; margin-top: 0.25rem; }
    .info-section ul { list-style: none; padding: 0; }
    .info-section li { padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0; }
    .info-section li:last-child { border-bottom: none; }
    .info-section li strong { display: block; margin-bottom: 0.25rem; }
    .info-section li p { font-size: 0.85rem; margin: 0; }
    .loading-state { text-align: center; padding: 4rem; color: #a0aec0; }
    .narration-notice { margin: -1rem 0 1.5rem; padding: 0.75rem 1rem; background: #fffaf0; border: 1px solid #f6ad55; color: #975a16; border-radius: 8px; font-size: 0.875rem; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 900px) {
      .exp-content { grid-template-columns: 1fr; }
    }
  `]
})
export class ExperimentDetailComponent implements OnInit, OnDestroy {
  /** 视图模式：2D 解释图（默认）或 3D 沉浸场景 */
  viewMode: '2d' | '3d' = '2d';
  experiment = signal<Experiment | null>(null);
  isNarrating = false;
  isBookmarked = false;
  voice: 'yunxi' | 'xiaoxiao' = 'yunxi';
  params: Record<string, any> = {};
  /** 参数面板使用的 schema（initParams 时缓存，避免每次变更检测都产生新对象引用） */
  paramsSchema: Record<string, ParamConfig> = {};
  /** 讲解稿件不可用时的提示信息 */
  narrationNotice = signal('');
  /** 已上报「已完成」的实验 id（避免重复请求） */
  private completedReported = 0;

  @ViewChild(NarrationOverlayComponent) narrationOverlay!: NarrationOverlayComponent;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private narration: NarrationService,
    private auth: AuthService,
  ) {
    // 学习进度：讲解播放到最后一句并停止时，把该实验记为「已完成」。
    // （「已学习」由打开实验时调用 touchProgress 记录，两者互不影响。）
    effect(() => {
      const total = this.narration.totalLines();
      const index = this.narration.currentIndex();
      const playing = this.narration.isPlaying();
      if (!playing && total > 0 && index >= total - 1) {
        this.markCompleted();
      }
    });
  }

  /** 记录「已学习」：进入实验详情页即上报（需登录，幂等，失败静默）。 */
  private touchProgress(experimentId: number): void {
    if (!this.auth.isLoggedIn()) return;
    this.api.touchProgress(experimentId).subscribe({ error: () => { /* 进度上报失败不影响浏览 */ } });
  }

  /** 记录「已完成」：讲解播放到最后一节后调用，同一实验只上报一次。 */
  private markCompleted(): void {
    const exp = this.experiment();
    if (!exp || !this.auth.isLoggedIn() || this.completedReported === exp.id) return;
    this.completedReported = exp.id;
    this.api
      .updateProgress(exp.id, {
        line_index: this.narration.currentIndex(),
        duration_sec: Math.round(this.narration.totalDurationMs() / 1000),
        completed: true,
      })
      .subscribe({ error: () => { this.completedReported = 0; } });
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.loadExperiment(slug);
    }
  }

  ngOnDestroy(): void {
    this.narration.stop();
  }

  /** 面包屑「分类」链接的查询参数：同时保留年级与分类筛选，回到首页即恢复筛选结果。 */
  categoryQuery(): Record<string, string> {
    const exp = this.experiment();
    const query: Record<string, string> = {};
    if (exp?.difficulty) query['difficulty'] = exp.difficulty;
    if (exp?.category?.slug) query['category'] = exp.category.slug;
    return query;
  }

  /**
   * AI 生成完成后回调：重新加载实验详情。
   * 讲解稿与 params_schema（图形参数）都会以新数据覆盖旧内容。
   */
  onAiGenerated(): void {
    const exp = this.experiment();
    if (exp) this.loadExperiment(exp.slug);
  }

  loadExperiment(slug: string): void {
    this.api.getExperimentBySlug(slug).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.experiment.set(resp.data);
          this.initParams(resp.data.slug, resp.data.params_schema);
          this.loadBookmarkState(resp.data.id);
          // 学习进度：打开实验即计入「已学习」
          this.touchProgress(resp.data.id);
        }
      },
    });
  }

  /** 登录状态下同步收藏状态（未登录时跳过，避免无谓的 401）。 */
  private loadBookmarkState(experimentId: number): void {
    if (!this.auth.isLoggedIn()) return;
    this.api.isBookmarked(experimentId).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.isBookmarked = resp.data.exists;
        }
      },
      error: () => { /* 忽略：收藏状态不是关键路径 */ },
    });
  }

  /**
   * 初始化参数：数据库里的 params_schema 优先；若尚未由 AI 生成（为空），
   * 回退到前端渲染器声明在注册表里的参数，保证参数面板始终可用。
   */
  initParams(slug: string, schema: unknown): void {
    const effective = this.effectiveSchema(slug, schema);
    // 缓存 schema：若用 getter 每次变更检测都会返回新对象，会让参数面板反复收到新引用
    this.paramsSchema = effective;
    this.params = {};
    for (const key of Object.keys(effective)) {
      this.params[key] = effective[key]?.default ?? 1;
    }
  }

  /** 库内 schema -> 渲染器 schema 的回退逻辑。 */
  private effectiveSchema(slug: string, schema: unknown): Record<string, ParamConfig> {
    const fromDb = ExperimentDetailComponent.parseSchema(schema);
    if (Object.keys(fromDb).length > 0) return fromDb;
    return vizSchema(slug) as Record<string, ParamConfig>;
  }

  private static parseSchema(schema: unknown): Record<string, ParamConfig> {
    if (!schema) return {};
    try {
      const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
      // 合法 schema 必须是「参数名 -> 定义」的对象；数组（曾出现过的一种错误形态）
      // 会让参数面板出现 "0"/"1" 这类伪参数名，直接视为未配置并回退到渲染器声明。
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
        return parsed as Record<string, ParamConfig>;
      }
    } catch {
      /* 非法 JSON 视为未配置 */
    }
    return {};
  }

  /**
   * 当前生效版本是否为 AI 版。
   *
   * AI 版生效但没有 graph 时，界面提示「AI 版暂无图形数据」，
   * 而不是退回种子渲染器（否则文稿/配音是 AI 版、图形却是种子版）。
   */
  /** 当前展项是否有 3D 场景（scene-registry 注册表）。 */
  has3D(): boolean {
    const exp = this.experiment();
    return !!exp && hasScene(exp.slug);
  }

  setViewMode(mode: '2d' | '3d'): void {
    this.viewMode = mode;
  }

  get isAiSource(): boolean {
    return this.experiment()?.content_source === 'ai';
  }

  /**
   * 解析后的教学内容字段，全部用 computed 缓存。
   *
   * 为什么必须缓存：这些字段在库里是 JSON **字符串**，用 getter（或在模板里直接调用）
   * 每次变更检测都会 `JSON.parse` 出一个**新对象**。于是子组件的 `@Input()` 引用每轮都变，
   * `ngOnChanges` 被反复触发 —— AI 图形里表现为动画被逐帧重启动（播放条在、t 读数永远是 0.0、
   * 画面一动不动），参数面板也会反复收到新引用。computed 只在 experiment 信号变化时重算一次。
   */
  readonly parsedGraph = computed<any>(() => {
    const exp = this.experiment();
    if (!exp?.graph) return null;
    if (typeof exp.graph === 'string') {
      try {
        return JSON.parse(exp.graph);
      } catch {
        return null;
      }
    }
    return exp.graph;
  });

  readonly parsedFormulas = computed<any[]>(() =>
    ExperimentDetailComponent.parseJSON(this.experiment()?.formulas, []),
  );

  readonly parsedHistory = computed<any>(() =>
    ExperimentDetailComponent.parseJSON(this.experiment()?.history_info, null),
  );

  readonly parsedApps = computed<any[]>(() => ExperimentDetailComponent.parseJSON(this.experiment()?.app_hooks, []));

  /** 字符串则解析、对象则原样返回，失败用兜底值。 */
  private static parseJSON(raw: unknown, fallback: any): any {
    if (raw === undefined || raw === null || raw === '') return fallback;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  onParamChange(newParams: Record<string, any>): void {
    // 防御：只接受真正的参数对象，避免原生 DOM 事件混入后把渲染参数冲掉
    if (!newParams || newParams instanceof Event || typeof newParams !== 'object') return;
    this.params = newParams;
  }

  /** 开始讲解：先加载讲解稿件（含双音色音频地址），没有稿件时给出提示。 */
  async startNarration(): Promise<void> {
    const exp = this.experiment();
    if (!exp) return;

    this.narrationNotice.set('');
    const ok = await this.narration.load(exp.slug);
    if (!ok) {
      this.narrationNotice.set(this.narration.error() ?? '讲解稿件不可用');
      return;
    }
    this.isNarrating = true;
  }

  exitNarration(): void {
    this.isNarrating = false;
  }

  toggleBookmark(): void {
    const exp = this.experiment();
    if (!exp) return;
    if (!localStorage.getItem('mb_token')) {
      this.narrationNotice.set('请先登录后再收藏实验。');
      return;
    }
    if (this.isBookmarked) {
      this.api.removeBookmark(exp.id).subscribe();
    } else {
      this.api.addBookmark(exp.id).subscribe();
    }
    this.isBookmarked = !this.isBookmarked;
  }

  getDifficultyLabel(d: string): string {
    const labels: Record<string, string> = {
      basic: '小学', intro: '初中', intermediate: '高中', advanced: '大学', professional: '研究生', academic: '学术级'
    };
    return labels[d] || d;
  }
}
