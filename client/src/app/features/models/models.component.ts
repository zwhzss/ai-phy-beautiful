import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AiModelsPanelComponent } from '../admin/ai-models-panel.component';

/**
 * 模型配置页（todo.txt 需求 3）。
 *
 * 入口位于导航栏「我的收藏」之后；复用管理后台的 AI 模型面板，
 * 类型含 LLM / TTS / ASR / 图像，同类型只能激活一个。
 */
@Component({
  selector: 'app-models',
  standalone: true,
  imports: [NgIf, AiModelsPanelComponent],
  template: `
    <div class="models-page">
      <div class="page-head">
        <h1>模型配置</h1>
        <p class="desc">
          配置 AI 大模型。同一类型只能激活一个：生成教学文稿使用激活的 <b>LLM</b>，
          语音合成使用激活的 <b>TTS</b>（支持内置 Edge 与商用 API）。每种模型都支持激活、测试连接、编辑与删除。
        </p>
      </div>

      <div class="notice" *ngIf="!isAdmin()">
        需要管理员权限才能配置大模型。请使用管理员账号登录后再试。
      </div>

      <ai-models-panel *ngIf="isAdmin()"></ai-models-panel>
    </div>
  `,
  styles: [`
    .models-page { max-width: 1000px; margin: 0 auto; }
    .page-head h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .desc { color: #718096; font-size: 0.85rem; line-height: 1.8; margin-bottom: 1.25rem; }
    .desc b { color: #4c51bf; }
    .notice { background: #fffaf0; color: #975a16; border-left: 3px solid #ed8936; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.875rem; }
  `]
})
export class ModelsComponent {
  constructor(public auth: AuthService) {}

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }
}
