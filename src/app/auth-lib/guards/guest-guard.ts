import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AUTH_CONFIG } from '../../auth-lib/auth.config';
import { AuthService } from '../services/auth.service';

/**
 * Guard: pages "guest-only" (login/register/forgot/reset).
 * Si déjà connecté -> redirige vers la route home configurée.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const cfg = inject(AUTH_CONFIG);

  return auth.isAuthenticated()
    ? router.createUrlTree([cfg.routes.home])
    : true;
};
