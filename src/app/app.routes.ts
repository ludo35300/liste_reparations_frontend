import { Routes } from '@angular/router';
import { authUiRoutes } from './auth-lib/auth-ui.routes';
import { Home } from './pages/home/home';
import { authGuard } from './auth-lib/guards/auth.guard';
import { Machines } from './pages/machines/machines';

export const routes: Routes = [
  { path: 'auth', children: authUiRoutes },

  {
    path: 'home',
    component: Home,
    title: 'Accueil',
    canActivate: [authGuard]
  },
  {
    path: 'scan',
    title: 'Scanner une fiche',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/scan/scan').then(m => m.Scan)
  },
  {
    path: 'search',
    title: 'Rechercher une machine',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/search/search').then(m => m.Search)
  },
  {
    path: 'history/:numeroSerie',
    title: 'Historique machine',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/history/history').then(m => m.History)
  },
  {
    path: 'stats',
    title: 'Statistiques',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/stats/stats').then(m => m.StatsPage)
  },
  { path: 'machines', 
    title: 'Machines', 
    canActivate: [authGuard],
    loadComponent: () => import('./pages/machines/machines').then(m => m.Machines)
  },
  { path: '',   redirectTo: 'auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth/login' },
];