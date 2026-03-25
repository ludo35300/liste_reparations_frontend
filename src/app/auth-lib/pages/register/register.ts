import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { faApple, faFacebookF, faGoogle } from '@fortawesome/free-brands-svg-icons';

import { appInfos } from '../../../app.config';
import { AuthService } from '../../services/auth.service';
import { registerConfig } from './register.config';
import { passwordMatchValidator } from '../../validators/password-match.validator';
import { RegisterRequest } from '../../models/auth.model';
import { useAuthPaths } from '../../auth-paths';

/**
 * Page d'inscription.
 *
 * Responsabilités:
 * - Créer un compte via `/api/auth/register`
 * - Optionnel: auto-login via `/api/auth/login`
 * - Gérer les erreurs UI et l'état de chargement
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, FontAwesomeModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  /** Infos globales app */
  public readonly appConfig = appInfos;
  /** Textes/UI */
  public readonly registerConfig = registerConfig;
  /** Etat UI */
  public readonly showPassword = signal(false);
  public readonly showConfirmPassword = signal(false);
  public readonly loading = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  /** Icônes */
  public readonly faEye = faEye;
  public readonly faEyeSlash = faEyeSlash;
  public readonly faGoogle = faGoogle;
  public readonly faApple = faApple;
  public readonly faFacebook = faFacebookF;
  /** Injection des dépendances */
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  
  public readonly routes = useAuthPaths();
  
  /**
   * Formulaire d'inscription.
   * `nonNullable` => valeurs toujours `string` (pas `null`).
   */
  public readonly registerForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') }
  );
  /** Contrôles (pratiques pour template). */
  public get emailControl() { return this.registerForm.controls.email; }
  public get passwordControl() { return this.registerForm.controls.password; }
  public get confirmPasswordControl() { return this.registerForm.controls.confirmPassword; }
  /** Toggle affichage mot de passe */
  public togglePassword() { this.showPassword.update((v) => !v); }
  /** Toggle affichage confirmation */
  public toggleConfirmPassword() { this.showConfirmPassword.update((v) => !v); }
  /**
   * Soumission du register.
   * - Si le formulaire est invalide, affiche un message générique (les erreurs détaillées sont déjà dans le template)
   * - Si succès: register puis auto-login puis navigation /home
   */
  public async register(): Promise<void> {
    if (this.registerForm.invalid) {
      this.errorMessage.set(this.registerConfig.validation.errors.registerFailed);
      return;
    }
    // Sécurité UX: si mismatch, on force un message clair (au cas où)
    if (this.registerForm.hasError('mismatch')) {
      this.errorMessage.set(this.registerConfig.validation.errors.passwordsMismatch);
      return;
    }
    

    this.errorMessage.set(null);
    this.loading.set(true);

    const payload = this.registerForm.getRawValue();
    const { confirmPassword, ...request } = payload;
    try {
      await firstValueFrom(this.auth.registerHttp(request as RegisterRequest));
      await firstValueFrom(this.auth.loginOnlyHttp(request.email, request.password)); // Auto Login
      await this.router.navigateByUrl(this.routes.home);
    } catch (err: any) {
      const msg = err?.error?.message ?? this.registerConfig.validation.errors.registerFailed;
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}