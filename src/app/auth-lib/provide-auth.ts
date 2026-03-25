import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AUTH_CONFIG, AuthModuleConfig } from './auth.config';
import { AuthService } from './services/auth.service';

function normalizeConfig(config: AuthModuleConfig): AuthModuleConfig {
    return {
        apiPrefix: config.apiPrefix,
        routes: config.routes,

        endpoints: {
            login: '/auth/login',
            logout: '/auth/logout',
            refresh: '/auth/refresh',
            register: '/auth/register',
            forgotPassword: '/auth/forgot-password',
            resetPassword: '/auth/reset-password',
            me: '/me',
            ...config.endpoints,
        },

        csrf: {
            headerName: 'X-CSRF-TOKEN',
            accessCookieName: 'csrf_access_token',
            refreshCookieName: 'csrf_refresh_token',
            ...config.csrf,
        },
    };
}

/**
 * API publique de la feature Auth (réutilisable).
 * L’application appelle `provideAuth(...)` dans ses providers.
 *
 * - Fournit la configuration via InjectionToken
 * - Initialise l'état auth au démarrage via provideAppInitializer() [web:214]
 */
export function provideAuth(config: AuthModuleConfig): EnvironmentProviders {
    const cfg = normalizeConfig(config);

    return makeEnvironmentProviders([
        { provide: AUTH_CONFIG, useValue: cfg },

        provideAppInitializer(() => {
        const auth = inject(AuthService);
        return firstValueFrom(auth.bootstrapSession());
        }),
    ]);
}
