import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Bookmark } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="bookmarks-page">
      <h1>我的收藏</h1>
      <div class="bookmark-grid">
        <div *ngFor="let bm of bookmarks()" class="bookmark-card">
          <div class="bookmark-info">
            <h3>{{ getExperimentTitle(bm) }}</h3>
            <div class="bookmark-meta">
              <span *ngIf="bm.experiment?.category?.name" class="bookmark-cat">{{ bm.experiment!.category!.name }}</span>
              <span class="bookmark-date">收藏于 {{ formatDate(bm.created_at) }}</span>
            </div>
          </div>
          <div class="bookmark-actions">
            <a [routerLink]="['/experiment', getExperimentSlug(bm)]" class="btn btn-primary">学习</a>
            <button (click)="removeBookmark(bm)" class="btn btn-danger">删除</button>
          </div>
        </div>
        <div *ngIf="bookmarks().length === 0" class="empty-state">
          <p>{{ notice() || '还没有收藏任何实验' }}</p>
          <a routerLink="/" class="btn btn-primary">去探索</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bookmarks-page { max-width: 1000px; margin: 0 auto; }
    .bookmarks-page h1 { font-size: 1.75rem; margin-bottom: 1.5rem; }
    .bookmark-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .bookmark-card { background: white; padding: 1.25rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
    .bookmark-info { min-width: 0; }
    .bookmark-info h3 { font-size: 1rem; margin-bottom: 0.35rem; color: #2d3748; }
    .bookmark-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .bookmark-cat { font-size: 0.7rem; color: #667eea; background: #ebf4ff; padding: 0.1rem 0.45rem; border-radius: 8px; }
    .bookmark-date { font-size: 0.75rem; color: #a0aec0; }
    .bookmark-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 3rem; color: #a0aec0; }
    .empty-state p { margin-bottom: 1rem; }
  `]
})
export class BookmarksComponent implements OnInit {
  bookmarks = signal<Bookmark[]>([]);
  /** 未登录或加载失败时的提示文案 */
  notice = signal('');

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadBookmarks();
  }

  /** 从后端加载收藏列表（收藏表带 experiment 关联，可直接显示标题与分类）。 */
  loadBookmarks(): void {
    if (!this.auth.isLoggedIn()) {
      this.notice.set('请先登录后查看收藏');
      this.bookmarks.set([]);
      return;
    }
    this.notice.set('');
    this.api.getBookmarks().subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.bookmarks.set(resp.data);
        }
      },
      error: () => {
        this.notice.set('加载收藏失败，请稍后重试');
        this.bookmarks.set([]);
      },
    });
  }

  removeBookmark(bm: Bookmark): void {
    this.api.removeBookmark(bm.experiment_id).subscribe({
      next: () => {
        this.bookmarks.update((bs) => bs.filter((b) => b.id !== bm.id));
      },
    });
  }

  /** 实验标题：后端已预加载 experiment，缺失时回退显示编号。 */
  getExperimentTitle(bm: Bookmark): string {
    return bm.experiment?.title ?? `实验 #${bm.experiment_id}`;
  }

  /** 实验路由参数：前端路由按 slug 匹配（/experiment/:slug）。 */
  getExperimentSlug(bm: Bookmark): string {
    return bm.experiment?.slug ?? String(bm.experiment_id);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  }
}
