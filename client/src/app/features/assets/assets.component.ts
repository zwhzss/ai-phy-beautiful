import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ApiService, Asset } from '../../core/services/api.service';
import { environment } from '../../../environments/environment';

/**
 * 素材库（需求 FR-6 真实层）：NASA 等公共领域影像与科学数据集，
 * 每份素材常显来源 / 年份 / license / 确定性标签（QA-6 / QA-7）。
 */
@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <div class="assets-page">
      <header class="page-head">
        <h1>真实素材库</h1>
        <p>真实为锚 —— NASA 等公共领域影像与科学数据集，画面必标来源与许可；理论生成数据明确标注（QA-6/QA-7）。</p>
        <div class="kind-filter">
          <button class="chip" [class.active]="!kind()" (click)="kind.set('')">全部</button>
          <button class="chip" [class.active]="kind()==='image'" (click)="kind.set('image')">🖼 影像</button>
          <button class="chip" [class.active]="kind()==='dataset'" (click)="kind.set('dataset')">📊 数据集</button>
        </div>
      </header>

      <div class="grid">
        <div class="asset-card" *ngFor="let a of filtered()">
          <div class="thumb" *ngIf="a.kind === 'image'; else dsThumb">
            <img [src]="fileUrl(a)" [alt]="a.title" loading="lazy" />
          </div>
          <ng-template #dsThumb>
            <div class="thumb ds">📊<span>{{ a.kind === 'dataset' ? '数据集 CSV' : a.kind }}</span></div>
          </ng-template>
          <div class="body">
            <div class="meta">
              <span class="kind kind-{{ a.kind }}">{{ a.kind === 'image' ? '影像' : '数据' }}</span>
              <span class="certainty c-{{ a.certainty }}">{{ certaintyLabel(a.certainty) }}</span>
              <span class="year" *ngIf="a.year">{{ a.year }}</span>
            </div>
            <h3>{{ a.title }}</h3>
            <p>{{ a.description }}</p>
            <div class="source">
              <span class="org">🛰 {{ a.source_org }}</span>
              <span class="license">{{ a.license }}</span>
            </div>
            <button class="file-link" type="button" (click)="open(a)">查看原件 ↗</button>
          </div>
        </div>
      </div>
      <div class="empty" *ngIf="!filtered().length">暂无素材</div>

      <!-- 应用内查看器：桌面端（Wails）不能新开窗口看同源文件，见 open() 注释 -->
      <div class="viewer" *ngIf="preview() as p" role="dialog" aria-modal="true" (click)="close()">
        <div class="viewer-box" (click)="$event.stopPropagation()">
          <header class="viewer-head">
            <div>
              <strong>{{ p.title }}</strong>
              <span class="viewer-meta">{{ p.source_org }} · {{ p.license }}<ng-container *ngIf="p.credit"> · {{ p.credit }}</ng-container></span>
            </div>
            <button class="viewer-close" type="button" (click)="close()" aria-label="关闭">关闭 ✕</button>
          </header>
          <div class="viewer-body">
            <img *ngIf="p.kind === 'image'" [src]="fileUrl(p)" [alt]="p.title" />
            <video *ngIf="p.kind === 'video'" [src]="fileUrl(p)" controls></video>
            <audio *ngIf="p.kind === 'audio'" [src]="fileUrl(p)" controls></audio>
            <ng-container *ngIf="p.kind === 'dataset'">
              <pre *ngIf="previewText(); else dsState">{{ previewText() }}</pre>
              <ng-template #dsState><div class="viewer-note">{{ previewNote() || '正在读取…' }}</div></ng-template>
            </ng-container>
          </div>
          <footer class="viewer-foot">
            <code>{{ p.rel_path }}</code>
            <a *ngIf="p.source_url" [href]="p.source_url" target="_blank" rel="noopener">原始来源 ↗</a>
          </footer>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .assets-page { max-width: 1200px; margin: 0 auto; padding-bottom: 3rem; }
    .page-head h1 { color: #1a202c; margin-bottom: 0.4rem; }
    .page-head p { color: #718096; font-size: 0.95rem; margin-bottom: 1rem; max-width: 780px; line-height: 1.7; }
    .kind-filter { display: flex; gap: 0.55rem; margin-bottom: 1.4rem; }
    .chip { padding: 0.42rem 0.95rem; border: 1px solid #e2e8f0; background: #fff; color: #4a5568; border-radius: 18px; cursor: pointer; font-size: 0.84rem; }
    .chip.active { background: #667eea; border-color: #667eea; color: #fff; font-weight: 600; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 1.2rem; }
    .asset-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; transition: box-shadow 0.15s; }
    .asset-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,0.12); }
    .thumb { height: 190px; background: #0b1020; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb.ds { flex-direction: column; gap: 0.5rem; color: #7aa2ff; font-size: 2.4rem; }
    .thumb.ds span { font-size: 0.85rem; color: #94a3b8; }
    .body { padding: 0.9rem 1rem 1.1rem; }
    .meta { display: flex; gap: 0.45rem; align-items: center; margin-bottom: 0.5rem; }
    .kind { font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 4px; color: #fff; }
    .kind-image { background: #667eea; } .kind-dataset { background: #38b2ac; }
    .kind-video { background: #ed8936; } .kind-audio { background: #9f7aea; }
    .certainty { font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 4px; border: 1px solid; }
    .c-observed { color: #276749; border-color: #9ae6b4; background: #f0fff4; }
    .c-theory-supported { color: #2b6cb0; border-color: #90cdf4; background: #ebf8ff; }
    .c-philosophical { color: #553c9a; border-color: #d6bcfa; background: #faf5ff; }
    .year { font-size: 0.75rem; color: #a0aec0; }
    .body h3 { color: #1a202c; font-size: 1rem; margin-bottom: 0.4rem; }
    .body p { color: #718096; font-size: 0.8rem; line-height: 1.6; margin-bottom: 0.6rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .source { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-bottom: 0.5rem; }
    .source .org { color: #4a5568; }
    .source .license { background: #edf2f7; color: #4a5568; padding: 0.1rem 0.5rem; border-radius: 8px; }
    .file-link { font-size: 0.8rem; color: #667eea; text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit; }
    .file-link:hover { text-decoration: underline; }
    .empty { text-align: center; color: #a0aec0; padding: 3rem; }

    .viewer { position: fixed; inset: 0; z-index: 1000; background: rgba(8,12,24,0.86); display: flex; align-items: center; justify-content: center; padding: 2.5rem; }
    .viewer-box { background: #fff; border-radius: 12px; width: 100%; max-width: min(1100px, 96vw); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; }
    .viewer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 0.9rem 1.1rem; border-bottom: 1px solid #e2e8f0; }
    .viewer-head strong { display: block; color: #1a202c; font-size: 1rem; }
    .viewer-meta { color: #718096; font-size: 0.78rem; }
    .viewer-close { white-space: nowrap; border: 1px solid #e2e8f0; background: #fff; color: #4a5568; border-radius: 8px; padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.8rem; font-family: inherit; }
    .viewer-close:hover { background: #f7fafc; }
    .viewer-body { flex: 1; min-height: 0; overflow: auto; background: #0b1020; display: flex; align-items: center; justify-content: center; }
    .viewer-body img { display: block; max-width: 100%; max-height: 74vh; object-fit: contain; }
    .viewer-body video, .viewer-body audio { max-width: 100%; }
    .viewer-body pre { width: 100%; margin: 0; padding: 1rem 1.2rem; color: #e2e8f0; font-size: 0.78rem; line-height: 1.6; white-space: pre; overflow: auto; }
    .viewer-note { padding: 2rem; color: #94a3b8; font-size: 0.85rem; }
    .viewer-foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.65rem 1.1rem; border-top: 1px solid #e2e8f0; font-size: 0.78rem; }
    .viewer-foot code { color: #718096; }
    .viewer-foot a { color: #667eea; text-decoration: none; }
    .viewer-foot a:hover { text-decoration: underline; }
  `],
})
export class AssetsComponent implements OnInit {
  assets = signal<Asset[]>([]);
  kind = signal<'' | 'image' | 'dataset'>('');

  /** 应用内查看器当前展示的素材（null = 关闭）。 */
  preview = signal<Asset | null>(null);
  /** 数据集（CSV）的文本内容。 */
  previewText = signal('');
  /** 读取数据集失败时的提示。 */
  previewNote = signal('');

  filtered = computed<Asset[]>(() => {
    const k = this.kind();
    const list = this.assets();
    return k ? list.filter((a) => a.kind === k) : list;
  });

  constructor(private api: ApiService, private http: HttpClient) {}

  ngOnInit(): void {
    this.api.getAssets().subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.assets.set(resp.data);
        }
      },
      error: () => {},
    });
  }

  /** 素材文件地址：生产同域 /phy-assets/...，开发经 serverBase 代理到 8080。 */
  fileUrl(a: Asset): string {
    return `${environment.serverBase}/phy-assets/${a.rel_path}`;
  }

  /**
   * 打开应用内查看器。
   *
   * 这里刻意不用 `<a target="_blank">`：桌面端（Wails）只有主窗口的请求会被
   * WebView2 的 WebResourceRequested 拦截并交给内嵌后端，`wails.localhost`
   * 这个域名在 WebView2 之外（系统默认浏览器、新弹出的窗口）根本无法解析，
   * 于是「查看原件」必然打不开。改为在同一个窗口内渲染，dev 与安装版行为一致。
   * 注意：素材的 `source_url` 是真正的外网 https 链接，用 target="_blank" 是对的。
   */
  open(a: Asset): void {
    this.preview.set(a);
    this.previewText.set('');
    this.previewNote.set('');
    if (a.kind !== 'dataset') {
      return;
    }
    const url = this.fileUrl(a);
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (text) => this.previewText.set(text),
      error: () => this.previewNote.set(`读取失败：${url}`),
    });
  }

  close(): void {
    this.preview.set(null);
    this.previewText.set('');
    this.previewNote.set('');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.preview()) {
      this.close();
    }
  }

  certaintyLabel(c: string): string {
    const map: Record<string, string> = {
      observed: '已观测', 'theory-supported': '理论支持', 'math-predicted': '数学预言',
      philosophical: '哲学猜想', 'sci-fi': '科幻想象',
    };
    return map[c] ?? c;
  }
}
