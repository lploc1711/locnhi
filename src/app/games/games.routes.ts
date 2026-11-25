import type { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';

export const gamesRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Games · and va em',
    canActivate: [authGuard],
    loadComponent: () => import('./games').then(m => m.Games),
  },
  {
    path: 'block-blast',
    loadChildren: () => import('../heart-blocks/heart-blocks.routes').then(m => m.heartBlocksRoutes),
  },
];
