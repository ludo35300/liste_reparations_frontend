import { InjectionToken } from '@angular/core';

/**
 * Configuration du module d'auth (mode cookies HttpOnly + CSRF).
 *
 * Objectif :
 * - Ne pas dépendre des environnements Angular.
 * - Pouvoir réutiliser la feature dans une autre app en ne changeant que cette config.
 */
export type AuthModuleConfig = {
  /**
   * Préfixe API (recommandé en prod même domaine + reverse proxy, et en dev via proxy Angular).
   * Exemple: '/api'
   */
  apiPrefix: string;

  /**
   * Chemins front (routes Angular) utilisés pour les redirections.
   * Exemple: '/login' et '/home'
   */
  routes: {
    home: string;
    login: string;
  };

  /**
   * Endpoints API (chemins relatifs au apiPrefix).
   * Exemple: '/auth/login'
   */
  endpoints?: {
    login?: string;          // défaut: '/auth/login'
    logout?: string;         // défaut: '/auth/logout'
    refresh?: string;        // défaut: '/auth/refresh'
    register?: string;       // défaut: '/auth/register'
    forgotPassword?: string; // défaut: '/auth/forgot-password'
    resetPassword?: string;  // défaut: '/auth/reset-password'
    me?: string;             // défaut: '/me'
  };

  /**
   * CSRF (flask-jwt-extended).
   * Par défaut:
   * - cookie CSRF access: 'csrf_access_token'
   * - cookie CSRF refresh: 'csrf_refresh_token'
   * - header: 'X-CSRF-TOKEN'
   */
  csrf?: {
    headerName?: string;
    accessCookieName?: string;
    refreshCookieName?: string;
  };
};

export const AUTH_CONFIG = new InjectionToken<AuthModuleConfig>('AUTH_CONFIG');
