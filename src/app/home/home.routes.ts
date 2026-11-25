import type { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';

export const homeRoutes: Routes = [
  {
    path: '',
    title: 'Góc nhỏ của mình · and va em',
    canActivate: [authGuard],
    loadComponent: () => import('./home').then((m) => m.Home),
  },
];
