import { Component, OnInit, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Experiment, Narration } from '../../core/services/api.service';

const DIFFICULTIES: Array<[string, string]> = [
  ['', '全部难度'],
  ['basic', '基础篇（小学）'],
  ['intro', '入门篇（初中）'],
  ['intermediate', '中级篇（高中）'],
  ['advanced', '高级篇（大学）'],
  ['professional', '专业篇（研究生）'],
  ['academic', '学术级'],
];

const STATUSES: Array<[string, string]> = [
  ['', '全部状态'],
  ['pending', '待生成'],
  ['generating', '生成中'],
  ['ready', '已就绪'],
  ['failed', '失败'],
];

/** 讲解行编辑缓冲。 */
interface LineDraft {
  id: number;
  section_id: string;
  section_title: string;
  text: string;
  audio_yunxi: string;
  audio_xiaoxiao: string;
}

/**
 * 实验与讲解稿件管理：列表筛选、编辑实验元数据、删除实验，
 * 以及单个实验的讲解稿件查看/编辑/删除/批量导入。
 */
@Component({
  selector: 'experiments-panel',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  template: `
    <div class="panel">
      <!-- 筛选条 -->
      <div class="filters">
        <input class="search" [(ngModel)]="query" placeholder="按标题或 slug 搜索…" (keyup.enter)="load()" />
        <select [(ngModel)]="difficulty" (change)="load()">
          <option *ngFor="let d of difficulties" [value]="d[0]">{{ d[1] }}</option>
        </select>
        <select [(ngModel)]="contentStatus" (change)="load()">
          <option *ngFor="let s of statuses" [value]="s[0]">{{ s[1] }}</option>
        </select>
        <button class="btn-primary" (click)="load()">查询</button>
        <span class="total">共 {{ total() }} 个实验</span>
      </div>

      <div class="notice" *ngIf="message()">{{ message() }}</div>

      <div class="split">
        <!-- 实验列表 -->
        <div class="card list-card">
          <table class="tbl">
            <thead>
              <tr><th>编号</th><th>标题</th><th>难度</th><th>内容状态</th><th class="col-actions">操作</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of experiments()" [class.row-selected]="selected()?.id === e.id">
                <td class="mono">{{ e.number || '—' }}</td>
                <td>
                  <strong>{{ e.title }}</strong>
                  <code>{{ e.slug }}</code>
                </td>
                <td>{{ e.level }}</td>
                <td>
                  <span class="tag" [class.tag-ok]="e.content_status === 'ready'"
                        [class.tag-bad]="e.content_status === 'failed'">
                    {{ statusLabel(e.content_status) }}
                  </span>
                </td>
                <td class="col-actions">
                  <button class="btn-xs" (click)="select(e)">讲解</button>
                  <button class="btn-xs" (click)="edit(e)">编辑</button>
                  <button class="btn-xs btn-danger" (click)="remove(e)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="pager">
            <button class="btn-xs" (click)="prevPage()" [disabled]="page() <= 1">上一页</button>
            <span>第 {{ page() }} / {{ totalPages() }} 页</span>
            <button class="btn-xs" (click)="nextPage()" [disabled]="page() >= totalPages()">下一页</button>
          </div>
        </div>

        <!-- 讲解稿件 -->
        <div class="card narration-card">
          <h2 *ngIf="selected(); else pickHint">
            讲解稿件：{{ selected()!.title }}
            <code>{{ selected()!.slug }}</code>
          </h2>
          <ng-template #pickHint>
            <div class="empty">从左侧列表选择一个实验，即可查看 / 编辑它的讲解稿件</div>
          </ng-template>

          <div *ngIf="selected()">
            <div class="narration-actions">
              <button class="btn-xs" (click)="loadNarrations()">刷新</button>
              <span class="meta">{{ lines().length }} 条台词</span>
            </div>

            <div class="line-list">
              <div class="line" *ngFor="let l of lines(); let i = index">
                <div class="line-head">
                  <span class="line-idx">{{ i + 1 }}</span>
                  <span class="line-sec">{{ l.section_title || l.section_id }}</span>
                  <span class="line-audio" *ngIf="l.audio_yunxi">🔊 云希</span>
                  <span class="line-audio" *ngIf="l.audio_xiaoxiao">🔊 晓晓</span>
                  <span class="line-audio muted" *ngIf="!l.audio_yunxi && !l.audio_xiaoxiao">未合成</span>
                  <button class="btn-xs btn-danger" (click)="removeLine(l)">删除</button>
                </div>
                <textarea rows="2" [(ngModel)]="l.text"></textarea>
                <div class="line-foot">
                  <input class="sec-input" [(ngModel)]="l.section_id" placeholder="section_id" title="小节标识" />
                  <button class="btn-xs" (click)="saveLine(l)">保存这一句</button>
                </div>
              </div>
              <div class="empty" *ngIf="lines().length === 0">该实验还没有讲解稿件，可用下方「批量导入」粘贴稿件。</div>
            </div>

            <details class="import">
              <summary>批量导入讲解稿件（JSON 数组）</summary>
              <p class="desc">
                格式：<code>[&#123; "section_id": "intro", "section_title": "开场", "text": "第一句…" &#125;, …]</code>；
                留空 line_id 时后端会按顺序自动编号。
              </p>
              <textarea rows="6" [(ngModel)]="importText" placeholder="粘贴 JSON 数组：每项含 section_id / section_title / text"></textarea>
              <div class="line-foot">
                <label class="chk"><input type="checkbox" [(ngModel)]="importReplace" /> 覆盖已有稿件</label>
                <button class="btn-primary" (click)="importLines()">导入</button>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- 编辑实验元数据 -->
      <div class="modal-mask" *ngIf="editing()" (click)="editing.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>编辑实验：{{ editing()!.slug }}</h3>
          <label>标题<input [(ngModel)]="editing()!.title" /></label>
          <label>核心概念<input [(ngModel)]="editing()!.concept" /></label>
          <label>难度
            <select [(ngModel)]="editing()!.difficulty">
              <option *ngFor="let d of difficulties.slice(1)" [value]="d[0]">{{ d[1] }}</option>
            </select>
          </label>
          <label>描述<textarea rows="3" [(ngModel)]="editing()!.description"></textarea></label>
          <div class="modal-actions">
            <button class="btn-primary" (click)="saveEdit()">保存</button>
            <button class="btn-ghost" (click)="editing.set(null)">取消</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filters { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-bottom: 1rem; }
    .search { padding: 0.45rem 0.7rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; width: 220px; }
    .filters select { padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; }
    .total { margin-left: auto; font-size: 0.8rem; color: #718096; }
    .btn-primary { padding: 0.45rem 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
    .btn-ghost { padding: 0.45rem 0.95rem; background: #edf2f7; color: #4a5568; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
    .notice { padding: 0.6rem 1rem; background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; color: #2a4365; font-size: 0.85rem; margin-bottom: 1rem; }
    .split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 1.25rem; align-items: start; }
    @media (max-width: 1200px) { .split { grid-template-columns: 1fr; } }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; }
    .list-card { max-height: 70vh; overflow-y: auto; }
    .narration-card { padding: 1.25rem; }
    .narration-card h2 { font-size: 0.95rem; color: #2d3748; margin-bottom: 0.75rem; }
    .narration-card h2 code { margin-left: 0.4rem; font-size: 0.72rem; color: #a0aec0; }
    .tbl { width: 100%; border-collapse: collapse; }
    .tbl th { position: sticky; top: 0; background: #f7fafc; padding: 0.5rem 0.8rem; text-align: left; font-size: 0.72rem; color: #718096; }
    .tbl td { padding: 0.55rem 0.8rem; font-size: 0.82rem; color: #2d3748; border-bottom: 1px solid #edf2f7; }
    .tbl code { display: block; font-size: 0.7rem; color: #a0aec0; }
    .row-selected { background: #f0f5ff; }
    .mono { font-family: Consolas, monospace; font-size: 0.75rem; }
    .col-actions { text-align: right; white-space: nowrap; }
    .btn-xs { padding: 0.2rem 0.55rem; margin-left: 0.25rem; font-size: 0.72rem; border: 1px solid #cbd5e0; background: #fff; border-radius: 6px; cursor: pointer; color: #4a5568; }
    .btn-xs:hover { background: #edf2f7; }
    .btn-xs:disabled { opacity: 0.45; cursor: default; }
    .btn-danger { color: #c53030; border-color: #feb2b2; }
    .tag { padding: 0.1rem 0.4rem; border-radius: 4px; background: #edf2f7; color: #718096; font-size: 0.7rem; }
    .tag-ok { background: #c6f6d5; color: #22543d; }
    .tag-bad { background: #fed7d7; color: #822727; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 0.75rem; font-size: 0.78rem; color: #718096; }
    .narration-actions { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
    .meta { font-size: 0.78rem; color: #a0aec0; }
    .line-list { max-height: 46vh; overflow-y: auto; }
    .line { border: 1px solid #edf2f7; border-radius: 8px; padding: 0.6rem; margin-bottom: 0.6rem; }
    .line-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
    .line-idx { width: 22px; height: 22px; border-radius: 50%; background: #667eea; color: #fff; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; }
    .line-sec { font-size: 0.75rem; color: #4a5568; }
    .line-audio { font-size: 0.68rem; color: #38a169; }
    .line-audio.muted { color: #cbd5e0; }
    .line-head .btn-xs { margin-left: auto; }
    .line textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.4rem 0.5rem; font-size: 0.8rem; font-family: inherit; resize: vertical; }
    .line-foot { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; }
    .sec-input { flex: 1; padding: 0.3rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.75rem; }
    .import { margin-top: 1rem; border-top: 1px solid #edf2f7; padding-top: 0.75rem; }
    .import summary { font-size: 0.8rem; color: #4a5568; cursor: pointer; }
    .import .desc { font-size: 0.75rem; color: #718096; margin: 0.5rem 0; line-height: 1.6; }
    .import textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem; font-size: 0.78rem; font-family: Consolas, monospace; }
    .chk { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: #4a5568; }
    .empty { padding: 1.5rem; color: #a0aec0; font-size: 0.85rem; text-align: center; }
    .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: #fff; border-radius: 14px; padding: 1.5rem; width: min(520px, 92vw); }
    .modal h3 { margin-bottom: 1rem; color: #2d3748; font-size: 1rem; }
    .modal label { display: block; margin-bottom: 0.8rem; font-size: 0.78rem; color: #4a5568; }
    .modal input, .modal select, .modal textarea { width: 100%; margin-top: 0.3rem; padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; font-family: inherit; }
    .modal-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class ExperimentsPanelComponent implements OnInit {
  readonly difficulties = DIFFICULTIES;
  readonly statuses = STATUSES;

  experiments = signal<Experiment[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 30;
  selected = signal<Experiment | null>(null);
  lines = signal<Narration[]>([]);
  editing = signal<Experiment | null>(null);
  message = signal('');

  query = '';
  difficulty = '';
  contentStatus = '';
  importText = '';
  importReplace = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  statusLabel(s?: string): string {
    const found = STATUSES.find(([v]) => v === s);
    return found ? found[1] : s || '—';
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  load(): void {
    this.api
      .getAdminExperiments({
        page: this.page(),
        pageSize: this.pageSize,
        difficulty: this.difficulty,
        contentStatus: this.contentStatus,
        q: this.query,
      })
      .subscribe({
        next: (resp) => {
          if (resp.code === 0 && resp.data) {
            this.experiments.set(resp.data.experiments ?? []);
            this.total.set(resp.data.total ?? 0);
          }
        },
        error: (err) => this.message.set(`加载失败：${err?.error?.message ?? err.message}`),
      });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
      this.load();
    }
  }

  select(e: Experiment): void {
    this.selected.set(e);
    this.loadNarrations();
  }

  loadNarrations(): void {
    const e = this.selected();
    if (!e) return;
    this.api.getAdminNarrations(e.id).subscribe({
      next: (resp) => {
        if (resp.code === 0) this.lines.set(resp.data ?? []);
      },
      error: (err) => this.message.set(`讲解加载失败：${err?.error?.message ?? err.message}`),
    });
  }

  saveLine(l: Narration): void {
    const id = l.id ?? l.ID;
    if (!id) return;
    this.api.updateNarration(id, l.text, l.section_id).subscribe({
      next: (resp) => this.message.set(resp.code === 0 ? '已保存该句讲解' : resp.message ?? '保存失败'),
      error: (err) => this.message.set(`保存失败：${err?.error?.message ?? err.message}`),
    });
  }

  removeLine(l: Narration): void {
    const id = l.id ?? l.ID;
    if (!id) return;
    if (!confirm('确定删除这一句讲解？（音频文件不会自动删除）')) return;
    this.api.deleteNarration(id).subscribe({
      next: () => {
        this.message.set('已删除该句');
        this.loadNarrations();
      },
      error: (err) => this.message.set(`删除失败：${err?.error?.message ?? err.message}`),
    });
  }

  importLines(): void {
    const e = this.selected();
    if (!e) return;
    let parsed: Array<{ section_id?: string; section_title?: string; text: string }>;
    try {
      parsed = JSON.parse(this.importText);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('应为非空数组');
    } catch (err) {
      this.message.set(`稿件 JSON 解析失败：${(err as Error).message}`);
      return;
    }
    this.api.importNarrations(e.id, parsed, this.importReplace).subscribe({
      next: (resp) => {
        this.message.set(resp.code === 0 ? `已导入 ${resp.data?.lines ?? parsed.length} 行讲解` : resp.message ?? '导入失败');
        this.importText = '';
        this.loadNarrations();
      },
      error: (err) => this.message.set(`导入失败：${err?.error?.message ?? err.message}`),
    });
  }

  edit(e: Experiment): void {
    // 深拷贝，取消时不污染列表
    this.editing.set({ ...e });
  }

  saveEdit(): void {
    const e = this.editing();
    if (!e) return;
    this.api
      .updateExperiment(e.id, {
        title: e.title,
        concept: e.concept,
        difficulty: e.difficulty,
        description: e.description,
      })
      .subscribe({
        next: (resp) => {
          this.message.set(resp.code === 0 ? `已更新实验「${e.title}」` : resp.message ?? '更新失败');
          this.editing.set(null);
          this.load();
        },
        error: (err) => this.message.set(`更新失败：${err?.error?.message ?? err.message}`),
      });
  }

  remove(e: Experiment): void {
    if (!confirm(`确定删除实验「${e.title}」？其讲解稿件会一并删除，操作不可恢复。`)) return;
    this.api.deleteExperiment(e.id).subscribe({
      next: (resp) => {
        this.message.set(resp.code === 0 ? `已删除「${e.title}」` : resp.message ?? '删除失败');
        if (this.selected()?.id === e.id) {
          this.selected.set(null);
          this.lines.set([]);
        }
        this.load();
      },
      error: (err) => this.message.set(`删除失败：${err?.error?.message ?? err.message}`),
    });
  }
}
