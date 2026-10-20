import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService, AuthResponse } from './api.service';

const TOKEN_KEY = 'mb_token';
const USER_KEY = 'mb_user';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

/** 统一的登录状态管理：token 与用户信息保存在 localStorage，供拦截器与守卫使用。 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthUser | null>(readUser());
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  constructor(private api: ApiService, private router: Router) {}

  isLoggedIn(): boolean {
    return !!this.token();
  }

  isAdmin(): boolean {
    return this.user()?.role === 'admin';
  }

  login(username: string, password: string): Observable<any> {
    return this.api.login(username, password).pipe(
      tap((resp) => {
        if (resp.code === 0 && resp.data) {
          this.store(resp.data);
        }
      })
    );
  }

  register(username: string, email: string, password: string): Observable<any> {
    return this.api.register(username, email, password);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
  }

  /** 退出并跳转首页（供导航栏与 401 处理使用）。 */
  logoutAndRedirect(): void {
    this.logout();
    void this.router.navigate(['/']);
  }

  private store(data: AuthResponse): void {
    const user: AuthUser = { id: data.id, username: data.username, email: data.email, role: data.role };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(data.token);
    this.user.set(user);
  }
}

/** 读取本地缓存的登录用户。 */
export function readUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** 读取本地缓存的 token（拦截器使用，避免依赖注入顺序问题）。 */
export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
