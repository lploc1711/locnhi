import type { Routes } from '@angular/router';

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
    path: 'heart-blocks',
    loadChildren: () => import('./heart-blocks/heart-blocks.routes').then((m) => m.heartBlocksRoutes),
  },
  { path: '**', redirectTo: 'login' },
];
