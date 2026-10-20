import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService, readToken } from '../services/auth.service';

/**
 * 自动附加 Bearer Token，并在 401 时清理本地登录态。
 * 使用函数式拦截器（Angular 17 推荐写法）。
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = readToken();

  const authorized = token && !req.headers.has('Authorization')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorized).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Token 过期或无效：清理本地状态，后续请求将跳转登录页。
        auth.logout();
      }
      return throwError(() => err);
    })
  );
};
