import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { appInfos } from '../../../app.config';
import { forgotPasswordConfig } from './forgot-password.config';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
/**
 * Page "Mot de passe oublié".
 *
 * Objectif:
 * - Déclencher l'envoi d'un lien de réinitialisation (mock backend).
 *
 * Sécurité/UX:
 * - Affiche un message générique même si l'email n'existe pas
 *   (évite l'énumération de comptes).
 */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  /**  UI Config (couleurs, image, textes) */
  public readonly forgotPasswordConfig = forgotPasswordConfig;
  public readonly appConfig = appInfos;
  /** Etat UI */
  public readonly loading = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly successMessage = signal<string | null>(null);
  /** Injection des dépendances */
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Formulaire (non-nullable pour avoir des strings, pas string|null). */
  public readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  /** Raccourcis pour template / debug */
  public get emailControl() { return this.forgotPasswordForm.controls.email;}
  /**
   * Soumission du formulaire.
   * - Si invalide: affiche une erreur de validation
   * - Sinon: appelle l'API et affiche un message générique (succès)
   */
  public async forgotPassword(): Promise<void> {
    if (this.forgotPasswordForm.invalid) {
      this.errorMessage.set('Veuillez corriger les erreurs.');
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    const { email } = this.forgotPasswordForm.getRawValue();

    try {
      await firstValueFrom(this.auth.forgotPasswordHttp(email));
      // Message générique recommandé (ne pas révéler si l'email existe).
      this.successMessage.set('Si cet email est enregistré, un lien de réinitialisation a été envoyé.');
      // Fige l'input après succès
      this.forgotPasswordForm.disable();
    } catch (err: any) {
      const msg = err?.error?.message ?? 'Une erreur est survenue.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
