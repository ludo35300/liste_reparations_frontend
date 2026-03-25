import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { errorInterceptor } from './auth-lib/interceptors/error-interceptor';
import { credentialsInterceptor } from './auth-lib/interceptors/credentials-interceptor';
import { AuthService } from './auth-lib/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { provideAuth } from './auth-lib/provide-auth';
/**
 * Configuration globale de l'application.
 *
 * Points clés :
 * - Les HttpInterceptors s'exécutent dans l'ordre déclaré pour les requêtes
 *   et dans l'ordre inverse pour les réponses. [web:10]
 * - L'auth (cookies HttpOnly) est initialisée au démarrage via un AppInitializer.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAuth({
      apiPrefix: '/api',
      routes: {
        home: '/home',
        login: 'auth/login',
      }
    }),
    // IMPORTANT: HttpClient + interceptor
    provideHttpClient(
      withInterceptors([
        credentialsInterceptor,
        errorInterceptor
      ])
    ),
    /**
     * Initialise l'état auth au démarrage.
     * - Appelle /api/me
     * - Met à jour les signals AuthService
     * - Ne bloque pas le démarrage si 401 (non connecté)
     */
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return firstValueFrom(auth.bootstrapSession());
    }),
  ],
};

export const appInfos = {
  title: 'Authentification',
};

