import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NgIf],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>登录</h1>
        <p class="auth-subtitle">欢迎回到物理之美</p>

        <form (ngSubmit)="onLogin()" class="auth-form">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" [(ngModel)]="username" name="username" required placeholder="请输入用户名" class="form-input" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" [(ngModel)]="password" name="password" required placeholder="请输入密码" class="form-input" />
          </div>

          <div class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</div>

          <button type="submit" class="btn-submit" [disabled]="loading()">
            {{ loading() ? '登录中...' : '登录' }}
          </button>
        </form>

        <p class="auth-footer">
          还没有账号？<a routerLink="/register">立即注册</a>
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
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  errorMsg = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.errorMsg = '请输入用户名和密码';
      return;
    }
    this.loading.set(true);
    this.errorMsg = '';
    this.auth.login(this.username, this.password).subscribe({
      next: (resp) => {
        if (resp.code === 0 && resp.data) {
          const redirect = this.route.snapshot.queryParamMap.get('redirect');
          void this.router.navigate([redirect && redirect.startsWith('/') ? redirect : '/']);
        } else {
          this.errorMsg = resp.message || '登录失败';
        }
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg = '登录失败，请检查用户名和密码';
        this.loading.set(false);
      },
    });
  }
}
