import type { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';

export const datePlansRoutes: Routes = [
  {
    path: 'da-lat-3n2d',
    title: 'Đà Lạt 3N2Đ · and va em',
    canActivate: [authGuard],
    loadComponent: () => import('./itinerary-page/itinerary-page').then((m) => m.ItineraryPage),
  },
  {
    path: '',
    title: 'Du an ma cua chung ta · and va em',
    canActivate: [authGuard],
    loadComponent: () => import('./plans-page/plans-page').then((m) => m.PlansPage),
  },
];
