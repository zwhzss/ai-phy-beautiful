import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { VizCanvasComponent } from '../viz-canvas/viz-canvas.component';
import { AiGraphCanvasComponent } from '../ai-graph-canvas/ai-graph-canvas.component';
import { ParamPanelComponent, ParamConfig } from '../param-panel/param-panel.component';
import { NarrationService, Voice } from '../../../../core/services/narration.service';
import { InlineMathPipe } from '../../../../shared/pipes/inline-math.pipe';

/**
 * PPT 式全屏讲解覆盖层（需求 6）。
 *
 * 由 NarrationService 驱动：逐句播放双音色音频，支持播放/暂停/停止、
 * 上一句/下一句、音色切换、倍速、进度跳转，并把台词中的动画配置
 * （reset / setParam 等）作用到可视化画布上。
 *
 * 图形与详情页主画面保持同一套判定：有 AI 图形（当前生效的 AI 版带 graph）
 * 就画 AI 图形，否则回退种子渲染器 —— 避免出现「声音/文稿是 AI 版、
 * 图形却是种子版」的错配。
 */
@Component({
  selector: 'narration-overlay',
  standalone: true,
  imports: [FormsModule, NgIf, VizCanvasComponent, AiGraphCanvasComponent, ParamPanelComponent, InlineMathPipe],
  template: `
    <div class="narration-overlay" [class.paused]="!narration.isPlaying()">
      <!-- 全屏画布：与详情页一致 —— AI 版生效时画 AI 图形，
           AI 版却没有图形数据时明确提示，绝不回退种子图形 -->
      <div class="narration-canvas">
        <ng-container *ngIf="isAiSource; else seedViz">
          <app-ai-graph-canvas
            *ngIf="graph; else aiNoGraph"
            [graph]="graph"
            [params]="sceneState"
            [width]="1200"
            [height]="620"
          ></app-ai-graph-canvas>

          <ng-template #aiNoGraph>
            <div class="canvas-empty">
              <div class="canvas-empty-title">AI 版暂无图形数据</div>
              <div class="canvas-empty-hint">
                当前播放的是 AI 版文稿与配音，但这一版没有给出图形数据；
                为避免声文图不一致，此处不显示种子版图形。
              </div>
            </div>
          </ng-template>
        </ng-container>

        <ng-template #seedViz>
          <viz-canvas
            [experimentSlug]="experimentSlug"
            [params]="sceneState"
            [width]="1200"
            [height]="620"
            [placeholderText]="narration.currentSectionTitle() || '物理之美'"
          ></viz-canvas>
        </ng-template>
      </div>

      <!-- 字幕与进度 -->
      <div class="subtitle-bar">
        <div class="section-row">
          <span class="section-title" *ngIf="narration.currentSectionTitle()">
            {{ narration.currentSectionTitle() }}
          </span>
          <span class="audio-flag" *ngIf="!narration.hasAnyAudio()">该实验尚未合成语音，当前为文字讲解</span>
          <span class="line-indicator">
            {{ narration.currentIndex() + 1 }} / {{ narration.totalLines() }}
          </span>
        </div>

        <div class="progress-track" (click)="onSeek($event)">
          <div class="progress-fill" [style.width.%]="narration.progressPercent()"></div>
        </div>

        <div class="subtitle-text" [innerHTML]="(narration.currentLine()?.text ?? '') | inlineMath"></div>
        <div class="error-text" *ngIf="narration.error()">{{ narration.error() }}</div>
      </div>

      <!-- 参数调节：与详情页共用同一套参数面板，支持边讲解边拖动演示 -->
      <div class="scene-params" *ngIf="hasParams()">
        <button class="params-toggle" (click)="showParams = !showParams">
          🎛 参数调节{{ showParams ? '（点击收起）' : '（点击展开）' }}
        </button>
        <div class="params-body" *ngIf="showParams">
          <div class="params-note" *ngIf="highlightedParams.length">
            ▶ 这一句正在演示参数：{{ highlightedParams.join('、') }}
          </div>
          <param-panel
            [schema]="paramsSchema"
            [highlightKeys]="highlightedParams"
            (paramsChange)="onSceneParamChange($event)"
          ></param-panel>
        </div>
      </div>

      <!-- 控制栏 -->
      <div class="control-bar">
        <button class="ctrl-btn" (click)="narration.prev()" title="上一句">⏮</button>
        <button class="ctrl-btn play-btn" (click)="narration.toggle()" title="{{ narration.isPlaying() ? '暂停' : '播放' }}">
          {{ narration.isPlaying() ? '⏸ 暂停' : '▶ 播放' }}
        </button>
        <button class="ctrl-btn" (click)="narration.stop()" title="停止">⏹ 停止</button>
        <button class="ctrl-btn" (click)="narration.next()" title="下一句">⏭</button>

        <label class="inline-control">
          音色
          <select class="voice-select" [ngModel]="narration.voice()" (ngModelChange)="onVoiceChange($event)">
            <option value="yunxi">云希（男声）</option>
            <option value="xiaoxiao">晓晓（女声）</option>
          </select>
        </label>

        <label class="inline-control">
          倍速
          <input
            type="range"
            class="speed-slider"
            [ngModel]="narration.speed()"
            (ngModelChange)="onSpeedChange($event)"
            min="0.5"
            max="2"
            step="0.1"
          />
          <span class="speed-label">{{ narration.speed() }}x</span>
        </label>

        <span class="time-label">{{ timeText }}</span>

        <button class="ctrl-btn exit-btn" (click)="onExit()" title="退出讲解">✕ 退出</button>
      </div>
    </div>
  `,
  styles: [`
    .narration-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .narration-overlay.paused .narration-canvas { filter: brightness(0.75); }
    .narration-canvas { flex: 1; display: flex; align-items: center; justify-content: center; background: #1a202c; min-height: 0; padding: 0.5rem; }
    .canvas-empty { text-align: center; color: #a0aec0; padding: 2rem 3rem; max-width: 720px; }
    .canvas-empty-title { color: #e2e8f0; font-size: 1.15rem; font-weight: 600; margin-bottom: 0.75rem; }
    .canvas-empty-hint { font-size: 0.9rem; line-height: 1.8; }
    .subtitle-bar { background: rgba(0,0,0,0.85); padding: 0.75rem 2rem; }
    .section-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.4rem; }
    .section-title { color: #a3bffa; font-size: 0.85rem; font-weight: 600; }
    .audio-flag { color: #f6ad55; font-size: 0.75rem; }
    .line-indicator { margin-left: auto; color: rgba(255,255,255,0.5); font-size: 0.75rem; }
    .progress-track { height: 5px; background: rgba(255,255,255,0.2); border-radius: 3px; margin-bottom: 0.6rem; overflow: hidden; cursor: pointer; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s; }
    .subtitle-text { color: white; font-size: 1.125rem; text-align: center; min-height: 60px; display: flex; align-items: center; justify-content: center; line-height: 1.6; }
    .error-text { color: #fc8181; font-size: 0.8rem; text-align: center; margin-top: 0.25rem; }
    .control-bar { background: rgba(0,0,0,0.92); padding: 0.75rem 2rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .scene-params { background: rgba(0,0,0,0.88); padding: 0.4rem 2rem 0; }
    .params-toggle { background: rgba(255,255,255,0.12); color: #e2e8f0; border: none; border-radius: 6px; padding: 0.3rem 0.8rem; font-size: 0.8rem; cursor: pointer; }
    .params-toggle:hover { background: rgba(255,255,255,0.2); }
    .params-body { background: #fff; border-radius: 8px; margin: 0.5rem 0; padding: 0.25rem 0.75rem; max-height: 26vh; overflow: auto; }
    .params-note { color: #c05621; background: #fffaf0; border-left: 3px solid #f6ad55; border-radius: 4px; padding: 0.3rem 0.6rem; margin: 0.5rem 0 0.25rem; font-size: 0.8rem; }
    .ctrl-btn { padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: background 0.2s; }
    .ctrl-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
    .ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .play-btn { min-width: 96px; background: linear-gradient(135deg, #667eea, #764ba2); }
    .inline-control { display: flex; align-items: center; gap: 0.4rem; color: rgba(255,255,255,0.7); font-size: 0.8rem; }
    .voice-select { padding: 0.35rem 0.6rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; font-size: 0.85rem; }
    .speed-slider { width: 90px; accent-color: #667eea; }
    .speed-label { color: rgba(255,255,255,0.7); font-size: 0.8rem; }
    .time-label { color: rgba(255,255,255,0.5); font-size: 0.8rem; margin-left: auto; }
    .exit-btn { background: #e53e3e; }
    .exit-btn:hover { background: #c53030; }
  `]
})
export class NarrationOverlayComponent implements OnInit, OnDestroy {
  @Input() experimentSlug = '';
  /** 当前生效版本的 AI 图形（为空则按 contentSource 决定提示或回退种子渲染器） */
  @Input() graph: unknown = null;
  /** 当前生效版本来源：seed | ai */
  @Input() contentSource = 'seed';
  /** 详情页当前的参数值，作为讲解场景的初始参数（AI 图形可能引用这些参数） */
  @Input() params: Record<string, any> = {};
  /** 参数定义（详情页的 params_schema）—— 让全屏讲解里也能调参数、边讲边演示 */
  @Input() paramsSchema: Record<string, ParamConfig> = {};
  @Output() exit = new EventEmitter<void>();
  @Output() lineChange = new EventEmitter<number>();

  /** 参数调节面板是否展开（默认展开：边讲解边演示更直观，可收起看大画面） */
  showParams = true;

  /** 传递给可视化画布的场景参数（台词动画可临时覆盖它） */
  sceneState: Record<string, any> = {};
  /**
   * 用户/详情页的基础参数：台词里的 reset 回到这里，而不是清空成 0。
   *
   * 以前 reset 直接把 sceneState 置空，而 AI 文稿每段第一行几乎都是 reset，
   * 于是讲解一开始参数全被清零、图形退化成默认值 —— 看起来就是"静态的"。
   */
  private baseParams: Record<string, any> = {};

  /** 当前台词正在通过动画设置的参数名（用于在参数面板上高亮对应滑块） */
  highlightedParams: string[] = [];

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(public narration: NarrationService) {}

  ngOnInit(): void {
    // 以详情页当前参数为起点，之后由台词动画逐句临时覆盖
    this.baseParams = { ...this.params };
    this.sceneState = { ...this.baseParams };
    let lastIndex = this.narration.currentIndex();
    this.applyAnimationForCurrentLine();
    this.pollTimer = setInterval(() => {
      const idx = this.narration.currentIndex();
      if (idx !== lastIndex) {
        lastIndex = idx;
        this.applyAnimationForCurrentLine();
        this.lineChange.emit(idx);
      }
    }, 120);
    this.narration.play();
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.narration.stop();
  }

  /** 当前生效版本是否为 AI 版：AI 版缺图形数据时提示，而不是画种子图形。 */
  get isAiSource(): boolean {
    return this.contentSource === 'ai';
  }

  get timeText(): string {
    const elapsed = Math.round(this.narration.elapsedMs() / 1000);
    const total = Math.round(this.narration.totalDurationMs() / 1000);
    return `${this.format(elapsed)} / ${this.format(total)}`;
  }

  onVoiceChange(voice: Voice): void {
    this.narration.setVoice(voice);
  }

  onSpeedChange(speed: number): void {
    this.narration.setSpeed(Number(speed));
  }

  /** 点击进度条按比例跳转到对应台词。 */
  onSeek(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const ratio = (event.clientX - target.getBoundingClientRect().left) / target.offsetWidth;
    const total = this.narration.totalLines();
    if (total === 0) return;
    this.narration.goTo(Math.floor(ratio * total));
  }

  onExit(): void {
    this.narration.stop();
    this.exit.emit();
  }

  private format(seconds: number): string {    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** 应用当前句的动画配置：reset 回到基础参数，其余动作把参数合并进场景状态。 */
  private applyAnimationForCurrentLine(): void {
    const line = this.narration.currentLine();
    const action = line?.animation?.action;
    const params = line?.animation?.params;
    if (action === 'reset') {
      // 回到基础参数（详情页传进来的 + 用户在全屏里调过的），而不是清空成 0：
      // AI 文稿每段第一行几乎都是 reset，清空会让图形瞬间退化，看起来"讲解画面是静态的"。
      this.sceneState = { ...this.baseParams };
      this.highlightedParams = [];
      return;
    }
    if (params && typeof params === 'object') {
      this.sceneState = { ...this.sceneState, ...params };
      // 只标注"确实是可调参数"的那些：种子文稿的 animation.params 里常带 section 这类
      // 渲染参数，它们不在参数面板里，不该提示成"正在演示参数"。
      this.highlightedParams = Object.keys(params).filter((k) => k in this.paramsSchema);
      return;
    }
    this.highlightedParams = [];
  }

  /** 全屏讲解里拖动参数：更新基础参数并立刻反映到画面（之后台词 reset 也回到这里）。 */
  onSceneParamChange(next: Record<string, any>): void {
    if (!next || next instanceof Event || typeof next !== 'object') return;
    this.baseParams = { ...this.baseParams, ...next };
    this.sceneState = { ...this.sceneState, ...next };
  }

  /** 有没有可调参数（没有就不显示参数行）。 */
  hasParams(): boolean {
    return !!this.paramsSchema && Object.keys(this.paramsSchema).length > 0;
  }
}
