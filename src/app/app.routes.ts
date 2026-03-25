import { Routes } from '@angular/router';
import { authUiRoutes } from './auth-lib/auth-ui.routes';
import { Home } from './pages/home/home';
import { authGuard } from './auth-lib/guards/auth.guard';


export const routes: Routes = [
    { path: 'auth', children: authUiRoutes },
    { path: 'home', component: Home, title: 'Accueil', canActivate: [authGuard] },
    
    { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
    { path: '**', redirectTo: 'auth/login' },
];
