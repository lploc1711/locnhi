import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type Routes } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PARTY_ROOM_CODE } from './party-room-code';

export const partyRoutes: Routes = [{
  path: '',
  title: 'Couple Games · and va em',
  canActivate: [route => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const room = route.queryParamMap.get('room') ?? '';
    return toObservable(auth.loading).pipe(
      filter(loading => !loading),
      take(1),
      map(() => auth.user() ? true : router.createUrlTree(['/login'], {
        queryParams: PARTY_ROOM_CODE.test(room) ? { partyRoom: room } : {},
      })),
    );
  }],
  loadComponent: () => import('./party').then(m => m.Party),
}];
