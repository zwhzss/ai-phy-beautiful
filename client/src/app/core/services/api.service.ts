import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
}

export interface Paginated<T> {
  experiments?: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  level: string;
  order_index: number;
  description?: string;
  theme_id?: number;
}

/** 知识板块（themes → categories → experiments 三级） */
export interface Theme {
  id: number;
  slug: string;
  name: string;
  description?: string;
  order_index: number;
}

/** 尺度轴锚点（FR-2） */
export interface ScaleNode {
  id: number;
  axis: 'length' | 'time' | 'speed';
  slug: string;
  name: string;
  scale_value: number;
  description?: string;
  thumbnail?: string;
  order_index: number;
}

/** 物理学家（FR-14） */
export interface Figure {
  id: number;
  slug: string;
  name: string;
  name_en?: string;
  born: number;
  died: number;
  nationality?: string;
  contribution: string;
  nobel?: string;
  bio?: string;
  portrait?: string;
  milestones?: Milestone[];
}

/** 素材资产元数据（FR-6；文件经 /assets/<rel_path> 静态访问） */
export interface Asset {
  id: number;
  slug: string;
  kind: 'image' | 'video' | 'audio' | 'dataset';
  title: string;
  description?: string;
  rel_path: string;
  source_org: string;
  source_url?: string;
  license: string;
  credit?: string;
  year?: number;
  certainty: string;
  scale_value?: number;
}

/** 里程碑：定律 / 公式 / 发明 / 关键实验（FR-14） */
export interface Milestone {
  id: number;
  slug: string;
  kind: 'law' | 'formula' | 'invention' | 'experiment';
  title: string;
  year: number;
  statement: string;
  latex?: string;
  meaning?: string;
  conditions?: string;
  impact: string;
  source_ref?: string;
  certainty: string;
  difficulty: string;
  level?: string;
  theme_id?: number;
  figures?: Figure[];
  experiments?: Experiment[];
}

export interface Formula {
  label: string;
  latex: string;
}

export interface HistoryInfo {
  mathematician?: string;
  background?: string;
  story?: string;
}

export interface AppHook {
  title: string;
  desc: string;
}

export interface Experiment {
  id: number;
  slug: string;
  title: string;
  number?: string;
  concept?: string;
  category_id: number;
  category?: Category;
  difficulty: string;
  level: string;
  description: string;
  thumbnail?: string;
  params_schema?: any;
  viz_component: string;
  formulas?: any;
  /** AI 生成的图形描述（JSON，2D 图元或 3D 曲面） */
  graph?: any;
  history_info?: any;
  app_hooks?: any;
  prerequisites?: any;
  related_experiments?: any;
  content_status?: string;
  content_error?: string;
  generated_at?: string;
  created_at?: string;
  /** 五级确定性标签（observed / theory-supported / math-predicted / philosophical / sci-fi） */
  certainty?: string;
  /** 审核状态机（draft / advisor-review / asset-ready / render-ready / published） */
  review_status?: string;
  /** 当前生效的内容版本来源：seed | ai（后端按当前生效版本填充，不落库） */
  content_source?: string;
}

export interface Narration {
  ID?: number;
  id: number;
  experiment_id: number;
  section_id: string;
  section_title?: string;
  line_index: number;
  line_id: string;
  text: string;
  audio_yunxi: string;
  audio_xiaoxiao: string;
  duration_ms: number;
  animation_cfg?: any;
}

/** 讲解稿件中的一行（服务端已把音频路径补全为绝对地址） */
export interface ScriptLine {
  id: number;
  section_id: string;
  line_id: string;
  line_index: number;
  text: string;
  audio_yunxi: string;
  audio_xiaoxiao: string;
  duration_ms: number;
  animation: { action?: string; params?: Record<string, any>; delay?: number };
}

/** 里程碑讲解稿件（顶层键 milestone_id，其余同 NarrationScript） */
export interface MilestoneScript {
  milestone_id: number;
  slug: string;
  title: string;
  total_lines: number;
  total_duration_ms: number;
  has_audio: boolean;
  sections: ScriptSection[];
}

export interface ScriptSection {
  id: string;
  title: string;
  lines: ScriptLine[];
}

export interface NarrationScript {
  experiment_id: number;
  slug: string;
  title: string;
  total_lines: number;
  total_duration_ms: number;
  has_audio: boolean;
  sections: ScriptSection[];
}

export interface UserProgress {
  id: number;
  user_id: number;
  experiment_id: number;
  completed: boolean;
  current_line: number;
  duration_sec: number;
  last_access: string;
  /** 关联实验（列表接口返回，用于显示标题/分类与跳转） */
  experiment?: Experiment;
}

export interface Bookmark {
  id: number;
  user_id: number;
  experiment_id: number;
  created_at: string;
  /** 关联实验（列表接口返回，用于显示标题/分类与跳转） */
  experiment?: Experiment;
}

export interface AuthResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  token: string;
}

export type ModelType = 'llm' | 'tts' | 'asr' | 'image';

export interface AiModel {
  id: number;
  name: string;
  model_type: ModelType;
  provider: string;
  base_url: string;
  model_name: string;
  voice: string;
  region: string;
  extra_config: string;
  is_active: boolean;
  has_api_key: boolean;
  api_key_masked: string;
  last_test_at?: string;
  last_test_ok: boolean;
  last_test_msg: string;
  created_at?: string;
  updated_at?: string;
}

export interface AiModelStats {
  counts: Record<string, number>;
  active: Record<string, AiModel | null>;
  supported_types: ModelType[];
  edge_tts_available: boolean;
  edge_tts_hint: string;
}

export interface AdminStats {
  experiments: number;
  categories: number;
  users: number;
  narrations: number;
  ai_models: number;
  content_status: Record<string, number>;
  by_difficulty: Record<string, number>;
  audio_lines_yunxi: number;
  audio_lines_xiaoxiao: number;
}

export interface ContentOverview {
  content_status: Record<string, number>;
  difficulty: Record<string, number>;
  audio_lines_yunxi: number;
  audio_lines_xiaoxiao: number;
  voices: string[];
  edge_tts_available: boolean;
  edge_tts_hint: string;
}

export interface GenerateResult {
  experiment_id: number;
  slug: string;
  title: string;
  status: string;
  sections: number;
  lines: number;
  formulas: number;
  app_hooks: number;
  message?: string;
  /** 生成成功但存在问题时的提示，例如图形没有与参数联动 */
  warning?: string;
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: GenerateResult[];
}

export interface SynthResult {
  experiment_id: number;
  voice: string;
  synthesized: number;
  skipped: number;
  failed: number;
  total_duration_ms: number;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiBase;

  constructor(private http: HttpClient) {}

  // ==================== 实验与分类 ====================

  getExperiments(page = 1, pageSize = 20, categoryId?: number, difficulty?: string, theme?: string): Observable<ApiResponse<Paginated<Experiment>>> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (categoryId) params = params.set('category_id', String(categoryId));
    if (difficulty) params = params.set('difficulty', difficulty);
    if (theme) params = params.set('theme', theme);
    return this.http.get<ApiResponse<Paginated<Experiment>>>(`${this.baseUrl}/experiments`, { params });
  }

  getExperimentBySlug(slug: string): Observable<ApiResponse<Experiment>> {
    return this.http.get<ApiResponse<Experiment>>(`${this.baseUrl}/experiments/${slug}`);
  }

  searchExperiments(query: string, page = 1): Observable<ApiResponse<Paginated<Experiment>>> {
    return this.http.get<ApiResponse<Paginated<Experiment>>>(`${this.baseUrl}/experiments/search`, {
      params: { q: query, page: String(page) }
    });
  }

  getCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories`);
  }

  getExperimentsByCategory(categorySlug: string): Observable<ApiResponse<Experiment[]>> {
    return this.http.get<ApiResponse<Experiment[]>>(`${this.baseUrl}/categories/${categorySlug}/experiments`);
  }

  // ==================== 物理之美：板块 / 尺度轴 / 里程碑 / 物理学家 ====================

  getThemes(): Observable<ApiResponse<Theme[]>> {
    return this.http.get<ApiResponse<Theme[]>>(`${this.baseUrl}/themes`);
  }

  getScaleNodes(axis?: 'length' | 'time' | 'speed'): Observable<ApiResponse<ScaleNode[]>> {
    let params = new HttpParams();
    if (axis) params = params.set('axis', axis);
    return this.http.get<ApiResponse<ScaleNode[]>>(`${this.baseUrl}/scale`, { params });
  }

  getMilestones(opts: { kind?: string; theme?: string; q?: string; page?: number; pageSize?: number } = {}): Observable<ApiResponse<{ milestones: Milestone[]; total: number; page: number; pageSize: number }>> {
    let params = new HttpParams().set('page', String(opts.page ?? 1)).set('pageSize', String(opts.pageSize ?? 100));
    if (opts.kind) params = params.set('kind', opts.kind);
    if (opts.theme) params = params.set('theme', opts.theme);
    if (opts.q) params = params.set('q', opts.q);
    return this.http.get<ApiResponse<{ milestones: Milestone[]; total: number; page: number; pageSize: number }>>(
      `${this.baseUrl}/milestones`, { params });
  }

  getMilestone(slug: string): Observable<ApiResponse<Milestone>> {
    return this.http.get<ApiResponse<Milestone>>(`${this.baseUrl}/milestones/${slug}`);
  }

  /** 里程碑讲解稿件（结构同展项 NarrationScript，音频为绝对地址） */
  getMilestoneScript(slug: string): Observable<ApiResponse<MilestoneScript>> {
    return this.http.get<ApiResponse<MilestoneScript>>(`${this.baseUrl}/milestones/${slug}/narrations`);
  }

  getFigures(q?: string): Observable<ApiResponse<Figure[]>> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<ApiResponse<Figure[]>>(`${this.baseUrl}/figures`, { params });
  }

  getFigure(slug: string): Observable<ApiResponse<Figure>> {
    return this.http.get<ApiResponse<Figure>>(`${this.baseUrl}/figures/${slug}`);
  }

  // ==================== 物理之美：素材资产 ====================

  getAssets(kind?: string, q?: string): Observable<ApiResponse<Asset[]>> {
    let params = new HttpParams();
    if (kind) params = params.set('kind', kind);
    if (q) params = params.set('q', q);
    return this.http.get<ApiResponse<Asset[]>>(`${this.baseUrl}/assets`, { params });
  }

  getAsset(slug: string): Observable<ApiResponse<Asset>> {
    return this.http.get<ApiResponse<Asset>>(`${this.baseUrl}/assets/${slug}`);
  }

  // ==================== 讲解 ====================

  getNarrations(experimentId: number): Observable<ApiResponse<Narration[]>> {
    return this.http.get<ApiResponse<Narration[]>>(`${this.baseUrl}/narrations/${experimentId}`);
  }

  /** 获取按段落组织的讲解稿件（含可直接播放的绝对音频地址） */
  getScript(slug: string): Observable<ApiResponse<NarrationScript>> {
    return this.http.get<ApiResponse<NarrationScript>>(`${this.baseUrl}/experiments/${slug}/narrations`);
  }

  getAudioPath(experimentId: number, lineId: string, voice = 'yunxi'): Observable<ApiResponse<{ audio_path: string; audio_url: string; text: string; duration_ms: number }>> {
    return this.http.get<ApiResponse<{ audio_path: string; audio_url: string; text: string; duration_ms: number }>>(
      `${this.baseUrl}/narrations/${experimentId}/${lineId}/audio`,
      { params: { voice } }
    );
  }

  // ==================== 学习进度 ====================

  getProgress(experimentId: number): Observable<ApiResponse<UserProgress>> {
    return this.http.get<ApiResponse<UserProgress>>(`${this.baseUrl}/progress/${experimentId}`);
  }

  updateProgress(experimentId: number, data: { line_index: number; duration_sec: number; completed: boolean }): Observable<ApiResponse<UserProgress>> {
    return this.http.put<ApiResponse<UserProgress>>(`${this.baseUrl}/progress/${experimentId}`, data);
  }

  /** 记录一次学习访问（进入实验详情页时调用；幂等，不会清除已完成状态）。 */
  touchProgress(experimentId: number): Observable<ApiResponse<UserProgress>> {
    return this.http.post<ApiResponse<UserProgress>>(`${this.baseUrl}/progress/${experimentId}/touch`, {});
  }

  getUserProgress(): Observable<ApiResponse<UserProgress[]>> {
    return this.http.get<ApiResponse<UserProgress[]>>(`${this.baseUrl}/progress`);
  }

  // ==================== 收藏 ====================

  getBookmarks(): Observable<ApiResponse<Bookmark[]>> {
    return this.http.get<ApiResponse<Bookmark[]>>(`${this.baseUrl}/bookmarks`);
  }

  addBookmark(experimentId: number): Observable<ApiResponse<Bookmark>> {
    return this.http.post<ApiResponse<Bookmark>>(`${this.baseUrl}/bookmarks/${experimentId}`, {});
  }

  removeBookmark(experimentId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/bookmarks/${experimentId}`);
  }

  isBookmarked(experimentId: number): Observable<ApiResponse<{ exists: boolean }>> {
    return this.http.get<ApiResponse<{ exists: boolean }>>(`${this.baseUrl}/bookmarks/${experimentId}/exists`);
  }

  // ==================== 认证 ====================

  register(username: string, email: string, password: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/auth/register`, { username, email, password });
  }

  login(username: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/auth/login`, { username, password });
  }

  getCurrentUser(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/auth/me`);
  }

  // ==================== 管理后台：概览 ====================

  getAdminStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(`${this.baseUrl}/admin/stats`);
  }

  getContentOverview(): Observable<ApiResponse<ContentOverview>> {
    return this.http.get<ApiResponse<ContentOverview>>(`${this.baseUrl}/admin/content/overview`);
  }

  // ==================== 管理后台：实验目录 ====================

  getAdminExperiments(options: {
    page?: number; pageSize?: number; difficulty?: string; contentStatus?: string; categoryId?: number; q?: string;
  } = {}): Observable<ApiResponse<Paginated<Experiment>>> {
    let params = new HttpParams()
      .set('page', String(options.page ?? 1))
      .set('pageSize', String(options.pageSize ?? 50));
    if (options.difficulty) params = params.set('difficulty', options.difficulty);
    if (options.contentStatus) params = params.set('content_status', options.contentStatus);
    if (options.categoryId) params = params.set('category_id', String(options.categoryId));
    if (options.q) params = params.set('q', options.q);
    return this.http.get<ApiResponse<Paginated<Experiment>>>(`${this.baseUrl}/admin/experiments`, { params });
  }

  getAdminCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/admin/categories`);
  }

  seedExperiments(): Observable<ApiResponse<{ categories: number; experiments_created: number; experiments_updated: number; total: number }>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/admin/seed-experiments`, {});
  }

  updateExperiment(id: number, data: Partial<Experiment>): Observable<ApiResponse<Experiment>> {
    return this.http.put<ApiResponse<Experiment>>(`${this.baseUrl}/admin/experiments/${id}`, data);
  }

  deleteExperiment(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/admin/experiments/${id}`);
  }

  // ==================== 管理后台：内容审核工作流（《架构设计》§9） ====================

  reviewExperiment(id: number, action: 'submit' | 'approve' | 'reject' | 'publish', comment = ''): Observable<ApiResponse<{ id: number; review_status: string }>> {
    return this.http.post<ApiResponse<{ id: number; review_status: string }>>(
      `${this.baseUrl}/admin/experiments/${id}/review`, { action, comment });
  }

  getExperimentReviews(id: number): Observable<ApiResponse<{ id: number; action: string; comment: string; created_at: string }[]>> {
    return this.http.get<ApiResponse<{ id: number; action: string; comment: string; created_at: string }[]>>(
      `${this.baseUrl}/admin/experiments/${id}/reviews`);
  }

  // ==================== 管理后台：AI 内容生产 ====================

  generateContent(experimentId: number): Observable<ApiResponse<GenerateResult>> {
    return this.http.post<ApiResponse<GenerateResult>>(`${this.baseUrl}/admin/experiments/${experimentId}/generate`, {});
  }

  generateContentBatch(limit: number, difficulty = '', includeReady = false): Observable<ApiResponse<BatchSummary>> {
    return this.http.post<ApiResponse<BatchSummary>>(`${this.baseUrl}/admin/experiments/generate-batch`, {
      limit, difficulty, include_ready: includeReady
    });
  }

  synthesizeNarrations(experimentId: number, voices: string[] = ['yunxi', 'xiaoxiao'], force = false): Observable<ApiResponse<SynthResult[]>> {
    return this.http.post<ApiResponse<SynthResult[]>>(
      `${this.baseUrl}/admin/experiments/${experimentId}/narrations/synthesize`, { voices, force });
  }

  synthesizeBatch(voice: string, limit: number, force = false): Observable<ApiResponse<SynthResult[]>> {
    return this.http.post<ApiResponse<SynthResult[]>>(`${this.baseUrl}/admin/narrations/synthesize-batch`, { voice, limit, force });
  }

  getAdminNarrations(experimentId: number): Observable<ApiResponse<Narration[]>> {
    return this.http.get<ApiResponse<Narration[]>>(`${this.baseUrl}/admin/experiments/${experimentId}/narrations`);
  }

  importNarrations(experimentId: number, lines: { section_id?: string; section_title?: string; line_id?: string; text: string }[], replace = true): Observable<ApiResponse<{ lines: number }>> {
    return this.http.post<ApiResponse<{ lines: number }>>(
      `${this.baseUrl}/admin/experiments/${experimentId}/narrations`, { replace, lines });
  }

  updateNarration(lineId: number, text: string, sectionId?: string): Observable<ApiResponse<Narration>> {
    return this.http.put<ApiResponse<Narration>>(`${this.baseUrl}/admin/narrations/${lineId}`, { text, section_id: sectionId ?? '' });
  }

  deleteNarration(lineId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/admin/narrations/${lineId}`);
  }

  // ==================== 管理后台：大模型配置 ====================

  getAiModels(type?: ModelType): Observable<ApiResponse<AiModel[]>> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    return this.http.get<ApiResponse<AiModel[]>>(`${this.baseUrl}/admin/ai-models`, { params });
  }

  getAiModelStats(): Observable<ApiResponse<AiModelStats>> {
    return this.http.get<ApiResponse<AiModelStats>>(`${this.baseUrl}/admin/ai-models/stats`);
  }

  createAiModel(payload: Partial<AiModel> & { api_key?: string }): Observable<ApiResponse<AiModel>> {
    return this.http.post<ApiResponse<AiModel>>(`${this.baseUrl}/admin/ai-models`, payload);
  }

  updateAiModel(id: number, payload: Partial<AiModel> & { api_key?: string }): Observable<ApiResponse<AiModel>> {
    return this.http.put<ApiResponse<AiModel>>(`${this.baseUrl}/admin/ai-models/${id}`, payload);
  }

  deleteAiModel(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/admin/ai-models/${id}`);
  }

  activateAiModel(id: number): Observable<ApiResponse<AiModel>> {
    return this.http.post<ApiResponse<AiModel>>(`${this.baseUrl}/admin/ai-models/${id}/activate`, {});
  }

  testAiModel(id: number): Observable<ApiResponse<{ detail: string }>> {
    return this.http.post<ApiResponse<{ detail: string }>>(`${this.baseUrl}/admin/ai-models/${id}/test`, {});
  }
}
