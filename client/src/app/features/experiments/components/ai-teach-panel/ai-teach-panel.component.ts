import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { InlineMathPipe } from '../../../../shared/pipes/inline-math.pipe';
import { environment } from '../../../../../environments/environment';

/** 内容版本行：种子版 / AI 版固定两行；exists 表示库里是否已有该版本。 */
interface VersionRow {
  source: 'seed' | 'ai';
  source_label: string;
  exists: boolean;
  is_active: boolean;
  model_name: string;
  sections: number;
  lines: number;
}

/** 面板里展示的一段文稿（按版本分别加载，标题为段落名）。 */
interface ScriptSection {
  title: string;
  lines: Array<{ text: string }>;
}

/**
 * AI 教学面板（todo.txt 需求 1）。
 *
 * - 两个 tab：文稿（展示已有讲解稿）/ AI 教学（流式生成）
 * - 重新生成：以 SSE 流式接收 LLM 输出并实时显示
 * - 取消：通过 AbortController 立即中止请求
 * - 生成完成后触发 generated 事件，由详情页重新加载讲解与图形参数（覆盖旧数据）
 * - 未配置大模型时显示后端返回的提示文案
 */
@Component({
  selector: 'app-ai-teach-panel',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, InlineMathPipe],
  template: `
    <div class="ai-panel">
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'script'" (click)="selectTab('script')">
          📄 文稿（种子版）
        </button>
        <button class="tab" [class.active]="tab() === 'ai'" (click)="selectTab('ai')">
          🤖 AI 教学（AI 版）
        </button>
      </div>

      <!-- 内容版本：常驻显示，与是否配置大模型无关；点上方 tab 或点按钮都能切换生效版本 -->
      <div class="versions">
        <div class="versions-head">内容版本（切换即生效，另一版本仍保留）</div>
        <div class="version-row" *ngFor="let v of versions">
          <span class="ver-name">{{ v.source_label }}</span>
          <span class="ver-meta" *ngIf="v.exists">
            {{ v.sections }} 小节 / {{ v.lines }} 句
            <span *ngIf="v.model_name"> · {{ v.model_name }}</span>
          </span>
          <span class="ver-meta" *ngIf="!v.exists">尚未生成</span>
          <span class="ver-badge" *ngIf="v.is_active">✓ 当前生效</span>
          <button class="btn-ghost btn-sm" [disabled]="switching() || v.is_active" (click)="activateVersion(v.source)">
            {{ v.is_active ? '已是当前版本' : (v.exists ? '切换到此版本' : '尚未生成') }}
          </button>
        </div>
        <div class="versions-hint" *ngIf="versionsError()">{{ versionsError() }}</div>
        <div class="versions-msg" *ngIf="noticeMsg()">{{ noticeMsg() }}</div>
      </div>

      <!-- 文稿 tab：固定展示「种子版」文稿（与当前生效版本无关） -->
      <div class="pane" *ngIf="tab() === 'script'">
        <div class="pane-head">
          📄 种子版文稿
          <span class="pane-sub">安装时内置的基线内容，AI 生成不会改动它；点本 tab 即让种子版生效</span>
        </div>
        <div class="empty" *ngIf="seedScriptMsg()">{{ seedScriptMsg() }}</div>
        <div class="empty" *ngIf="!seedScriptMsg() && !seedSections.length">该实验还没有种子版讲解稿。</div>
        <div class="section" *ngFor="let s of seedSections">
          <h4>{{ s.title }}</h4>
          <p *ngFor="let l of s.lines" [innerHTML]="l.text | inlineMath"></p>
        </div>
      </div>

      <!-- AI 教学 tab：流式生成 -->
      <div class="pane" *ngIf="tab() === 'ai'">
        <div class="toolbar">
          <button class="btn-primary" [disabled]="running()" (click)="startGenerate()">
            {{ running() ? '生成中…' : (streamText() ? '重新生成' : '生成文稿') }}
          </button>
          <button class="btn-ghost" *ngIf="running()" (click)="cancel()">取消</button>
          <label class="token-field">
            最大 Token
            <input type="number" min="512" step="512" max="16384" [(ngModel)]="maxTokensInput"
                   placeholder="默认 8192" />
          </label>
          <button class="btn-ghost" [disabled]="synthesizing() || running()" (click)="synthesize()">
            {{ synthesizing() ? '合成中…' : '🎧 合成语音' }}
          </button>
          <span class="hint" *ngIf="!running() && streamText()">生成完成，已覆盖原有内容</span>
        </div>

        <div class="notice error" *ngIf="errorMsg()">{{ errorMsg() }}</div>
        <div class="notice cancelled" *ngIf="cancelledMsg()">{{ cancelledMsg() }}</div>
        <div class="notice ok" *ngIf="synthMsg()">{{ synthMsg() }}</div>

        <!-- 模型配置状态：生成（LLM）与合成（TTS）各自独立检查 -->
        <div class="model-status">
          <span class="ms-item" [class.ok]="llmReady() === true" [class.bad]="llmReady() === false">
            LLM：{{ llmReady() === true ? '已配置并激活' : (llmReady() === false ? '未配置' : '状态未知') }}
          </span>
          <span class="ms-item" [class.ok]="ttsReady() === true" [class.bad]="ttsReady() === false">
            TTS：{{ ttsReady() === true ? '已配置并激活' : (ttsReady() === false ? '未配置' : '状态未知') }}
          </span>
          <span class="ms-hint">未配置时请到「管理后台 → 大模型配置」添加并激活</span>
        </div>

        <div class="stream" *ngIf="streamText() || running()">
          <div class="stream-head">
            实时输出
            <span class="dot" *ngIf="running()"></span>
            <span class="elapsed" *ngIf="running()">已等待 {{ elapsedSec() }}s</span>
            <span class="elapsed" *ngIf="!running() && receivedChars() > 0">共 {{ receivedChars() }} 字</span>
          </div>
          <div class="stream-diag" *ngIf="streamDiag()">{{ streamDiag() }}</div>
          <div class="waiting" *ngIf="!streamText() && running()">
            已连接，模型正在思考…
            <div class="hint-sm">
              本地大模型处理长提示词需要时间（首字常需数秒到数十秒），
              首个字到达后就会逐段实时显示，请勿关闭。
            </div>
          </div>
          <pre>{{ streamText() }}</pre>
        </div>

        <div class="tip" *ngIf="!streamText() && !running()">
          AI 将依据系统提示词与本主题的专属要求生成教学文稿、公式与现实应用；
          生成完毕会自动刷新讲解稿与图形参数。若提示「尚未配置大模型」，请先在「模型配置」中添加并激活一个 LLM。
        </div>

        <!-- AI 版文稿：同样来自版本存档，因此永远是「AI 版」的稿子 -->
        <div class="pane-head divider">
          🤖 AI 版文稿
          <span class="pane-sub">点本 tab 即让 AI 版生效；重新生成只覆盖 AI 版，种子版不受影响</span>
        </div>
        <div class="empty" *ngIf="aiScriptMsg()">{{ aiScriptMsg() }}</div>
        <div class="empty" *ngIf="!aiScriptMsg() && !aiSections.length">
          还没有 AI 版内容：点上方「生成文稿」生成后在此查看。
        </div>
        <div class="section" *ngFor="let s of aiSections">
          <h4>{{ s.title }}</h4>
          <p *ngFor="let l of s.lines" [innerHTML]="l.text | inlineMath"></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-panel { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; }
    .tabs { display: flex; border-bottom: 1px solid #e2e8f0; }
    .tab { flex: 1; padding: 0.7rem 1rem; background: #f7fafc; border: none; cursor: pointer; font-size: 0.9rem; color: #4a5568; }
    .tab.active { background: white; color: #4c51bf; font-weight: 600; box-shadow: inset 0 -2px 0 #667eea; }
    .pane { padding: 1rem; max-height: 420px; overflow: auto; }
    .section h4 { color: #4c51bf; font-size: 0.9rem; margin: 0.75rem 0 0.35rem; }
    .pane-head { font-size: 0.86rem; font-weight: 600; color: #4c51bf; margin: 0.25rem 0 0.5rem; }
    .pane-head.divider { border-top: 1px solid #edf2f7; padding-top: 0.75rem; margin-top: 0.75rem; }
    .pane-sub { font-weight: 400; color: #a0aec0; font-size: 0.75rem; margin-left: 0.35rem; }
    .section p { color: #2d3748; font-size: 0.9rem; line-height: 1.7; margin: 0 0 0.3rem; }
    .empty, .tip { color: #a0aec0; font-size: 0.85rem; line-height: 1.7; }
    .toolbar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .btn-primary { padding: 0.5rem 1.1rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-ghost { padding: 0.5rem 1rem; background: white; border: 1px solid #cbd5e0; color: #4a5568; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
    .hint { color: #38a169; font-size: 0.8rem; }
    .notice { padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 0.6rem; }
    .notice.error { background: #fff5f5; color: #c53030; border-left: 3px solid #f56565; }
    .notice.cancelled { background: #fffaf0; color: #975a16; border-left: 3px solid #ed8936; }
    .notice.ok { background: #f0fff4; color: #276749; border-left: 3px solid #48bb78; }
    .notice.info { background: #ebf8ff; color: #2b6cb0; border-left: 3px solid #4299e1; }
    .model-status { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; font-size: 0.76rem; margin-bottom: 0.6rem; }
    .ms-item { padding: 0.15rem 0.55rem; border-radius: 999px; background: #f7fafc; border: 1px solid #e2e8f0; color: #718096; }
    .ms-item.ok { color: #276749; border-color: #9ae6b4; background: #f0fff4; }
    .ms-item.bad { color: #c53030; border-color: #feb2b2; background: #fff5f5; }
    .ms-hint { color: #a0aec0; }
    .versions { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem 0.8rem; margin: 0.75rem 1rem; }
    .versions-head { font-size: 0.78rem; color: #718096; margin-bottom: 0.45rem; }
    .versions-hint { color: #c53030; font-size: 0.76rem; margin-top: 0.35rem; }
    .versions-msg { color: #276749; font-size: 0.76rem; margin-top: 0.35rem; }
    .version-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0; font-size: 0.82rem; }
    .ver-name { font-weight: 600; color: #2d3748; min-width: 56px; }
    .ver-meta { color: #718096; flex: 1; }
    .ver-badge { color: #276749; font-size: 0.78rem; }
    .btn-sm { padding: 0.2rem 0.6rem; font-size: 0.76rem; }
    .stream-diag { color: #68d391; font-size: 0.7rem; margin-bottom: 0.4rem; font-family: Consolas, monospace; }
    .elapsed { margin-left: auto; color: #a0aec0; font-size: 0.72rem; }
    .waiting { color: #e2e8f0; font-size: 0.85rem; line-height: 1.8; padding: 0.5rem 0 0.75rem; }
    .hint-sm { color: #a0aec0; font-size: 0.75rem; margin-top: 0.3rem; }
    .token-field { display: flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: #718096; }
    .token-field input { width: 108px; padding: 0.3rem 0.45rem; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.78rem; }
    .stream { background: #1a202c; border-radius: 8px; padding: 0.75rem; }
    .stream-head { color: #a0aec0; font-size: 0.75rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #48bb78; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
    .stream pre { color: #e2e8f0; font-size: 0.78rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; margin: 0; max-height: 300px; overflow: auto; }
  `]
})
export class AiTeachPanelComponent implements OnInit {
  @Input() experimentId = 0;
  @Input() slug = '';
  /** 种子版文稿：来自种子版存档，AI 生成永远不会改动它 */
  seedSections: ScriptSection[] = [];
  /** AI 版文稿：来自 AI 版存档（可能尚未生成） */
  aiSections: ScriptSection[] = [];
  /** 两个版本文稿的加载提示（尚无该版本 / 加载失败） */
  seedScriptMsg = signal('');
  aiScriptMsg = signal('');
  /** 生成完成后通知详情页刷新讲解与图形参数 */
  @Output() generated = new EventEmitter<void>();

  tab = signal<'script' | 'ai'>('script');
  running = signal(false);
  streamText = signal('');
  errorMsg = signal('');
  cancelledMsg = signal('');
  synthesizing = signal(false);
  /** 用户自定义的最大输出 token；留空（null）表示使用服务端默认值 */
  maxTokensInput: number | null = null;
  /** 内容版本列表：固定两行（种子版 / AI 版），与是否配置大模型无关 */
  versions: VersionRow[] = [
    { source: 'seed', source_label: '种子版', exists: true, is_active: true, model_name: '', sections: 0, lines: 0 },
    { source: 'ai', source_label: 'AI 版', exists: false, is_active: false, model_name: '', sections: 0, lines: 0 },
  ];
  /** 版本接口失败时的提示（切换入口不能因此消失） */
  versionsError = signal('');
  /** 切换结果 / 点击 tab 的提示：挂在版本块下，两个 tab 都可见 */
  noticeMsg = signal('');
  /** 当前生效版本（seed | ai）；缺省为种子版 */
  activeSource = signal<'seed' | 'ai'>('seed');
  /** LLM / TTS 是否已配置并激活；null = 状态未知（不拦截，交给后端判断） */
  llmReady = signal<boolean | null>(null);
  ttsReady = signal<boolean | null>(null);
  switching = signal(false);
  /** 首次加载版本列表时同步 tab，之后 tab 只由用户点击改变 */
  private tabsInitialized = false;
  /** 已等待秒数（首字到达前提示，避免用户以为卡住） */
  elapsedSec = signal(0);
  /** 已接收字符数 */
  receivedChars = signal(0);
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  /** 流式诊断信息（首个事件到达时刻、事件计数），用于定位「看起来不流式」的环节 */
  streamDiag = signal('');
  synthMsg = signal('');

  private controller: AbortController | null = null;

  /**
   * 管理接口基址。
   *
   * dev 下 Angular 跑在 4200、后端在 8080：这些管理接口原本用相对路径 fetch，
   * 请求会打到 4200 的 dev server 上直接 404，面板误报「种子版/AI 版 尚未生成」。
   * environment.apiBase 在 dev 是 http://localhost:8080/api/v1，生产是 /api/v1（同源），
   * 两种部署都对。
   */
  private readonly apiBase = environment.apiBase;

  constructor(private auth: AuthService) {}

  /** 加载内容版本列表（种子版 / AI 版）；失败也照常显示两行，保证切换入口始终在。 */
  async loadVersions(): Promise<void> {
    if (!this.experimentId) return;
    this.versionsError.set('');
    try {
      const resp = await fetch(`${this.apiBase}/admin/experiments/${this.experimentId}/versions`, {
        headers: this.jsonHeaders(),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || (json && json.code !== 0)) {
        this.versionsError.set(this.describeFailure(resp.status, json?.message, '内容版本列表'));
        return;
      }
      this.applyVersions(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      this.versionsError.set(`内容版本列表加载失败：${(e as Error).message}`);
    }
  }

  /** 把接口返回合并进固定的两行（种子版在前），并同步「当前生效版本」。 */
  private applyVersions(list: Array<Record<string, unknown>>): void {
    const seed = list.find((v) => v?.['source'] === 'seed');
    const ai = list.find((v) => v?.['source'] === 'ai');
    this.activeSource.set(ai?.['is_active'] ? 'ai' : 'seed');
    this.versions = [this.toRow('seed', '种子版', seed), this.toRow('ai', 'AI 版', ai)];
    if (!this.tabsInitialized) {
      // 缺省：没有生效中的 AI 版时，落在「文稿（种子版）」tab
      this.tab.set(this.activeSource() === 'ai' && this.hasVersion('ai') ? 'ai' : 'script');
      this.tabsInitialized = true;
    }
  }

  private toRow(source: 'seed' | 'ai', label: string, raw: Record<string, unknown> | undefined): VersionRow {
    return {
      source,
      source_label: (raw?.['source_label'] as string) || label,
      exists: !!raw,
      is_active: !!raw?.['is_active'],
      model_name: (raw?.['model_name'] as string) ?? '',
      sections: (raw?.['sections'] as number) ?? 0,
      lines: (raw?.['lines'] as number) ?? 0,
    };
  }

  hasVersion(source: 'seed' | 'ai'): boolean {
    return !!this.versions.find((v) => v.source === source)?.exists;
  }

  /**
   * 点击 tab 即切换生效版本：文稿 → 种子版，AI 教学 → AI 版。
   * 已经是当前生效版本时不重复写库；没有该版本时只给出提示。
   */
  async selectTab(next: 'script' | 'ai'): Promise<void> {
    this.noticeMsg.set('');
    this.versionsError.set('');
    this.tab.set(next);
    const target: 'seed' | 'ai' = next === 'ai' ? 'ai' : 'seed';
    if (!this.hasVersion(target)) {
      if (target === 'ai') {
        this.noticeMsg.set(
          '该实验还没有 AI 版内容，暂时无法切换到 AI 版（生效版本必须对应一份真实内容）；' +
            '点上方「生成文稿」，生成成功后会自动切换到 AI 版。',
        );
      }
      return;
    }
    if (this.activeSource() === target) {
      this.noticeMsg.set(`当前生效版本已经是${target === 'seed' ? '种子版' : 'AI 版'}。`);
      return;
    }
    await this.activateVersion(target);
  }

  /**
   * 切换生效版本：把该版本重新应用为当前内容，并刷新文稿与图形参数。
   *
   * extraNote 会追加到成功提示后面（例如生成完成后的质量提醒）。
   */
  async activateVersion(source: string, extraNote = ''): Promise<void> {
    if (this.switching() || !this.experimentId) return;
    const target: 'seed' | 'ai' = source === 'ai' ? 'ai' : 'seed';
    if (!this.hasVersion(target)) {
      this.noticeMsg.set(
        target === 'ai'
          ? '该实验还没有 AI 版内容：请先在「AI 教学」里点「生成文稿」，生成成功后会自动切换到 AI 版。'
          : '该实验还没有种子版存档。',
      );
      return;
    }
    this.switching.set(true);
    this.synthMsg.set('');
    this.errorMsg.set('');
    this.noticeMsg.set('');
    try {
      const resp = await fetch(
        `${this.apiBase}/admin/experiments/${this.experimentId}/versions/${encodeURIComponent(target)}/activate`,
        { method: 'POST', headers: this.jsonHeaders() },
      );
      const json = await resp.json().catch(() => null);
      if (resp.ok && json?.code === 0) {
        this.tab.set(target === 'ai' ? 'ai' : 'script');
        this.noticeMsg.set(
          `已切换到${target === 'seed' ? '种子版' : 'AI 版'}，画面与讲解稿已刷新；` +
            `如需配音请再点一次「🎧 合成语音」。${extraNote ? ` ${extraNote}` : ''}`,
        );
        await this.loadVersions();
        await this.loadVersionScript('seed');
        await this.loadVersionScript('ai');
        this.generated.emit();
      } else {
        this.noticeMsg.set(this.describeFailure(resp.status, json?.message, '切换版本'));
      }
    } catch (e) {
      this.noticeMsg.set(`切换失败：${(e as Error).message}`);
    } finally {
      this.switching.set(false);
    }
  }

  /**
   * 生成完成后的收尾。
   *
   * 用户在「AI 教学」tab 里生成，就表示要用 AI 版：生成成功后直接让 AI 版生效；
   * 若此时已不在该 tab（生成过程中切走了），则只更新 AI 版存档并提示怎么切。
   */
  private async afterGenerate(warning: string): Promise<void> {
    await this.loadVersions();
    if (this.tab() === 'ai' && this.hasVersion('ai') && this.activeSource() !== 'ai') {
      await this.activateVersion('ai', warning);
      return;
    }
    await this.loadVersionScript('ai');
    this.generated.emit();
    const base =
      this.activeSource() === 'ai'
        ? 'AI 版内容已更新，当前已生效。'
        : 'AI 版内容已更新（种子版内容未受影响）；点上方「🤖 AI 教学（AI 版）」tab 即可切到 AI 版。';
    this.noticeMsg.set(warning ? `${base} ${warning}` : base);
  }

  /** 把 HTTP 失败翻译成用户能看懂的提示（401/403 单独说明需要管理员登录）。 */
  private describeFailure(status: number, message: unknown, action: string): string {
    if (status === 401 || status === 403) {
      return `${action}需要管理员登录：请先用管理员账号登录「管理后台」。`;
    }
    // 404 = 该版本尚不存在（例如还没生成 AI 版）：直接显示后端的说明
    if (status === 404 && typeof message === 'string' && message) {
      return message;
    }
    return typeof message === 'string' && message
      ? `${action}失败：${message}`
      : `${action}失败（HTTP ${status}）`;
  }

  /** 检查 LLM / TTS 是否已配置并激活；生成与合成前各查一次。 */
  async loadModelStatus(): Promise<void> {
    try {
      const resp = await fetch(`${this.apiBase}/admin/ai-models`, { headers: this.jsonHeaders() });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || (json && json.code !== 0)) {
        this.llmReady.set(null);
        this.ttsReady.set(null);
        return;
      }
      const list: Array<{ model_type?: string; is_active?: boolean }> = Array.isArray(json?.data) ? json.data : [];
      const hasActive = (type: string) => list.some((m) => m?.model_type === type && m?.is_active);
      this.llmReady.set(hasActive('llm'));
      this.ttsReady.set(hasActive('tts'));
    } catch {
      // 状态未知时不拦截请求，交给后端给出准确报错
      this.llmReady.set(null);
      this.ttsReady.set(null);
    }
  }

  /**
   * 为一篇已生成的文稿合成双音色语音（todo 第 2 项）。
   * 后端会自动使用「已激活的 TTS」（内置 Edge 或商用 API）。
   */
  async synthesize(): Promise<void> {
    if (this.synthesizing() || !this.experimentId) return;
    this.synthMsg.set('');
    // 合成前先确认 TTS 已配置并激活
    await this.loadModelStatus();
    if (this.ttsReady() === false) {
      this.synthMsg.set(
        '尚未配置并激活 TTS 大模型：请先在「管理后台 → 大模型配置」添加一个 TTS（可选内置 Edge TTS，无需密钥）并激活，再回来合成。',
      );
      return;
    }
    this.synthesizing.set(true);
    this.synthMsg.set('');
    try {
      const resp = await fetch(`${this.apiBase}/admin/experiments/${this.experimentId}/narrations/synthesize`, {
        method: 'POST',
        headers: this.jsonHeaders(),
        // force: true —— AI 讲解与种子讲解的 line_id 相同，不强制重合成会命中已存在文件而被跳过
        body: JSON.stringify({ voices: ['yunxi', 'xiaoxiao'], force: true }),
      });
      const json = await resp.json();
      if (resp.ok && json.code === 0) {
        // 带成功/失败/跳过统计与首条失败原因：部分句子失败时不能笼统地说"合成完成"
        const r = Array.isArray(json?.data) ? json.data[0] : null;
        const okCount = r?.synthesized ?? 0;
        const failCount = r?.failed ?? 0;
        const skipCount = r?.skipped ?? 0;
        const stats =
          `成功 ${okCount} 句` +
          (skipCount ? `，跳过 ${skipCount} 句（文件已存在）` : '') +
          (failCount ? `，失败 ${failCount} 句` : '');
        const firstErr = Array.isArray(r?.errors) && r.errors.length ? `；首条失败原因：${r.errors[0]}` : '';
        const tail =
          this.activeSource() === 'ai'
            ? '当前已生效，可点右上角「开始讲解」播放。'
            : '点「🤖 AI 教学（AI 版）」tab 切换后即可播放。';
        this.synthMsg.set(`AI 版配音合成完成（${stats}；只覆盖 AI 版配音，种子版配音不受影响）${firstErr} ${tail}`);
      } else {
        this.synthMsg.set(json?.message ?? `合成失败（HTTP ${resp.status}）`);
      }
    } catch (e) {
      this.synthMsg.set((e as Error).message || '合成失败');
    } finally {
      this.synthesizing.set(false);
    }
  }

  ngOnInit(): void {
    void this.loadVersionScript('seed');
    void this.loadVersionScript('ai');
    void this.loadVersions();
    void this.loadModelStatus();
  }

  /**
   * 加载指定版本的文稿（source = seed | ai）。
   *
   * 两种版本各有自己的稿子：种子版来自种子版存档、AI 版来自 AI 版存档，
   * 与「当前生效版本」无关 —— 因此面板里显示的一定是标注的那个版本的文稿。
   */
  async loadVersionScript(source: 'seed' | 'ai'): Promise<void> {
    if (!this.experimentId) return;
    this.setScriptMsg(source, '');
    try {
      const resp = await fetch(
        `${this.apiBase}/admin/experiments/${this.experimentId}/versions/${source}/content`,
        { headers: this.jsonHeaders() },
      );
      const json = await resp.json().catch(() => null);
      if (!resp.ok || (json && json.code !== 0)) {
        this.setScriptSections(source, []);
        this.setScriptMsg(source, this.describeFailure(resp.status, json?.message, `${source === 'seed' ? '种子版' : 'AI 版'}文稿`));
        return;
      }
      const secs: Array<{ title?: string; lines?: Array<{ text?: string }> }> = json?.data?.sections ?? [];
      this.setScriptSections(
        source,
        secs.map((sc) => ({ title: sc.title ?? '', lines: (sc.lines ?? []).map((l) => ({ text: l.text ?? '' })) })),
      );
    } catch (e) {
      this.setScriptSections(source, []);
      this.setScriptMsg(source, `文稿加载失败：${(e as Error).message}`);
    }
  }

  private setScriptSections(source: 'seed' | 'ai', sections: ScriptSection[]): void {
    if (source === 'seed') this.seedSections = sections;
    else this.aiSections = sections;
  }

  private setScriptMsg(source: 'seed' | 'ai', msg: string): void {
    if (source === 'seed') this.seedScriptMsg.set(msg);
    else this.aiScriptMsg.set(msg);
  }

  /** 请求头：携带登录 token（生成接口在管理组下）。 */
  private jsonHeaders(): Record<string, string> {
    const token = this.auth.token();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  /** 以 SSE 流式生成文稿；重复生成会覆盖已有内容。 */
  async startGenerate(): Promise<void> {
    if (this.running() || !this.experimentId) return;
    this.errorMsg.set('');
    this.cancelledMsg.set('');
    // 向 LLM 拉取数据前先确认模型已配置并激活
    await this.loadModelStatus();
    if (this.llmReady() === false) {
      this.errorMsg.set(
        '尚未配置并激活 LLM 大模型：请先在「管理后台 → 大模型配置」添加一个 LLM 并激活，再回来生成。',
      );
      return;
    }
    this.running.set(true);
    this.streamText.set('');

    this.elapsedSec.set(0);
    this.receivedChars.set(0);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.elapsedSec.update((v) => v + 1), 1000);

    const t0 = performance.now();
    let firstEvtAt = 0;
    let evtCount = 0;
    this.streamDiag.set('');
    this.controller = new AbortController();
    const url = `${this.apiBase}/admin/experiments/${this.experimentId}/generate-stream`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: this.jsonHeaders(),
        // 未填写则传 0，服务端会使用默认值（65536）
        body: JSON.stringify({ max_tokens: this.maxTokensInput ?? 0 }),
        signal: this.controller.signal,
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`请求失败（HTTP ${resp.status}）`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let done = false;

      while (!done) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 事件块（空行分隔）切分
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const parsed = this.parseEvent(chunk);
          if (!parsed) continue;
          evtCount++;
          if (!firstEvtAt) firstEvtAt = Math.round(performance.now() - t0);
          this.streamDiag.set(
            'first=' + firstEvtAt + 'ms events=' + evtCount + ' chars=' + this.receivedChars(),
          );

          if (parsed.event === 'delta') {
            const text = (parsed.data as { text?: string }).text ?? '';
            this.streamText.update((s) => s + text);
            this.receivedChars.update((n) => n + text.length);
          } else if (parsed.event === 'done') {
            done = true;
            const warning = (parsed.data as { warning?: string }).warning ?? '';
            void this.afterGenerate(warning);
          } else if (parsed.event === 'cancelled') {
            done = true;
            this.cancelledMsg.set('已取消生成，原有内容保持不变。');
          } else if (parsed.event === 'error') {
            done = true;
            this.errorMsg.set((parsed.data as { message?: string }).message ?? '生成失败');
          }
        }
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        this.cancelledMsg.set('已取消生成，原有内容保持不变。');
      } else {
        this.errorMsg.set(err.message || '生成失败，请检查大模型配置');
      }
    } finally {
      this.running.set(false);
      this.controller = null;
    }
  }

  /** 取消当前生成（用户点「取消」按钮）。 */
  cancel(): void {
    this.controller?.abort();
  }

  /** 解析单个 SSE 事件块（可能含 event: 与 data: 多行）。 */
  private parseEvent(chunk: string): { event: string; data: unknown } | null {
    let event = 'message';
    const dataLines: string[] = [];
    for (const raw of chunk.split('\n')) {
      const line = raw.trimEnd();
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (!dataLines.length) return null;
    try {
      return { event, data: JSON.parse(dataLines.join('\n')) };
    } catch {
      return null;
    }
  }
}
