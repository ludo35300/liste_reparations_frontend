import { inject } from '@angular/core';
import { AUTH_CONFIG } from './auth.config';

export function useAuthPaths() {
    const cfg = inject(AUTH_CONFIG);
    return cfg.routes;
}
