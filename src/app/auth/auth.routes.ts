import type { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: '',
    title: 'Một lá thư cho mình · and va em',
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
];
