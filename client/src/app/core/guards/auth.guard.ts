import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { readToken, readUser } from '../services/auth.service';

/** 需要登录才能访问的路由守卫。 */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (readToken()) {
    return true;
  }
  void router.navigate(['/login'], { queryParams: { redirect: state.url } });
  return false;
};

/** 需要管理员角色才能访问的路由守卫。 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (!readToken()) {
    void router.navigate(['/login'], { queryParams: { redirect: state.url } });
    return false;
  }
  if (readUser()?.role !== 'admin') {
    void router.navigate(['/']);
    return false;
  }
  return true;
};
