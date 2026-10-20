import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { SlicePipe, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Experiment, Category, Theme, Milestone } from '../../core/services/api.service';

/** 年级（难度）筛选项。 */
interface LevelOption {
  value: string;
  label: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule, SlicePipe, NgIf, NgFor],
  template: `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-content">
          <h1>探索物理之美</h1>
          <p>真实锚点 · 尺度穿越 · 抽象可视化 · 未知敬畏 —— 从通识到科研级的物理知识全谱</p>
          <div class="search-box">
            <input type="text" [(ngModel)]="searchQuery" (keyup.enter)="search()" placeholder="搜索展项、定律、物理学家..." class="search-input" />
            <button (click)="search()" class="btn-search">搜索</button>
          </div>
          <div class="hero-links">
            <a routerLink="/scale" class="hero-link">🧭 尺度穿越</a>
            <a routerLink="/milestones" class="hero-link">⏳ 改变历史的物理 · 时间线</a>
            <a routerLink="/figures" class="hero-link">⚛ 物理学家</a>
          </div>
        </div>
      </section>

      <!-- 板块展廊（10 大知识板块） -->
      <section class="theme-block" *ngIf="themes().length">
        <div class="filter-label theme-label">板块</div>
        <div class="theme-grid">
          <button class="theme-card" [class.active]="!selectedTheme" (click)="selectTheme(null)">
            <span class="theme-name">全部板块</span>
            <span class="theme-desc">浏览全部物理展项</span>
          </button>
          <button *ngFor="let th of themes()" class="theme-card" [class.active]="selectedTheme === th.slug" (click)="selectTheme(th.slug)">
            <span class="theme-name">{{ th.name }}</span>
            <span class="theme-desc">{{ th.description }}</span>
          </button>
        </div>
      </section>

      <!-- 改变历史的物理：重点里程碑（FR-14） -->
      <section class="milestone-block" *ngIf="featuredMilestones().length">
        <div class="block-head">
          <h2>改变历史的物理</h2>
          <a routerLink="/milestones" class="more-link">完整时间线 →</a>
        </div>
        <div class="milestone-strip">
          <a *ngFor="let m of featuredMilestones()" class="ms-card" [routerLink]="['/milestones', m.slug]">
            <span class="ms-kind kind-{{ m.kind }}">{{ kindLabel(m.kind) }}</span>
            <span class="ms-year">{{ formatYear(m.year) }}</span>
            <h4>{{ m.title }}</h4>
            <p>{{ m.impact | slice:0:52 }}…</p>
          </a>
        </div>
      </section>

      <!-- 年级（难度）筛选 -->
      <section class="filter-block">
        <div class="filter-label">年级</div>
        <div class="filter-row">
          <button class="chip" [class.active]="!selectedDifficulty" (click)="selectDifficulty('')">全部年级</button>
          <button *ngFor="let lv of levels"
                  class="chip"
                  [class.active]="selectedDifficulty === lv.value"
                  [style.border-color]="selectedDifficulty === lv.value ? lv.color : null"
                  [style.background]="selectedDifficulty === lv.value ? lv.color : null"
                  (click)="selectDifficulty(lv.value)">
            {{ lv.label }}
          </button>
        </div>
      </section>

      <!-- 分类筛选 -->
      <section class="filter-block">
        <div class="filter-label">分类</div>
        <div class="filter-row">
          <button class="chip" [class.active]="!selectedCategory" (click)="selectCategory(null)">全部分类</button>
          <button *ngFor="let cat of categories()"
                  class="chip"
                  [class.active]="selectedCategory === cat.slug"
                  (click)="selectCategory(cat.slug)">
            {{ cat.name }}
          </button>
        </div>
      </section>

      <!-- 结果统计 -->
      <div class="result-bar">
        <span class="result-count">
          共 {{ total }} 个实验
          <span class="result-filter" *ngIf="activeFilterText()">· 当前筛选：{{ activeFilterText() }}</span>
        </span>
        <span class="result-page-size">
          每页
          <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()" class="size-select">
            <option *ngFor="let s of pageSizeOptions" [ngValue]="s">{{ s }} 条</option>
          </select>
        </span>
      </div>

      <!-- Experiment Grid -->
      <section class="experiment-grid">
        <div *ngFor="let exp of experiments()" class="exp-card" (click)="goToExperiment(exp.slug)">
          <div class="exp-thumb" [style.background]="getThumbColor(exp.difficulty)">
            <span class="exp-icon">{{ getIcon(exp.slug) }}</span>
          </div>
          <div class="exp-info">
            <div class="exp-meta">
              <span class="badge badge-{{ exp.difficulty }}">{{ exp.level }}</span>
              <span class="exp-category">{{ getCategoryName(exp.category_id) }}</span>
            </div>
            <h3>{{ exp.title }}</h3>
            <p class="exp-desc">{{ exp.description | slice:0:100 }}{{ exp.description.length > 100 ? '...' : '' }}</p>
          </div>
        </div>

        <div *ngIf="experiments().length === 0 && !loading()" class="empty-state">
          <p>{{ searchQuery ? '未找到相关实验' : '暂无实验，敬请期待...' }}</p>
        </div>
      </section>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages() > 1 || total > 0">
        <button (click)="goToPage(1)" [disabled]="page === 1" class="btn-page" title="首页">«</button>
        <button (click)="goToPage(page - 1)" [disabled]="page === 1" class="btn-page">上一页</button>

        <button *ngFor="let p of pageNumbers()"
                class="btn-page"
                [class.page-active]="p === page"
                (click)="goToPage(p)">{{ p }}</button>

        <button (click)="goToPage(page + 1)" [disabled]="page >= totalPages()" class="btn-page">下一页</button>
        <button (click)="goToPage(totalPages())" [disabled]="page >= totalPages()" class="btn-page" title="末页">»</button>

        <span class="page-jump">
          跳至
          <input type="number" min="1" [max]="totalPages()" [(ngModel)]="jumpPage"
                 (keyup.enter)="goToPage(jumpPage)" class="jump-input" />
          页
          <button (click)="goToPage(jumpPage)" class="btn-page">跳转</button>
        </span>

        <span class="page-info">第 {{ page }} / {{ totalPages() }} 页</span>
      </div>
    </div>
  `,
  styles: [`
    .home-page { max-width: 1400px; margin: 0 auto; }
    .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 3.5rem 2rem; text-align: center; border-radius: 16px;
      margin-bottom: 1.5rem;
    }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.125rem; opacity: 0.9; margin-bottom: 2rem; }
    .search-box { display: flex; max-width: 500px; margin: 0 auto; }
    .search-input { flex: 1; padding: 0.75rem 1rem; border: none; border-radius: 8px 0 0 8px; font-size: 1rem; }
    .btn-search { padding: 0.75rem 1.5rem; background: #4a5568; color: white; border: none; border-radius: 0 8px 8px 0; cursor: pointer; font-size: 1rem; }

    .hero-links { display: flex; justify-content: center; gap: 1rem; margin-top: 1.4rem; flex-wrap: wrap; }
    .hero-link { color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.35); padding: 0.45rem 1rem; border-radius: 20px; text-decoration: none; font-size: 0.9rem; transition: background 0.2s; }
    .hero-link:hover { background: rgba(255,255,255,0.3); }

    .theme-block { display: flex; gap: 0.75rem; margin: 1.4rem 0 1rem; align-items: flex-start; }
    .theme-label { padding-top: 0.6rem; }
    .theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.6rem; flex: 1; }
    .theme-card { text-align: left; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.7rem 0.8rem; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; gap: 0.25rem; }
    .theme-card:hover { border-color: #a3bffa; box-shadow: 0 4px 12px rgba(102,126,234,0.15); }
    .theme-card.active { border-color: #667eea; background: #ebf4ff; }
    .theme-card .theme-name { font-weight: 600; font-size: 0.88rem; color: #2d3748; }
    .theme-card .theme-desc { font-size: 0.72rem; color: #a0aec0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .milestone-block { margin: 1.6rem 0 1.2rem; }
    .block-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.8rem; }
    .block-head h2 { font-size: 1.25rem; color: #1a202c; }
    .block-head h2::before { content: '⏳ '; }
    .more-link { font-size: 0.85rem; color: #667eea; text-decoration: none; }
    .more-link:hover { text-decoration: underline; }
    .milestone-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.8rem; }
    .ms-card { display: block; background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%); border: 1px solid #334155; border-radius: 10px; padding: 0.85rem 0.9rem; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
    .ms-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(15,23,42,0.35); }
    .ms-card .ms-kind { display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 4px; margin-right: 0.4rem; font-weight: 600; }
    .kind-law { background: #667eea; color: #fff; }
    .kind-formula { background: #38b2ac; color: #fff; }
    .kind-invention { background: #ed8936; color: #fff; }
    .kind-experiment { background: #48bb78; color: #fff; }
    .ms-card .ms-year { font-size: 0.75rem; color: #94a3b8; }
    .ms-card h4 { color: #f1f5f9; font-size: 0.95rem; margin: 0.45rem 0 0.3rem; }
    .ms-card p { color: #94a3b8; font-size: 0.75rem; line-height: 1.5; margin: 0; }
    .badge-research { background: #fed7e2; color: #70245e; }

    .filter-block { display: flex; gap: 0.75rem; margin-bottom: 0.9rem; align-items: flex-start; }
    .filter-label { flex: 0 0 44px; padding-top: 0.45rem; font-size: 0.82rem; color: #718096; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 0.5rem; flex: 1; }
    .chip { padding: 0.42rem 0.9rem; border: 1px solid #e2e8f0; background: white; color: #4a5568; border-radius: 18px; cursor: pointer; font-size: 0.82rem; transition: all 0.15s; }
    .chip:hover { border-color: #a3bffa; color: #4c51bf; }
    .chip.active { background: #667eea; border-color: #667eea; color: #fff; font-weight: 600; }

    .result-bar { display: flex; align-items: center; justify-content: space-between; margin: 1.25rem 0 1rem; font-size: 0.85rem; color: #718096; }
    .result-filter { color: #667eea; margin-left: 0.4rem; }
    .size-select { padding: 0.3rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.82rem; margin-left: 0.3rem; }

    .experiment-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .exp-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
    .exp-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
    .exp-thumb { height: 140px; display: flex; align-items: center; justify-content: center; font-size: 3rem; }
    .exp-info { padding: 1rem; }
    .exp-meta { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    .badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
    .badge-basic { background: #c6f6d5; color: #22543d; }
    .badge-intro { background: #bee3f8; color: #2a4365; }
    .badge-intermediate { background: #feebc8; color: #7b341e; }
    .badge-advanced { background: #fed7d7; color: #742a2a; }
    .badge-professional { background: #e9d8fd; color: #44337a; }
    .exp-category { font-size: 0.75rem; color: #718096; }
    .exp-info h3 { font-size: 1rem; margin-bottom: 0.5rem; color: #1a202c; }
    .exp-desc { font-size: 0.875rem; color: #718096; line-height: 1.5; }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 4rem; color: #a0aec0; }

    .pagination { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.4rem; padding: 1.5rem 0 3rem; }
    .btn-page { min-width: 38px; padding: 0.45rem 0.7rem; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: #4a5568; }
    .btn-page:hover:not(:disabled) { border-color: #667eea; color: #667eea; }
    .btn-page:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-page.page-active { background: #667eea; border-color: #667eea; color: #fff; font-weight: 600; }
    .page-jump { display: flex; align-items: center; gap: 0.35rem; margin-left: 0.6rem; font-size: 0.85rem; color: #718096; }
    .jump-input { width: 64px; padding: 0.4rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem; text-align: center; }
    .page-info { margin-left: 0.6rem; font-size: 0.85rem; color: #718096; }
  `]
})
export class HomeComponent implements OnInit {
  experiments = signal<Experiment[]>([]);
  categories = signal<Category[]>([]);
  themes = signal<Theme[]>([]);
  featuredMilestones = signal<Milestone[]>([]);
  selectedTheme: string | null = null;
  loading = signal(false);

  page = 1;
  /** 默认每页 8 条。 */
  pageSize = 8;
  readonly pageSizeOptions = [8, 12, 24, 48];
  total = 0;
  jumpPage = 1;

  searchQuery = '';
  selectedCategory: string | null = null;
  selectedDifficulty = '';

  /** 分类接口就绪后才应用 URL 参数（按分类 slug 筛选需先能查到对应 id） */
  private categoriesReady = false;
  /** 最近一次的 URL 查询参数 */
  private pendingQuery: Params | null = null;
  /** 是否正在把筛选写回 URL（用于忽略由本组件自己触发的参数回调） */
  private urlSyncing = false;

  /** 六个难度等级（与后端 difficulty 字段一致，见《架构设计》§4.1）。 */
  readonly levels: LevelOption[] = [
    { value: 'basic', label: '通识·小学', color: '#48bb78' },
    { value: 'intro', label: '中学', color: '#4299e1' },
    { value: 'intermediate', label: '本科基础', color: '#ed8936' },
    { value: 'advanced', label: '本科高年级', color: '#f56565' },
    { value: 'professional', label: '研究生', color: '#9f7aea' },
    { value: 'research', label: '科研·学术级', color: '#d53f8c' },
  ];

  constructor(private api: ApiService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // 先取分类：列表要显示分类名，按分类筛选也要先能查到对应 id
    this.loadCategories(() => {
      this.categoriesReady = true;
      this.syncFromUrl();
    });
    // 板块展廊与重点里程碑（加载失败不影响列表）
    this.loadThemes();
    this.loadFeaturedMilestones();

    // 响应 URL 筛选参数（例如从实验详情页的面包屑点回「大学」）
    this.route.queryParams.subscribe((params) => {
      this.pendingQuery = params;
      if (!this.categoriesReady || this.urlSyncing) {
        return;
      }
      this.syncFromUrl();
    });
  }

  /** 按当前筛选条件加载实验列表（分类与年级都传给后端）。 */
  loadExperiments(): void {
    this.loading.set(true);
    const categoryId = this.currentCategoryId();
    const difficulty = this.selectedDifficulty || undefined;
    this.api.getExperiments(this.page, this.pageSize, categoryId, difficulty, this.selectedTheme ?? undefined).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.experiments.set(resp.data.experiments || []);
          this.total = resp.data.total || 0;
          this.jumpPage = this.page;
        }
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  /** 加载分类列表：直接调用 /api/v1/categories（后端已按 order_index 排好序）。 */
  loadCategories(onDone?: () => void): void {
    this.api.getCategories().subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.categories.set(resp.data);
        }
        onDone?.();
      },
      error: () => {
        /* 分类加载失败不影响实验列表本身 */
        onDone?.();
      },
    });
  }

  /** 加载 10 大知识板块（板块展廊）。 */
  loadThemes(): void {
    this.api.getThemes().subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.themes.set(resp.data);
        }
      },
      error: () => {},
    });
  }

  /** 首页重点里程碑（首页取前 8 条，完整列表在时间线页）。 */
  loadFeaturedMilestones(): void {
    this.api.getMilestones({ pageSize: 8 }).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.featuredMilestones.set(resp.data.milestones?.slice(0, 8) ?? []);
        }
      },
      error: () => {},
    });
  }

  /** 应用 URL 查询参数到筛选状态，然后加载列表。 */
  private syncFromUrl(): void {
    const params = this.pendingQuery ?? {};
    const difficulty = typeof params['difficulty'] === 'string' ? params['difficulty'] : '';
    const category = typeof params['category'] === 'string' ? params['category'] : null;
    const theme = typeof params['theme'] === 'string' ? params['theme'] : null;
    const page = Number(params['page']) || 1;
    const pageSize = Number(params['pageSize']);

    const unchanged = difficulty === this.selectedDifficulty && category === this.selectedCategory && theme === this.selectedTheme;
    this.selectedDifficulty = difficulty;
    this.selectedCategory = category;
    this.selectedTheme = theme;
    this.page = page;
    if (pageSize > 0) {
      this.pageSize = pageSize;
    }
    if (unchanged && this.experiments().length > 0) {
      return; // 筛选未变化，避免重复请求
    }
    this.loadExperiments();
  }

  /** 把当前筛选写回 URL（replace 方式，避免历史堆积），刷新后仍能保持筛选。 */
  private updateUrl(): void {
    const queryParams: Record<string, string | null> = {
      difficulty: this.selectedDifficulty || null,
      category: this.selectedCategory,
      theme: this.selectedTheme,
      page: this.page > 1 ? String(this.page) : null,
      pageSize: this.pageSize !== 8 ? String(this.pageSize) : null,
    };
    this.urlSyncing = true;
    void this.router
      .navigate([], { relativeTo: this.route, queryParams, replaceUrl: true })
      .finally(() => {
        this.urlSyncing = false;
      });
  }

  search(): void {
    if (!this.searchQuery.trim()) {
      this.selectedCategory = null;
      this.selectedDifficulty = '';
      this.page = 1;
      this.updateUrl();
      this.loadExperiments();
      return;
    }
    // 搜索接口不支持与筛选组合，搜索时清空筛选以免条件互相干扰
    this.selectedCategory = null;
    this.selectedDifficulty = '';
    this.updateUrl();
    this.loading.set(true);
    this.api.searchExperiments(this.searchQuery, this.page).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          this.experiments.set(resp.data.experiments || []);
          this.total = resp.data.total || 0;
        }
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  selectCategory(slug: string | null): void {
    this.selectedCategory = slug;
    this.searchQuery = '';
    this.page = 1;
    this.updateUrl();
    this.loadExperiments();
  }

  selectDifficulty(value: string): void {
    this.selectedDifficulty = value;
    this.searchQuery = '';
    this.page = 1;
    this.updateUrl();
    this.loadExperiments();
  }

  /** 按板块筛选（与分类筛选互斥，避免条件叠加出空列表）。 */
  selectTheme(slug: string | null): void {
    this.selectedTheme = slug;
    this.selectedCategory = null;
    this.searchQuery = '';
    this.page = 1;
    this.updateUrl();
    this.loadExperiments();
  }

  /** 里程碑类型标签（时间线/首页卡片）。 */
  kindLabel(kind: string): string {
    const map: Record<string, string> = { law: '定律', formula: '公式', invention: '发明', experiment: '关键实验' };
    return map[kind] ?? kind;
  }

  /** 年份展示：公元前用负数。 */
  formatYear(year: number): string {
    if (year < 0) return `公元前 ${-year} 年`;
    return `${year} 年`;
  }

  onPageSizeChange(): void {
    this.page = 1;
    this.updateUrl();
    this.loadExperiments();
  }

  goToPage(target: number): void {
    const max = this.totalPages();
    const p = Math.max(1, Math.min(max, Math.floor(Number(target)) || 1));
    if (p === this.page) {
      this.jumpPage = p;
      return;
    }
    this.page = p;
    this.updateUrl();
    this.loadExperiments();
  }

  /** 当前筛选条件的文字描述（用于结果栏提示）。 */
  activeFilterText(): string {
    const parts: string[] = [];
    if (this.selectedDifficulty) {
      parts.push(this.levels.find((l) => l.value === this.selectedDifficulty)?.label ?? '');
    }
    if (this.selectedCategory) {
      parts.push(this.categories().find((c) => c.slug === this.selectedCategory)?.name ?? '');
    }
    return parts.filter(Boolean).join(' · ');
  }

  /** 分页器显示的页码（当前页附近若干页）。 */
  pageNumbers(): number[] {
    const totalP = this.totalPages();
    if (totalP <= 1) return totalP === 1 ? [1] : [];
    const span = 2;
    const start = Math.max(1, Math.min(this.page - span, totalP - span * 2));
    const end = Math.min(totalP, Math.max(start + span * 2, span * 2 + 1));
    const out: number[] = [];
    for (let i = start; i <= end && i <= totalP; i++) out.push(i);
    return out;
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  goToExperiment(slug: string): void {
    void this.router.navigate(['/experiment', slug]);
  }

  /** 当前选中分类对应的 id（用于后端筛选）。 */
  private currentCategoryId(): number | undefined {
    if (!this.selectedCategory) return undefined;
    return this.categories().find((c) => c.slug === this.selectedCategory)?.id;
  }

  getThumbColor(difficulty: string): string {
    const colors: Record<string, string> = {
      basic: 'linear-gradient(135deg, #48bb78, #38a169)',
      intro: 'linear-gradient(135deg, #4299e1, #3182ce)',
      intermediate: 'linear-gradient(135deg, #ed8936, #dd6b20)',
      advanced: 'linear-gradient(135deg, #f56565, #e53e3e)',
      professional: 'linear-gradient(135deg, #9f7aea, #805ad5)',
    };
    return colors[difficulty] || '#4a5568';
  }

  getIcon(slug: string): string {
    const icons: Record<string, string> = {
      'projectile-motion': '🎯', 'simple-pendulum': '🕰️', 'spring-oscillator': '🌀',
      'elastic-collision': '💥', 'damped-oscillation': '〰️', 'catenary': '🌉',
      'brachistochrone': '🛝', 'time-dilation': '⏳', 'wave-superposition': '🌊',
      'double-slit': '🔦', 'vibrating-string': '🎸', 'lens-refraction': '🔍',
      'electric-field': '⚡', 'magnetic-field': '🧲', 'carnot-cycle': '♨️',
      'maxwell-boltzmann': '📊', 'kepler-orbit': '🪐', 'three-body': '🌑',
      'nbody-simulation': '🌌', 'atomic-levels': '💥', 'de-broglie-wave': '🎩',
      'radioactive-decay': '☢️', 'mandelbrot': '🌀', 'calculus': '∫',
    };
    return icons[slug] || '⚛';
  }

  getCategoryName(categoryId: number): string {
    const cat = this.categories().find((c) => c.id === categoryId);
    return cat ? cat.name : '未分类';
  }
}
