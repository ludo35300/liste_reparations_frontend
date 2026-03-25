import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator: vérifie que deux champs d'un FormGroup ont la même valeur.
 *
 * @example
 * this.fb.group({ password: [''], confirmPassword: [''] }, {
 *   validators: passwordMatchValidator('password', 'confirmPassword')
 * })
 */
export function passwordMatchValidator(
    passwordKey: string,
    confirmPasswordKey: string
): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const form = control as FormGroup;
        const password = form.get(passwordKey)?.value;
        const confirm = form.get(confirmPasswordKey)?.value;
        // Tant que l'utilisateur n'a pas rempli les deux champs, pas d'erreur "mismatch".
        if (!password || !confirm) return null;
        return password === confirm ? null : { mismatch: true };
    };
}
