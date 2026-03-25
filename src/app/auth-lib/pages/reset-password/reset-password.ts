import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { appInfos } from '../../../app.config';
import { resetPasswordConfig } from './reset-password.config';
import { AuthService } from '../../services/auth.service';
import { passwordMatchValidator } from '../../validators/password-match.validator';

/**
 * Page "Réinitialiser le mot de passe".
 *
 * Pré-requis:
 * - L'utilisateur arrive via un lien contenant un token:
 *   /reset-password?token=...
 *
 * Rôle:
 * - Envoyer {token, password} au backend (mock) pour changer le mot de passe.
 */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, FontAwesomeModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  /** Configuration */
  public readonly resetPasswordConfig = resetPasswordConfig;
  public readonly appConfig = appInfos;
  /** Etat UI */
  public readonly loading = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly successMessage = signal<string | null>(null);
  public readonly showPassword = signal(false);
  public readonly showConfirmPassword = signal(false);
  /** Icônes */
  public readonly faEye = faEye;
  public readonly faEyeSlash = faEyeSlash;
  /** Injection de dépendances */
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  /** Formulaire non-nullable (valeurs string). */
  public readonly resetPasswordForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('password', 'confirmPassword') }
  );
  /** Getter */
  public get passwordControl() { return this.resetPasswordForm.controls.password; }
  public get confirmPasswordControl() { return this.resetPasswordForm.controls.confirmPassword; }
  private get token(): string | null {  return this.route.snapshot.queryParamMap.get('token'); }
  /** Toggle affichage mot de passe */
  public togglePassword() { this.showPassword.update((v) => !v); }
  /** Toggle affichage confirmation */
  public toggleConfirmPassword() { this.showConfirmPassword.update((v) => !v); }

  public async resetPassword(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const token = this.token;
    if (!token) {
      this.errorMessage.set('Lien invalide : token manquant.');
      return;
    }
    if (this.resetPasswordForm.invalid) {
      this.errorMessage.set('Veuillez corriger les erreurs.');
      return;
    }
    if (this.resetPasswordForm.hasError('mismatch')) {
      this.errorMessage.set(this.resetPasswordConfig.validation.errors.passwordsMismatch);
      return;
    }
    const { password } = this.resetPasswordForm.getRawValue();
    this.loading.set(true);

    try {
      await firstValueFrom(this.auth.resetPasswordHttp(token, password));
      this.successMessage.set(this.resetPasswordConfig.validation.success);
      this.resetPasswordForm.disable();
      setTimeout(() => void this.router.navigateByUrl('/login'), 2000);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message ?? 'Une erreur est survenue.');
    } finally {
      this.loading.set(false);
    }
  }
}
