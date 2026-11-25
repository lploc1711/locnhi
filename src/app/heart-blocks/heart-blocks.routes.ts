import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, Routes } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ROOM_CODE } from './blocks';

export const heartBlocksRoutes: Routes = [{
  path: '',
  title: 'Block Blast · and va em',
  canActivate: [route => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const room = route.queryParamMap.get('room') ?? '';
    return toObservable(auth.loading).pipe(
      filter(loading => !loading), take(1),
      map(() => auth.user() ? true : router.createUrlTree(['/login'], {
        queryParams: ROOM_CODE.test(room) ? { heartRoom: room } : {},
      })),
    );
  }],
  loadComponent: () => import('./heart-blocks').then(m => m.HeartBlocks),
}];
