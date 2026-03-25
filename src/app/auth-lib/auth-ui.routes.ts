import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';
import { guestGuard } from './guards/guest-guard';

/**
 * Routes UI d'auth (réutilisables).
 */
export const authUiRoutes: Routes = [
    { path: 'login', component: Login, title: 'Connexion', canActivate: [guestGuard] },
    { path: 'register', component: Register, title: 'Inscription', canActivate: [guestGuard] },
    { path: 'forgot-password', component: ForgotPassword, title: 'Réinitialisation du mot de passe', canActivate: [guestGuard] },
    { path: 'reset-password', component: ResetPassword, title: 'Modification du mot de passe', canActivate: [guestGuard] },
];
