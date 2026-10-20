import { Component, OnInit, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AiModel, AiModelStats, ModelType } from '../../core/services/api.service';

/** 类型中文名。 */
const TYPE_LABEL: Record<ModelType, string> = {
  llm: 'LLM（大语言模型）',
  tts: 'TTS（语音合成）',
  asr: 'ASR（语音识别）',
  image: '图像（绘图/生成）',
};

/** 各类型可选的厂商。 */
const PROVIDERS: Record<ModelType, string[]> = {
  llm: ['openai', 'azure', 'ollama', 'custom'],
  tts: ['edge', 'azure', 'openai', 'custom'],
  asr: ['openai', 'azure', 'custom'],
  image: ['openai', 'azure', 'custom'],
};

/**
 * 常用平台预设：选平台自动填 BaseURL + 推荐模型，用户只需再填 API Key。
 *
 * 商用 TTS 最容易填错的就是 BaseURL —— 例如把硅基流动写成控制台域名
 * `https://cloud.siliconflow.cn`，请求会返回网页 HTML（HTTP 200），合成出来的"音频"
 * 其实是网页、根本播不出声。这里把 API 地址与推荐模型一次填对。
 */
const PLATFORM_PRESETS: Record<ModelType, { name: string; url: string; models: string[] }[]> = {
  llm: [
    { name: 'DeepSeek', url: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'] },
    { name: 'OpenAI', url: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o'] },
    { name: '智谱AI', url: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-plus'] },
    { name: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/api/v1', models: ['qwen-plus', 'qwen-turbo'] },
  ],
  tts: [
    { name: 'Edge TTS（免费本地）', url: 'edge://local', models: ['edge-tts'] },
    { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', models: ['FunAudioLLM/CosyVoice2-0.5B', 'fishaudio/fish-speech-1.5'] },
    { name: 'OpenAI', url: 'https://api.openai.com/v1', models: ['tts-1', 'tts-1-hd'] },
    { name: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/api/v1', models: ['cosyvoice-v1', 'sambert-zhichu-v1'] },
  ],
  asr: [
    { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', models: ['iic/SenseVoiceSmall', 'FunAudioLLM/SenseVoiceSmall'] },
    { name: 'OpenAI', url: 'https://api.openai.com/v1', models: ['whisper-1'] },
  ],
  image: [
    { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', models: ['Kwai-Kolors/Kolors', 'Qwen/Qwen-Image'] },
    { name: 'OpenAI', url: 'https://api.openai.com/v1', models: ['gpt-image-1', 'dall-e-3'] },
    { name: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/api/v1', models: ['wanx2.1-t2i-turbo'] },
    { name: '智谱AI', url: 'https://open.bigmodel.cn/api/paas/v4', models: ['cogview-3-flash'] },
  ],
};

/** 大模型配置表单。 */
interface ModelForm {
  id: number | null;
  name: string;
  model_type: ModelType;
  provider: string;
  base_url: string;
  api_key: string;
  model_name: string;
  voice: string;
  region: string;
  extra_config: string;
}

/**
 * 需求 5：在画面配置 AI 大模型（增加/编辑/删除/测试连接/激活）。
 * 同类型只能激活一个，由后端保证；此处提供界面与即时反馈。
 */
@Component({
  selector: 'ai-models-panel',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>大模型配置</h2>
        <button class="btn-primary" (click)="openCreate()">+ 新增大模型</button>
      </div>

      <!-- Edge TTS 内置能力提示 -->
      <div class="hint" *ngIf="stats()?.edge_tts_available">
        ✅ 已内置 Edge TTS（免密钥），可直接用于语音合成。
        <span class="hint-sub">{{ stats()?.edge_tts_hint }}</span>
      </div>
      <div class="hint hint-warn" *ngIf="stats() && !stats()!.edge_tts_available">
        ⚠ Edge TTS 不可用：{{ stats()?.edge_tts_hint }}
      </div>

      <div class="notice" *ngIf="message()">{{ message() }}</div>

      <!-- 按类型分组 -->
      <div class="group" *ngFor="let type of types">
        <div class="group-head">
          <span class="group-title">{{ typeLabel(type) }}</span>
          <span class="group-status" [class.on]="activeName(type)">
            {{ activeName(type) ? '已激活：' + activeName(type) : '未激活' }}
          </span>
          <span class="group-count">共 {{ countOf(type) }} 个</span>
        </div>

        <table class="tbl" *ngIf="modelsOf(type).length; else emptyType">
          <thead>
            <tr>
              <th>名称</th>
              <th>厂商</th>
              <th>模型 / 音色</th>
              <th>API 地址</th>
              <th>密钥</th>
              <th>状态</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of modelsOf(type)" [class.row-active]="m.is_active">
              <td>
                <strong>{{ m.name }}</strong>
              </td>
              <td>{{ m.provider || '—' }}</td>
              <td class="mono">{{ m.model_name || m.voice || '—' }}</td>
              <td class="mono ellipsis" [title]="m.base_url">{{ m.base_url || '—' }}</td>
              <td class="mono">{{ m.api_key_masked || '—' }}</td>
              <td>
                <span class="tag tag-on" *ngIf="m.is_active">已激活</span>
                <span class="tag" *ngIf="!m.is_active">未激活</span>
                <span class="tag tag-ok" *ngIf="m.last_test_ok">测试通过</span>
                <span class="tag tag-bad" *ngIf="m.last_test_at && !m.last_test_ok">测试失败</span>
              </td>
              <td class="col-actions">
                <button class="btn-xs" (click)="activate(m)" [disabled]="m.is_active || busy()">激活</button>
                <button class="btn-xs" (click)="test(m)" [disabled]="busy()">测试</button>
                <button class="btn-xs" (click)="openEdit(m)" [disabled]="busy()">编辑</button>
                <button class="btn-xs btn-danger" (click)="remove(m)" [disabled]="busy()">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #emptyType>
          <div class="empty">暂无该类型的模型配置</div>
        </ng-template>
      </div>

      <!-- 新增 / 编辑表单 -->
      <div class="modal-mask" *ngIf="form()" (click)="closeForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ form()!.id ? '编辑大模型' : '新增大模型' }}</h3>

          <label>
            类型
            <select [(ngModel)]="form()!.model_type" [disabled]="!!form()!.id">
              <option *ngFor="let t of types" [ngValue]="t">{{ typeLabel(t) }}</option>
            </select>
          </label>

          <label *ngIf="platformsFor(form()!.model_type).length">
            常用平台（一键填充）
            <select (change)="applyPlatform($any($event.target).value)">
              <option value="">— 选择平台自动填 BaseURL 与推荐模型，只需再填 API Key —</option>
              <option *ngFor="let p of platformsFor(form()!.model_type)" [value]="p.name">{{ p.name }}</option>
            </select>
          </label>

          <label>
            名称
            <input [(ngModel)]="form()!.name" placeholder="例如 本地 Ollama / Azure TTS" />
          </label>

          <label>
            厂商 / 协议
            <select [(ngModel)]="form()!.provider">
              <option *ngFor="let p of providersFor(form()!.model_type)" [value]="p">{{ p }}</option>
            </select>
          </label>

          <label>
            API 地址（base_url）
            <input [(ngModel)]="form()!.base_url" placeholder="例如 https://api.openai.com/v1" />
          </label>

          <label>
            API 密钥
            <input type="password" [(ngModel)]="form()!.api_key"
                   [placeholder]="form()!.id ? '留空表示不修改' : 'sk-...'" />
          </label>

          <label *ngIf="modelNameVisible()">
            模型名称
            <input [(ngModel)]="form()!.model_name" [placeholder]="modelNamePlaceholder()" />
          </label>

          <label *ngIf="form()!.model_type === 'tts'">
            默认音色（可空）
            <input [(ngModel)]="form()!.voice" [placeholder]="voicePlaceholder()" />
          </label>

          <label *ngIf="form()!.model_type === 'tts' || form()!.model_type === 'image'">
            区域 region（Azure 需要）
            <input [(ngModel)]="form()!.region" placeholder="例如 eastasia" />
          </label>

          <label>
            额外配置（JSON，可选）
            <textarea rows="2" [(ngModel)]="form()!.extra_config" placeholder='{"max_tokens": 8192}'></textarea>
          </label>

          <div class="modal-actions">
            <button class="btn-primary" (click)="save()" [disabled]="busy()">
              {{ busy() ? '保存中…' : '保存' }}
            </button>
            <button class="btn-ghost" (click)="closeForm()">取消</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .panel-head h2 { font-size: 1.15rem; color: #2d3748; }
    .btn-primary { padding: 0.5rem 1rem; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-ghost { padding: 0.5rem 1rem; background: #edf2f7; color: #4a5568; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; }
    .hint { padding: 0.7rem 1rem; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; font-size: 0.85rem; color: #22543d; margin-bottom: 1rem; }
    .hint-warn { background: #fffaf0; border-color: #f6ad55; color: #975a16; }
    .hint-sub { color: #4a5568; font-size: 0.8rem; }
    .notice { padding: 0.6rem 1rem; background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; color: #2a4365; font-size: 0.85rem; margin-bottom: 1rem; }
    .group { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 1.25rem; overflow: hidden; }
    .group-head { display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1.25rem; background: #f7fafc; border-bottom: 1px solid #e2e8f0; }
    .group-title { font-weight: 600; color: #2d3748; font-size: 0.95rem; }
    .group-status { font-size: 0.8rem; color: #a0aec0; }
    .group-status.on { color: #38a169; font-weight: 600; }
    .group-count { margin-left: auto; font-size: 0.8rem; color: #a0aec0; }
    .tbl { width: 100%; border-collapse: collapse; }
    .tbl th { padding: 0.6rem 1.25rem; text-align: left; font-size: 0.78rem; color: #718096; font-weight: 600; background: #fff; border-bottom: 1px solid #edf2f7; }
    .tbl td { padding: 0.7rem 1.25rem; font-size: 0.85rem; color: #2d3748; border-bottom: 1px solid #edf2f7; }
    .tbl tr:last-child td { border-bottom: none; }
    .row-active { background: #f0fff4; }
    .mono { font-family: Consolas, monospace; font-size: 0.8rem; }
    .ellipsis { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-actions { text-align: right; white-space: nowrap; }
    .btn-xs { padding: 0.25rem 0.6rem; margin-left: 0.3rem; font-size: 0.75rem; border: 1px solid #cbd5e0; background: #fff; border-radius: 6px; cursor: pointer; color: #4a5568; }
    .btn-xs:hover { background: #edf2f7; }
    .btn-xs:disabled { opacity: 0.45; cursor: default; }
    .btn-danger { color: #c53030; border-color: #feb2b2; }
    .tag { display: inline-block; padding: 0.1rem 0.45rem; margin-right: 0.3rem; font-size: 0.7rem; border-radius: 4px; background: #edf2f7; color: #718096; }
    .tag-on { background: #c6f6d5; color: #22543d; }
    .tag-ok { background: #bee3f8; color: #2a4365; }
    .tag-bad { background: #fed7d7; color: #822727; }
    .empty { padding: 1.25rem; color: #a0aec0; font-size: 0.85rem; }
    .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal { background: #fff; border-radius: 14px; padding: 1.5rem; width: min(560px, 92vw); max-height: 88vh; overflow-y: auto; }
    .modal h3 { margin-bottom: 1rem; color: #2d3748; font-size: 1.05rem; }
    .modal label { display: block; margin-bottom: 0.85rem; font-size: 0.8rem; color: #4a5568; }
    .modal input, .modal select, .modal textarea { width: 100%; margin-top: 0.3rem; padding: 0.5rem 0.65rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; font-family: inherit; }
    .modal input:disabled { background: #f7fafc; color: #a0aec0; }
    .modal-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
  `]
})
export class AiModelsPanelComponent implements OnInit {
  readonly types: ModelType[] = ['llm', 'tts', 'asr', 'image'];

  models = signal<AiModel[]>([]);
  stats = signal<AiModelStats | null>(null);
  form = signal<ModelForm | null>(null);
  busy = signal(false);
  message = signal('');

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.reload();
  }

  typeLabel(type: ModelType): string {
    return TYPE_LABEL[type] ?? type;
  }

  providersFor(type: ModelType): string[] {
    return PROVIDERS[type] ?? ['custom'];
  }

  /** 某类型的常用平台预设（选平台即自动填 BaseURL + 推荐模型）。 */
  platformsFor(type: ModelType): { name: string; url: string; models: string[] }[] {
    return PLATFORM_PRESETS[type] ?? [];
  }

  /** 一键填充：按选中平台填 BaseURL 与推荐模型；Edge TTS 是本地通道，无需 URL/Key。 */
  applyPlatform(presetName: string): void {
    const f = this.form();
    if (!f || !presetName) return;
    const preset = this.platformsFor(f.model_type).find((p) => p.name === presetName);
    if (!preset) return;
    if (f.model_type === 'tts' && preset.url === 'edge://local') {
      f.provider = 'edge';
      f.base_url = '';
      f.api_key = '';
      f.model_name = 'edge-tts';
      this.message.set('已选择 Edge TTS（免费本地双音色）：无需 BaseURL 与 API Key，直接保存即可。');
      return;
    }
    f.provider = 'openai';
    f.base_url = preset.url;
    f.model_name = preset.models[0];
    this.message.set(`已填充「${preset.name}」：${preset.url} / ${preset.models[0]}，再填入 API Key 后保存。`);
  }

  /** 需要填「模型名称」的类型：LLM / ASR，以及商用 TTS（如 FunAudioLLM/CosyVoice2-0.5B）。 */
  modelNameVisible(): boolean {
    const t = this.form()?.model_type;
    return t === 'llm' || t === 'asr' || t === 'tts';
  }

  modelNamePlaceholder(): string {
    switch (this.form()?.model_type) {
      case 'tts':
        return '例如 FunAudioLLM/CosyVoice2-0.5B / tts-1（Edge TTS 填 edge-tts）';
      case 'asr':
        return '例如 whisper-1 / iic/SenseVoiceSmall';
      default:
        return '例如 gpt-4o-mini / deepseek-chat';
    }
  }

  /**
   * 「默认音色」的占位提示：各家音色名完全不同，留空则走内置映射。
   *
   * 硅基流动要求写成「模型名:音色ID」（如 FunAudioLLM/CosyVoice2-0.5B:alex），
   * 只写 alex 会被判 400 Invalid voice。
   */
  voicePlaceholder(): string {
    const f = this.form();
    if (!f) return '';
    if (f.provider === 'edge') return '留空即用云希/晓晓；也可填 zh-CN-YunxiNeural 等';
    if (f.base_url.includes('siliconflow')) {
      return '例如 FunAudioLLM/CosyVoice2-0.5B:alex（男）/ :anna（女）；留空自动映射';
    }
    return '例如 zh-CN-XiaoxiaoNeural（Azure）/ onyx（OpenAI）';
  }

  modelsOf(type: ModelType): AiModel[] {
    return this.models().filter((m) => m.model_type === type);
  }

  /** 该类型当前激活的模型名（模板中避免可选链索引）。 */
  activeName(type: ModelType): string {
    const st = this.stats();
    return st && st.active ? st.active[type]?.name ?? '' : '';
  }

  /** 该类型的模型数量。 */
  countOf(type: ModelType): number {
    const st = this.stats();
    return st && st.counts ? st.counts[type] ?? 0 : 0;
  }

  reload(): void {
    this.api.getAiModels().subscribe({
      next: (resp) => {
        if (resp.code === 0) this.models.set(resp.data ?? []);
      },
      error: () => this.message.set('加载模型列表失败，请确认已登录管理员账号'),
    });
    this.api.getAiModelStats().subscribe({
      next: (resp) => {
        if (resp.code === 0) this.stats.set(resp.data ?? null);
      },
    });
  }

  openCreate(): void {
    this.form.set({
      id: null,
      name: '',
      model_type: 'llm',
      provider: 'openai',
      base_url: '',
      api_key: '',
      model_name: '',
      voice: '',
      region: '',
      extra_config: '',
    });
  }

  openEdit(m: AiModel): void {
    this.form.set({
      id: m.id,
      name: m.name,
      model_type: m.model_type,
      provider: m.provider,
      base_url: m.base_url,
      api_key: '',
      model_name: m.model_name,
      voice: m.voice,
      region: m.region,
      extra_config: m.extra_config ?? '',
    });
  }

  closeForm(): void {
    this.form.set(null);
  }

  save(): void {
    const fm = this.form();
    if (!fm) return;
    if (!fm.name.trim()) {
      this.message.set('请填写名称');
      return;
    }
    const payload: Partial<AiModel> & { api_key?: string } = {
      name: fm.name.trim(),
      model_type: fm.model_type,
      provider: fm.provider,
      base_url: fm.base_url.trim(),
      model_name: fm.model_name.trim(),
      voice: fm.voice.trim(),
      region: fm.region.trim(),
      extra_config: fm.extra_config.trim(),
    };
    if (fm.api_key) payload.api_key = fm.api_key;

    this.busy.set(true);
    const req = fm.id ? this.api.updateAiModel(fm.id, payload) : this.api.createAiModel(payload);
    req.subscribe({
      next: (resp) => {
        this.busy.set(false);
        if (resp.code === 0) {
          this.message.set(fm.id ? '已更新模型配置' : '已新增大模型；别忘了「激活」后才能用于生成内容');
          this.closeForm();
          this.reload();
        } else {
          this.message.set(resp.message ?? '保存失败');
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(`保存失败：${err?.error?.message ?? err.message ?? '未知错误'}`);
      },
    });
  }

  activate(m: AiModel): void {
    this.busy.set(true);
    this.api.activateAiModel(m.id).subscribe({
      next: (resp) => {
        this.busy.set(false);
        this.message.set(resp.code === 0 ? `已激活「${m.name}」；同类型的其他模型已自动停用` : resp.message ?? '激活失败');
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(`激活失败：${err?.error?.message ?? err.message}`);
      },
    });
  }

  test(m: AiModel): void {
    this.busy.set(true);
    this.message.set(`正在测试「${m.name}」…`);
    this.api.testAiModel(m.id).subscribe({
      next: (resp) => {
        this.busy.set(false);
        const ok = resp.code === 0;
        this.message.set(ok ? `「${m.name}」连接测试成功` : `「${m.name}」测试失败：${resp.message ?? ''}`);
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(`「${m.name}」测试失败：${err?.error?.message ?? err.message}`);
        this.reload();
      },
    });
  }

  remove(m: AiModel): void {
    if (!confirm(`确定删除大模型「${m.name}」？此操作不可恢复。`)) return;
    this.busy.set(true);
    this.api.deleteAiModel(m.id).subscribe({
      next: (resp) => {
        this.busy.set(false);
        this.message.set(resp.code === 0 ? `已删除「${m.name}」` : resp.message ?? '删除失败');
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.message.set(`删除失败：${err?.error?.message ?? err.message}`);
      },
    });
  }
}
