import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { MeResponse, OkResponse, RegisterRequest } from '../models/auth.model';
import { AUTH_CONFIG, AuthModuleConfig } from '../auth.config';

/**
 * Service d'authentification (sécurité max, cookies HttpOnly + CSRF).
 *
 * Stratégie :
 * - Tokens en cookies HttpOnly => le front ne peut pas lire les tokens. [web:80]
 * - Protection CSRF via double submit : cookie CSRF + header `X-CSRF-TOKEN`. [web:80]
 * - Le front maintient uniquement un état UI ("connecté ou non") et éventuellement le profil /me.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Configuration injectée (source de vérité pour URLs et routes). */
  private readonly cfg = inject(AUTH_CONFIG);

  /** Etat interne d'auth (UI). */
  private readonly _isAuthenticated = signal<boolean>(false);

  /** Etat exposé aux composants (lecture seule). */
  public readonly isAuthenticatedSignal = this._isAuthenticated.asReadonly();

  /** Cache user courant (facultatif mais pratique). */
  private readonly _me = signal<MeResponse | null>(null);

  /** Observable /me mis en cache pour éviter les appels multiples. */
  private meOnce$?: Observable<MeResponse>;

  /** User exposé (lecture seule). */
  public readonly meSignal = this._me.asReadonly();

  private readonly ep = this.endpoints();

  /** Snapshot synchrone (guards/services). */
  public isAuthenticated(): boolean {
    return this._isAuthenticated();
  }

  /**
   * Bootstrap session au démarrage.
   * - Appelle /me
   * - 200 -> connecté
   * - 401 -> non connecté (cas normal)
   */
  public bootstrapSession(): Observable<boolean> {
    return this.getMeHttp().pipe(
      map(() => true),
      catchError(() => {
        this._isAuthenticated.set(false);
        this._me.set(null);
        return of(false);
      }),
    );
  }

  /** POST login (pose cookies). */
  public loginOnlyHttp(email: string, password: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(this.apiUrl(this.ep.login), { email, password });
  }

  /** POST register. */
  public registerHttp(payload: RegisterRequest): Observable<OkResponse> {
    return this.http.post<OkResponse>(this.apiUrl(this.ep.register), payload);
  }

  /** POST forgot password. */
  public forgotPasswordHttp(email: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(this.apiUrl(this.ep.forgotPassword), { email });
  }

  /** POST reset password. */
  public resetPasswordHttp(token: string, password: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(this.apiUrl(this.ep.resetPassword), { token, password });
  }

  /** POST refresh (renouvelle access cookie). */
  public refreshHttp(): Observable<OkResponse> {
    return this.http.post<OkResponse>(this.apiUrl(this.ep.refresh), {});
  }

  /**
   * Logout serveur :
   * - supprime les cookies côté backend
   * - puis reset état UI local (même si la requête échoue)
   */
  public logoutHttp(): Observable<OkResponse> {
    return this.http.post<OkResponse>(this.apiUrl(this.ep.logout), {}).pipe(
      catchError(() => of<OkResponse>({ ok: true })),
      tap(() => {
        this._isAuthenticated.set(false);
        this._me.set(null);
        this.meOnce$ = undefined;
      }),
    );
  }

  /**
   * Endpoint protégé : /me (mis en cache).
   * Si OK -> met à jour l'état UI + cache user.
   */
  public getMeHttp(): Observable<MeResponse> {
    this.meOnce$ ??= this.http.get<MeResponse>(this.apiUrl(this.ep.me)).pipe(
      tap((me) => {
        this._isAuthenticated.set(true);
        this._me.set(me);
      }),
      catchError((err) => {
        this._isAuthenticated.set(false);
        this._me.set(null);
        this.meOnce$ = undefined;
        throw err;
      }),
      shareReplay(1),
    );

    return this.meOnce$;
  }

  // ----------------------------
  // Helpers config/URL
  // ----------------------------

  /**
   * Construit une URL API à partir du préfixe configuré.
   */
  private apiUrl(path: string): string {
    const prefix = this.cfg.apiPrefix.replace(/\/+$/, ''); // trim trailing /
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${prefix}${p}`;
  }

  /** Endpoints avec défauts (au cas où provideAuth n'a pas normalisé). */
  private endpoints(): Required<NonNullable<AuthModuleConfig['endpoints']>> {
    return {
      login: this.cfg.endpoints?.login ?? '/auth/login',
      logout: this.cfg.endpoints?.logout ?? '/auth/logout',
      refresh: this.cfg.endpoints?.refresh ?? '/auth/refresh',
      register: this.cfg.endpoints?.register ?? '/auth/register',
      forgotPassword: this.cfg.endpoints?.forgotPassword ?? '/auth/forgot-password',
      resetPassword: this.cfg.endpoints?.resetPassword ?? '/auth/reset-password',
      me: this.cfg.endpoints?.me ?? '/me',
    };
  }
}
