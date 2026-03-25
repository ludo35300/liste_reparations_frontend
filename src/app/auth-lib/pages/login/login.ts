import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { faApple, faFacebookF, faGoogle } from '@fortawesome/free-brands-svg-icons';

import { AuthService } from '../../services/auth.service';
import { loginConfig } from './login.config';
import { appInfos } from '../../../app.config';
import { useAuthPaths } from '../../auth-paths';

/**
 * Page de connexion (mode cookies HttpOnly).
 *
 * Flow :
 * 1) POST /api/auth/login (pose les cookies)
 * 2) GET /api/me (synchronise l’état UI + récupère user)
 * 3) navigation vers returnUrl
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FontAwesomeModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  public readonly appConfig = appInfos;
  public readonly loginConfig = loginConfig;

  public readonly loading = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  public readonly showPassword = signal(false);

  public readonly faEye = faEye;
  public readonly faEyeSlash = faEyeSlash;
  public readonly faGoogle = faGoogle;
  public readonly faApple = faApple;
  public readonly faFacebook = faFacebookF;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  public readonly routes = useAuthPaths();

  public readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  public get emailControl() { return this.loginForm.controls.email; }
  public get passwordControl() { return this.loginForm.controls.password; }

  private get returnUrl(): string {
    const ru = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!ru || !ru.startsWith('/') || ru.startsWith('/login')) return this.routes.home;
    return ru;
  }

  public togglePassword() { this.showPassword.update((v) => !v); }

  public async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.errorMessage.set('Veuillez corriger les erreurs.');
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const { email, password } = this.loginForm.getRawValue();

    try {
      // 1) Login (pose cookies HttpOnly + CSRF côté backend)
      await firstValueFrom(this.auth.loginOnlyHttp(email, password));
      // 2) Sync état UI + récupère /me
      await firstValueFrom(this.auth.getMeHttp());
      // 3) Redirection
      await this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message ?? this.loginConfig.validation.errors.authFailed);
    } finally {
      this.loading.set(false);
    }
  }
}
