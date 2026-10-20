import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { NgIf, NgFor, SlicePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Milestone, MilestoneScript, ScriptLine } from '../../core/services/api.service';
import { MathFormulaComponent } from '../../shared/components/math-formula/math-formula.component';

/**
 * 里程碑详情页（需求 FR-14，六要素）：
 * 公式 · 含义与适用条件 · 年份 · 历史影响 · 相关人物 · 文献出处。
 */
@Component({
  selector: 'app-milestone-detail',
  standalone: true,
  imports: [NgIf, NgFor, SlicePipe, DecimalPipe, FormsModule, RouterLink, MathFormulaComponent],
  template: `
    <div class="ms-page" *ngIf="milestone() as m">
      <a class="back" routerLink="/milestones">← 返回时间线</a>

      <header class="ms-head">
        <div class="tags">
          <span class="kind-tag kind-{{ m.kind }}">{{ kindLabel(m.kind) }}</span>
          <span class="year">{{ formatYear(m.year) }}</span>
          <span class="certainty c-{{ m.certainty }}">{{ certaintyLabel(m.certainty) }}</span>
          <span class="level" *ngIf="m.level">{{ m.level }}</span>
        </div>
        <h1>{{ m.title }}</h1>
        <p class="statement">{{ m.statement }}</p>
        <div class="narr-bar">
          <button type="button" class="narr-btn" (click)="toggleNarration()">
            {{ playing() ? '⏹ 停止讲解' : '🎧 开始讲解' }}
          </button>
          <select class="voice-select" [ngModel]="voice" (ngModelChange)="setVoice($event)">
            <option value="yunxi">云希 · 男声</option>
            <option value="xiaoxiao">晓晓 · 女声</option>
          </select>
          <span class="narr-hint" *ngIf="notice()">{{ notice() }}</span>
        </div>
      </header>

      <!-- 讲解文稿（点击任意行可跳播） -->
      <section class="card script-card" *ngIf="script() as s">
        <h2>讲解文稿（{{ s.total_lines }} 句 · {{ (s.total_duration_ms / 1000) | number:'1.0-0' }} 秒）</h2>
        <div class="line" *ngFor="let l of flatLines(); let i = index"
             [class.active]="currentLine() === i" (click)="playAt(i)">
          <span class="idx">{{ i + 1 }}</span>{{ l.text }}
        </div>
      </section>

      <!-- 要素 1：公式 -->
      <section class="card" *ngIf="m.latex">
        <h2>公式</h2>
        <div class="formula-box"><math-formula [latex]="m.latex"></math-formula></div>
      </section>

      <!-- 要素 2：含义与适用条件 -->
      <section class="card" *ngIf="m.meaning || m.conditions">
        <h2>含义与适用条件</h2>
        <p *ngIf="m.meaning">{{ m.meaning }}</p>
        <p class="conditions" *ngIf="m.conditions"><b>适用条件：</b>{{ m.conditions }}</p>
      </section>

      <!-- 要素 4：历史影响 -->
      <section class="card impact-card">
        <h2>改变了什么（历史影响）</h2>
        <p>{{ m.impact }}</p>
      </section>

      <!-- 要素 5：相关人物 -->
      <section class="card" *ngIf="m.figures?.length">
        <h2>相关物理学家</h2>
        <div class="figure-row">
          <a *ngFor="let f of m.figures" class="figure-chip" [routerLink]="['/figures', f.slug]">
            <span class="fname">{{ f.name }}</span>
            <span class="fyears">{{ f.born }}–{{ f.died || '今' }}</span>
          </a>
        </div>
      </section>

      <!-- 关联展项 -->
      <section class="card" *ngIf="m.experiments?.length">
        <h2>可交互展项</h2>
        <div class="exp-row">
          <a *ngFor="let e of m.experiments" class="exp-chip" [routerLink]="['/experiment', e.slug]">▶ {{ e.title }}</a>
        </div>
      </section>

      <!-- 要素 6：出处 -->
      <section class="card source">
        <h2>出处</h2>
        <p>{{ m.source_ref || '—' }}</p>
      </section>
    </div>

    <div class="loading" *ngIf="!milestone() && !error()">加载中…</div>
    <div class="loading" *ngIf="error()">{{ error() }}</div>
  `,
  styles: [`
    .ms-page { max-width: 860px; margin: 0 auto; padding-bottom: 3rem; }
    .back { display: inline-block; color: #667eea; text-decoration: none; font-size: 0.88rem; margin-bottom: 1rem; }
    .ms-head { margin-bottom: 1.4rem; }
    .tags { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.7rem; flex-wrap: wrap; }
    .kind-tag { font-size: 0.75rem; padding: 0.18rem 0.6rem; border-radius: 4px; color: #fff; }
    .kind-law { background: #667eea; } .kind-formula { background: #38b2ac; }
    .kind-invention { background: #ed8936; } .kind-experiment { background: #48bb78; }
    .year { font-weight: 700; color: #2d3748; }
    .certainty { font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid; }
    .c-observed { color: #276749; border-color: #9ae6b4; background: #f0fff4; }
    .c-theory-supported { color: #2b6cb0; border-color: #90cdf4; background: #ebf8ff; }
    .c-math-predicted { color: #744210; border-color: #f6e05e; background: #fffff0; }
    .c-philosophical { color: #553c9a; border-color: #d6bcfa; background: #faf5ff; }
    .c-sci-fi { color: #718096; border-color: #cbd5e0; background: #f7fafc; }
    .level { font-size: 0.72rem; background: #edf2f7; color: #4a5568; padding: 0.15rem 0.5rem; border-radius: 4px; }
    .ms-head h1 { font-size: 1.9rem; color: #1a202c; margin-bottom: 0.6rem; }
    .statement { color: #4a5568; font-size: 1.02rem; line-height: 1.7; }
    .narr-bar { display: flex; gap: 0.7rem; align-items: center; margin-top: 1rem; flex-wrap: wrap; }
    .narr-btn { padding: 0.55rem 1.2rem; border: none; border-radius: 8px; cursor: pointer; font-size: 0.92rem; color: #fff; background: linear-gradient(135deg, #667eea, #764ba2); box-shadow: 0 3px 10px rgba(102,126,234,0.35); }
    .narr-btn:hover { filter: brightness(1.08); }
    .voice-select { padding: 0.45rem 0.7rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; color: #4a5568; background: #fff; }
    .narr-hint { font-size: 0.82rem; color: #a0aec0; }
    .script-card h2 { margin-bottom: 0.6rem; }
    .line { display: flex; gap: 0.6rem; padding: 0.5rem 0.7rem; border-radius: 6px; color: #4a5568; font-size: 0.92rem; line-height: 1.7; cursor: pointer; transition: background 0.15s; }
    .line:hover { background: #f7fafc; }
    .line.active { background: #ebf4ff; color: #2b6cb0; font-weight: 600; box-shadow: inset 3px 0 0 #667eea; }
    .line .idx { flex: 0 0 22px; color: #a0aec0; font-size: 0.78rem; padding-top: 2px; }
    .line.active .idx { color: #667eea; }

    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.2rem 1.4rem; margin-bottom: 1rem; }
    .card h2 { font-size: 0.95rem; color: #667eea; margin-bottom: 0.7rem; }
    .card p { color: #4a5568; line-height: 1.8; font-size: 0.94rem; margin: 0 0 0.5rem; }
    .conditions { color: #718096 !important; font-size: 0.87rem !important; }
    .conditions b { color: #ed8936; }
    .formula-box { background: #f7fafc; border: 1px dashed #cbd5e0; border-radius: 8px; padding: 1rem; text-align: center; overflow-x: auto; }
    .impact-card { background: linear-gradient(160deg, #0f172a, #1e293b); border-color: #334155; }
    .impact-card h2 { color: #a5b4fc; }
    .impact-card p { color: #e2e8f0; }

    .figure-row, .exp-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .figure-chip { display: flex; flex-direction: column; background: #ebf4ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 0.5rem 0.9rem; text-decoration: none; }
    .figure-chip .fname { color: #2b6cb0; font-weight: 600; font-size: 0.92rem; }
    .figure-chip .fyears { color: #90cdf4; font-size: 0.75rem; }
    .figure-chip:hover { border-color: #63b3ed; }
    .exp-chip { background: #f0fff4; border: 1px solid #9ae6b4; color: #276749; border-radius: 18px; padding: 0.4rem 0.9rem; text-decoration: none; font-size: 0.87rem; }
    .exp-chip:hover { background: #c6f6d5; }
    .source p { color: #718096; font-size: 0.85rem; font-family: Consolas, monospace; }
    .loading { text-align: center; color: #a0aec0; padding: 4rem; }
  `],
})
export class MilestoneDetailComponent implements OnInit, OnDestroy {
  milestone = signal<Milestone | null>(null);
  error = signal('');
  /** 讲解播放状态 */
  script = signal<MilestoneScript | null>(null);
  playing = signal(false);
  currentLine = signal(-1);
  notice = signal('');
  voice: 'yunxi' | 'xiaoxiao' = 'yunxi';
  private audio: HTMLAudioElement | null = null;
  private playToken = 0;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) return;
      this.stopNarration();
      this.script.set(null);
      this.notice.set('');
      this.milestone.set(null);
      this.error.set('');
      this.api.getMilestone(slug).subscribe({
        next: (resp) => {
          if (resp.code === 0 && resp.data) {
            this.milestone.set(resp.data);
          } else {
            this.error.set('未找到该里程碑');
          }
        },
        error: () => this.error.set('加载失败，请确认后端服务已启动'),
      });
    });
  }

  kindLabel(kind: string): string {
    const map: Record<string, string> = { law: '定律', formula: '公式', invention: '发明', experiment: '关键实验' };
    return map[kind] ?? kind;
  }

  certaintyLabel(c: string): string {
    const map: Record<string, string> = {
      observed: '已观测', 'theory-supported': '理论支持', 'math-predicted': '数学预言',
      philosophical: '哲学猜想', 'sci-fi': '科幻想象',
    };
    return map[c] ?? c;
  }

  formatYear(year: number): string {
    return year < 0 ? `公元前 ${-year} 年` : `${year} 年`;
  }

  // ===== 讲解播放 =====

  /** 展平全部讲解行（跨 section） */
  flatLines(): ScriptLine[] {
    const s = this.script();
    if (!s) return [];
    return s.sections.flatMap((sec) => sec.lines);
  }

  /** 开始/停止讲解 */
  toggleNarration(): void {
    if (this.playing()) {
      this.stopNarration();
      return;
    }
    if (this.script()) {
      this.playFrom(0);
      return;
    }
    const m = this.milestone();
    if (!m) return;
    this.notice.set('正在加载讲解文稿…');
    this.api.getMilestoneScript(m.slug).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data && resp.data.total_lines > 0) {
          this.script.set(resp.data);
          this.notice.set('');
          this.playFrom(0);
        } else {
          this.notice.set('该里程碑的讲解文稿尚未生成');
        }
      },
      error: () => this.notice.set('讲解加载失败，请确认后端服务'),
    });
  }

  /** 从指定行开始播放（点击文稿行跳播） */
  playAt(index: number): void {
    if (!this.script()) return;
    this.playFrom(index);
  }

  setVoice(v: 'yunxi' | 'xiaoxiao'): void {
    if (v === this.voice) return;
    this.voice = v;
    if (this.playing()) {
      const idx = Math.max(0, this.currentLine());
      this.stopAudio();
      this.playFrom(idx); // 用新音色从当前句重播
    }
  }

  private playFrom(index: number): void {
    const lines = this.flatLines();
    if (index >= lines.length) {
      this.stopNarration();
      this.currentLine.set(-1);
      return;
    }
    this.stopAudio();
    const token = ++this.playToken;
    const line = lines[index];
    this.currentLine.set(index);
    this.playing.set(true);

    const url = (this.voice === 'yunxi' ? line.audio_yunxi : line.audio_xiaoxiao) || line.audio_yunxi;
    const fallback = (): void => {
      // 无音频/播放失败：按字数估时推进（与展项讲解一致的降级策略）
      const ms = Math.max(800, line.text.length * 190);
      window.setTimeout(() => {
        if (this.playing() && this.playToken === token) this.playFrom(index + 1);
      }, ms);
    };
    if (!url) {
      fallback();
      return;
    }
    const a = new Audio(url);
    this.audio = a;
    a.onended = () => {
      if (this.playToken === token) this.playFrom(index + 1);
    };
    a.onerror = fallback;
    a.play().catch(fallback);
  }

  private stopAudio(): void {
    if (this.audio) {
      try {
        this.audio.onended = null;
        this.audio.onerror = null;
        this.audio.pause();
      } catch {
        /* ignore */
      }
      this.audio = null;
    }
  }

  stopNarration(): void {
    this.playToken++;
    this.stopAudio();
    this.playing.set(false);
    this.currentLine.set(-1);
  }

  ngOnDestroy(): void {
    this.stopNarration();
  }
}
