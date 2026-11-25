import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadChildren: () => import('./auth/auth.routes').then((m) => m.authRoutes) },
  {
    path: 'home',
    loadChildren: () => import('./home/home.routes').then((m) => m.homeRoutes),
  },
  {
    path: 'date-plans',
    loadChildren: () => import('./date-plans/date-plans.routes').then((m) => m.datePlansRoutes),
  },
  {
    path: 'games',
    loadChildren: () => import('./games/games.routes').then((m) => m.gamesRoutes),
  },
  {
    path: 'heart-blocks',
    pathMatch: 'full',
    redirectTo: ({ queryParams }) => inject(Router).createUrlTree(['/games', 'block-blast'], { queryParams }),
  },
  { path: '**', redirectTo: 'login' },
];
