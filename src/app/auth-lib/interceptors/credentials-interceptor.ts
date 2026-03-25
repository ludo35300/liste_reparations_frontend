import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AUTH_CONFIG } from '../auth.config';

/**
 * Interceptor "cookies + CSRF" compatible flask-jwt-extended.
 *
 * - Force `withCredentials: true` sur toutes les requêtes API (apiPrefix)
 *   afin d'envoyer les cookies HttpOnly (access/refresh).
 * - Ajoute le header CSRF (double submit) si le cookie CSRF existe.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const cfg = inject(AUTH_CONFIG);

  // On ne touche qu'aux appels vers l'API de l'app
  if (!req.url.startsWith(cfg.apiPrefix)) return next(req);

  const csrfHeaderName = cfg.csrf?.headerName ?? 'X-CSRF-TOKEN';
  const csrfAccessCookie = cfg.csrf?.accessCookieName ?? 'csrf_access_token';
  const csrfRefreshCookie = cfg.csrf?.refreshCookieName ?? 'csrf_refresh_token';

  const refreshPath = cfg.endpoints?.refresh ?? '/auth/refresh';
  const refreshUrl = apiUrl(cfg.apiPrefix, refreshPath);

  // Cookie CSRF à utiliser (refresh a son cookie séparé par défaut).
  const csrfCookieName = req.url.startsWith(refreshUrl) ? csrfRefreshCookie : csrfAccessCookie;
  const csrf = readCookie(csrfCookieName);

  let cloned = req.clone({ withCredentials: true });

  // Plus propre: CSRF seulement sur requêtes mutantes
  const needsCsrf = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  if (csrf && needsCsrf) {
    cloned = cloned.clone({ setHeaders: { [csrfHeaderName]: csrf } });
  }

  return next(cloned);
};

function apiUrl(prefix: string, path: string): string {
  const pfx = prefix.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${pfx}${p}`;
}

function readCookie(name: string): string | null {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of cookies) {
    const idx = c.indexOf('=');
    const k = idx >= 0 ? c.slice(0, idx) : c;
    if (k === name) return decodeURIComponent(idx >= 0 ? c.slice(idx + 1) : '');
  }
  return null;
}
