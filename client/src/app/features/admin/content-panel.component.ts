import { Component, OnInit, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  BatchSummary,
  ContentOverview,
  GenerateResult,
  SynthResult,
} from '../../core/services/api.service';

/** 难度选项。 */
const DIFFICULTIES: Array<[string, string]> = [
  ['', '全部难度'],
  ['basic', '基础篇（小学）'],
  ['intro', '入门篇（初中）'],
  ['intermediate', '中级篇（高中）'],
  ['advanced', '高级篇（大学）'],
  ['professional', '专业篇（研究生）'],
  ['academic', '学术级'],
];

/** 内容状态中文名。 */
const STATUS_LABEL: Record<string, string> = {
  pending: '待生成',
  generating: '生成中',
  ready: '已就绪',
  failed: '失败',
};

/**
 * 需求 4 + 需求 6：用提示词驱动大模型生成教学内容，并做语音合成。
 * 生成/合成都是耗时操作，界面给出进行中提示与结果明细。
 */
@Component({
  selector: 'content-panel',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  template: `
    <div class="panel">
      <!-- 内容概览 -->
      <div class="overview" *ngIf="overview()">
        <div class="ov-card" *ngFor="let s of statusKeys">
          <span class="ov-value">{{ statusCount(s) }}</span>
          <span class="ov-label">{{ statusLabel(s) }}</span>
        </div>
        <div class="ov-card">
          <span class="ov-value">{{ overview()!.audio_lines_yunxi }}</span>
          <span class="ov-label">云希音频条数</span>
        </div>
        <div class="ov-card">
          <span class="ov-value">{{ overview()!.audio_lines_xiaoxiao }}</span>
          <span class="ov-label">晓晓音频条数</span>
        </div>
      </div>

      <div class="notice" *ngIf="message()">{{ message() }}</div>
      <div class="busy" *ngIf="busy()">
        <span class="spinner"></span>
        {{ busyText() }}
        <small>大模型调用可能需要数十秒到数分钟，请勿关闭页面</small>
      </div>

      <div class="grid">
        <!-- 生成教学内容 -->
        <section class="card">
          <h2>① AI 生成教学内容</h2>
        <p class="panel-hint">
          这里是<b>批量与运维</b>视角：适合按难度批量生成、批量合成与查看整体进度。
          针对<b>单个实验</b>的日常教学，请到该实验详情页的「AI 教学」tab —— 那里会流式实时显示生成过程，并可随时取消。
        </p>
          <p class="desc">
            按提示词让大模型生成该实验的图文讲解、LaTeX 公式、历史背景、应用场景与讲解稿件。
            需要先在「大模型配置」中激活一个 LLM。
            <br />
            生成内容<b>只写入 AI 版</b>，种子版内容不会被覆盖；在实验详情页点「🤖 AI 教学（AI 版）」tab 即可让 AI 版生效。
          </p>

          <div class="row">
            <label>单个实验 ID
              <input type="number" min="1" [(ngModel)]="singleExpId" placeholder="实验 ID" />
            </label>
            <button class="btn-primary" (click)="generateOne()" [disabled]="busy() || !singleExpId">生成该实验</button>
          </div>

          <hr />

          <div class="row">
            <label>难度范围
              <select [(ngModel)]="batchDifficulty">
                <option *ngFor="let d of difficulties" [value]="d[0]">{{ d[1] }}</option>
              </select>
            </label>
            <label>数量
              <input type="number" min="1" max="50" [(ngModel)]="batchLimit" />
            </label>
            <label class="chk">
              <input type="checkbox" [(ngModel)]="includeReady" />
              包含已生成的（重新生成）
            </label>
            <button class="btn-primary" (click)="generateBatch()" [disabled]="busy()">批量生成</button>
          </div>

          <div class="result" *ngIf="batchResult()">
            <h4>批量生成结果：成功 {{ batchResult()!.succeeded }} / {{ batchResult()!.total }}，失败 {{ batchResult()!.failed }}</h4>
            <table class="tbl">
              <thead>
                <tr><th>实验</th><th>状态</th><th>小节</th><th>台词</th><th>公式</th><th>应用</th><th>说明</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of batchResult()!.results">
                  <td>{{ r.title }} <code>{{ r.slug }}</code></td>
                  <td><span class="tag" [class.tag-ok]="r.status === 'ready'" [class.tag-bad]="r.status === 'failed'">{{ r.status }}</span></td>
                  <td>{{ r.sections }}</td>
                  <td>{{ r.lines }}</td>
                  <td>{{ r.formulas }}</td>
                  <td>{{ r.app_hooks }}</td>
                  <td class="err">{{ r.message || r.warning || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 语音合成 -->
        <section class="card">
          <h2>② 语音合成（云端 + Edge TTS）</h2>
          <p class="desc">
            把讲解稿件逐句合成为音频。音色：云希（男声）与晓晓（女声）。
            语音服务按当前激活的 TTS 大模型选择；未配置时自动使用内置 Edge TTS。
            <br />
            合成<b>只更新 AI 版配音</b>（写入 <code>&lt;实验ID&gt;/&lt;音色&gt;/ai/</code>），种子版配音始终保持不变；
            没有 AI 版内容的实验会被跳过，请先在实验页生成 AI 文稿。
          </p>

          <div class="row">
            <label>单个实验 ID
              <input type="number" min="1" [(ngModel)]="synthExpId" placeholder="实验 ID" />
            </label>
            <label class="chk"><input type="checkbox" [(ngModel)]="synthYunxi" /> 云希</label>
            <label class="chk"><input type="checkbox" [(ngModel)]="synthXiaoxiao" /> 晓晓</label>
            <label class="chk"><input type="checkbox" [(ngModel)]="synthForce" /> 强制重合成</label>
            <button class="btn-primary" (click)="synthesizeOne()" [disabled]="busy() || !synthExpId">合成该实验</button>
          </div>

          <hr />

          <div class="row">
            <label>批量音色
              <select [(ngModel)]="batchVoice">
                <option value="yunxi">云希（男声）</option>
                <option value="xiaoxiao">晓晓（女声）</option>
              </select>
            </label>
            <label>数量
              <input type="number" min="1" max="100" [(ngModel)]="synthLimit" />
            </label>
            <button class="btn-primary" (click)="synthesizeBatch()" [disabled]="busy()">批量合成</button>
          </div>

          <div class="result" *ngIf="synthResults().length">
            <h4>合成结果</h4>
            <table class="tbl">
              <thead>
                <tr><th>实验 ID</th><th>音色</th><th>成功</th><th>跳过</th><th>失败</th><th>总时长(s)</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of synthResults()">
                  <td>{{ r.experiment_id }}</td>
                  <td>{{ r.voice }}</td>
                  <td>{{ r.synthesized }}</td>
                  <td>{{ r.skipped }}</td>
                  <td [class.err]="r.failed > 0">{{ r.failed }}</td>
                  <td>{{ (r.total_duration_ms / 1000).toFixed(1) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="err" *ngFor="let e of synthErrors()">{{ e }}</div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .panel-hint { background: #ebf8ff; border-left: 3px solid #4299e1; color: #2a4365; font-size: 0.8rem; line-height: 1.7; padding: 0.6rem 0.9rem; border-radius: 6px; margin: 0.5rem 0 1rem; }
    .panel-hint b { color: #2b6cb0; }
    .overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .ov-card { background: #fff; border-radius: 10px; padding: 0.9rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .ov-value { display: block; font-size: 1.4rem; font-weight: 700; color: #667eea; }
    .ov-label { font-size: 0.75rem; color: #718096; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #fff; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card h2 { font-size: 1rem; color: #2d3748; margin-bottom: 0.5rem; }
    .desc { font-size: 0.8rem; color: #718096; line-height: 1.6; margin-bottom: 1rem; }
    .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
    .row label { font-size: 0.78rem; color: #4a5568; display: flex; flex-direction: column; gap: 0.25rem; }
    .row input[type=number], .row select { padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; width: 130px; }
    .chk { flex-direction: row !important; align-items: center; gap: 0.35rem; }
    hr { border: none; border-top: 1px dashed #e2e8f0; margin: 1rem 0; }
    .btn-primary { padding: 0.5rem 1rem; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
    .btn-primary:disabled { opacity: 0.55; cursor: default; }
    .notice { padding: 0.6rem 1rem; background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; color: #2a4365; font-size: 0.85rem; margin-bottom: 1rem; }
    .busy { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1rem; background: #fffaf0; border: 1px solid #f6ad55; border-radius: 8px; color: #975a16; font-size: 0.85rem; margin-bottom: 1rem; }
    .busy small { color: #a0aec0; }
    .spinner { width: 16px; height: 16px; border: 2px solid #f6ad55; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .result { margin-top: 1rem; }
    .result h4 { font-size: 0.85rem; color: #2d3748; margin-bottom: 0.5rem; }
    .tbl { width: 100%; border-collapse: collapse; }
    .tbl th { padding: 0.4rem 0.6rem; text-align: left; font-size: 0.72rem; color: #718096; border-bottom: 1px solid #edf2f7; }
    .tbl td { padding: 0.45rem 0.6rem; font-size: 0.78rem; color: #2d3748; border-bottom: 1px solid #edf2f7; }
    .tbl code { background: #f7fafc; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.72rem; color: #718096; }
    .tag { padding: 0.1rem 0.4rem; border-radius: 4px; background: #edf2f7; color: #718096; font-size: 0.7rem; }
    .tag-ok { background: #c6f6d5; color: #22543d; }
    .tag-bad { background: #fed7d7; color: #822727; }
    .err { color: #c53030; font-size: 0.75rem; }
  `]
})
export class ContentPanelComponent implements OnInit {
  readonly difficulties = DIFFICULTIES;
  readonly statusKeys = ['pending', 'generating', 'ready', 'failed'];

  overview = signal<ContentOverview | null>(null);
  batchResult = signal<BatchSummary | null>(null);
  synthResults = signal<SynthResult[]>([]);
  busy = signal(false);
  busyText = signal('');
  message = signal('');

  singleExpId: number | null = null;
  batchDifficulty = '';
  batchLimit = 5;
  includeReady = false;

  synthExpId: number | null = null;
  synthYunxi = true;
  synthXiaoxiao = true;
  synthForce = false;
  batchVoice = 'yunxi';
  synthLimit = 20;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.reloadOverview();
  }

  statusLabel(s: string): string {
    return STATUS_LABEL[s] ?? s;
  }

  /** 某内容状态的实验数（模板中避免可选链索引）。 */
  statusCount(s: string): number {
    const ov = this.overview();
    return ov && ov.content_status ? ov.content_status[s] ?? 0 : 0;
  }

  synthErrors(): string[] {
    return this.synthResults().flatMap((r) => r.errors ?? []).slice(0, 12);
  }

  reloadOverview(): void {
    this.api.getContentOverview().subscribe({
      next: (resp) => {
        if (resp.code === 0) this.overview.set(resp.data ?? null);
      },
    });
  }

  generateOne(): void {
    const id = Number(this.singleExpId);
    if (!id) return;
    this.run(`正在为实验 #${id} 生成教学内容…`, this.api.generateContent(id), (resp) => {
      if (resp.code !== 0) {
        this.message.set(`生成失败：${resp.message ?? '未知错误'}`);
        return;
      }
      const r = resp.data as GenerateResult;
      this.batchResult.set({ total: 1, succeeded: r.status === 'ready' ? 1 : 0, failed: r.status === 'ready' ? 0 : 1, results: [r] });
      this.message.set(`实验「${r.title}」生成完成：${r.sections} 个小节 / ${r.lines} 句台词 / ${r.formulas} 条公式`);
      this.reloadOverview();
    });
  }

  generateBatch(): void {
    const limit = Math.max(1, Math.min(50, Number(this.batchLimit) || 1));
    this.run(`正在批量生成 ${limit} 个实验的教学内容…`, this.api.generateContentBatch(limit, this.batchDifficulty, this.includeReady), (resp) => {
      if (resp.code !== 0) {
        this.message.set(`批量生成失败：${resp.message ?? '未知错误'}`);
        return;
      }
      const summary = resp.data as BatchSummary;
      this.batchResult.set(summary);
      this.message.set(`批量生成结束：成功 ${summary.succeeded} 个，失败 ${summary.failed} 个`);
      this.reloadOverview();
    });
  }

  synthesizeOne(): void {
    const id = Number(this.synthExpId);
    if (!id) return;
    const voices: string[] = [];
    if (this.synthYunxi) voices.push('yunxi');
    if (this.synthXiaoxiao) voices.push('xiaoxiao');
    if (voices.length === 0) {
      this.message.set('请至少选择一个音色');
      return;
    }
    this.run(`正在为实验 #${id} 合成语音（${voices.join(' / ')}）…`, this.api.synthesizeNarrations(id, voices, this.synthForce), (resp) => {
      if (resp.code !== 0) {
        this.message.set(`合成失败：${resp.message ?? '未知错误'}`);
        return;
      }
      const list = (resp.data ?? []) as SynthResult[];
      this.synthResults.set(list);
      const total = list.reduce((a, r) => a + r.synthesized, 0);
      this.message.set(`合成完成：新增 ${total} 条音频`);
      this.reloadOverview();
    });
  }

  synthesizeBatch(): void {
    const limit = Math.max(1, Math.min(100, Number(this.synthLimit) || 1));
    this.run(`正在批量合成（${this.batchVoice}，最多 ${limit} 个实验）…`, this.api.synthesizeBatch(this.batchVoice, limit, this.synthForce), (resp) => {
      if (resp.code !== 0) {
        this.message.set(`批量合成失败：${resp.message ?? '未知错误'}`);
        return;
      }
      const list = (resp.data ?? []) as SynthResult[];
      this.synthResults.set(list);
      const total = list.reduce((a, r) => a + r.synthesized, 0);
      this.message.set(`批量合成结束：共 ${list.length} 个实验，新增 ${total} 条音频`);
      this.reloadOverview();
    });
  }

  /** 统一的耗时任务处理：显示忙碌状态、统一错误提示、结束后刷新。 */
  private run<T>(text: string, req: { subscribe: (o: { next: (r: { code: number; message?: string; data?: T }) => void; error: (e: any) => void }) => void }, onOk: (resp: { code: number; message?: string; data?: T }) => void): void {
    this.busy.set(true);
    this.busyText.set(text);
    this.message.set('');
    req.subscribe({
      next: (resp) => {
        this.busy.set(false);
        onOk(resp);
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(`请求失败：${err?.error?.message ?? err.message ?? '未知错误'}（耗时操作请耐心等待，或查看后端日志）`);
      },
    });
  }
}
