import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AUTH_CONFIG } from '../../auth-lib/auth.config';
import { AuthService } from '../services/auth.service';


/**
 * Guard: pages protégées.
 * Si non connecté -> redirige vers la route login configurée, en conservant returnUrl.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const cfg = inject(AUTH_CONFIG);

  return auth.isAuthenticated()
    ? true
    : router.createUrlTree([cfg.routes.login], { queryParams: { returnUrl: state.url } });
};
