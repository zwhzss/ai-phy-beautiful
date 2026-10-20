import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>注册</h1>
        <p class="auth-subtitle">创建您的物理之美账号</p>

        <form (ngSubmit)="onRegister()" class="auth-form">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" [(ngModel)]="username" name="username" required placeholder="请输入用户名" class="form-input" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" [(ngModel)]="email" name="email" required placeholder="请输入邮箱" class="form-input" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" [(ngModel)]="password" name="password" required placeholder="请设置密码（至少6位）" class="form-input" />
          </div>
          <div class="form-group">
            <label>确认密码</label>
            <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required placeholder="请再次输入密码" class="form-input" />
          </div>

          <div class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</div>

          <button type="submit" class="btn-submit" [disabled]="loading()">
            {{ loading() ? '注册中...' : '注册' }}
          </button>
        </form>

        <p class="auth-footer">
          已有账号？<a routerLink="/login">立即登录</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .auth-card { background: white; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
    .auth-card h1 { font-size: 1.75rem; margin-bottom: 0.5rem; color: #1a202c; text-align: center; }
    .auth-subtitle { color: #718096; text-align: center; margin-bottom: 2rem; }
    .auth-form { display: flex; flex-direction: column; gap: 1.25rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .form-group label { font-size: 0.875rem; color: #4a5568; font-weight: 500; }
    .form-input { padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s; }
    .form-input:focus { outline: none; border-color: #667eea; }
    .error-msg { color: #e53e3e; font-size: 0.875rem; text-align: center; padding: 0.5rem; background: #fff5f5; border-radius: 6px; }
    .btn-submit { padding: 0.875rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: opacity 0.2s; }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .auth-footer { text-align: center; margin-top: 1.5rem; font-size: 0.875rem; color: #718096; }
    .auth-footer a { color: #667eea; text-decoration: none; }
  `]
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  errorMsg = '';

  constructor(private api: ApiService, private router: Router) {}

  onRegister(): void {
    if (!this.username || !this.email || !this.password) {
      this.errorMsg = '请填写所有字段';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMsg = '两次输入的密码不一致';
      return;
    }
    if (this.password.length < 6) {
      this.errorMsg = '密码至少需要6位字符';
      return;
    }
    this.loading.set(true);
    this.errorMsg = '';
    this.api.register(this.username, this.email, this.password).subscribe({
      next: (resp) => {
        if (resp.code === 0) {
          this.router.navigate(['/login']);
        } else {
          this.errorMsg = resp.message || '注册失败';
        }
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg = '注册失败，请稍后重试';
        this.loading.set(false);
      },
    });
  }
}
