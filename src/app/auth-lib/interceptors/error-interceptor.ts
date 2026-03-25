import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AUTH_CONFIG } from '../auth.config';

/** Refresh en vol (mutualisé) pour éviter plusieurs refresh simultanés. */
let refreshInFlight$: ReturnType<AuthService['refreshHttp']> | null = null;

/**
 * Interceptor d'erreurs (cookies + refresh) - version robustifiée.
 *
 * - 401 sur endpoint protégé -> refresh (mutualisé) -> retry.
 * - Si refresh KO -> redirection vers la route login configurée.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const cfg = inject(AUTH_CONFIG);

  const apiPrefix = cfg.apiPrefix;

  const refreshUrl = apiUrl(apiPrefix, cfg.endpoints?.refresh ?? '/auth/refresh');
  const meUrl = apiUrl(apiPrefix, cfg.endpoints?.me ?? '/me');

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      const isApi = req.url.startsWith(apiPrefix);
      const isUnauthorized = err.status === 401;

      // Important: éviter les boucles
      const isRefresh = req.url.startsWith(refreshUrl);
      const isMe = req.url === meUrl;

      if (!isApi || !isUnauthorized || isRefresh || isMe) {
        return throwError(() => err);
      }

      refreshInFlight$ ??= auth.refreshHttp().pipe(
        shareReplay(1),
        finalize(() => {
          refreshInFlight$ = null;
        }),
      );

      return refreshInFlight$.pipe(
        switchMap(() => next(req)),
        catchError((refreshErr) => {
          const returnUrl = router.url;
          router.navigate(['/login'], { queryParams: { returnUrl } });
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

function apiUrl(prefix: string, path: string): string {
  const pfx = prefix.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${pfx}${p}`;
}
