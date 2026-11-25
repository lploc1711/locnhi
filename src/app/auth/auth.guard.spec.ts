import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  it('waits for restoration and redirects a signed-out visitor', async () => {
    const auth = { loading: signal(true), user: signal(null) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as Observable<unknown>;
    let settled = false;
    const outcome = firstValueFrom(result).then((value) => {
      settled = true;
      return value;
    });
    TestBed.tick();
    await Promise.resolve();
    expect(settled).toBe(false);
    auth.loading.set(false);
    TestBed.tick();
    expect(TestBed.inject(Router).serializeUrl((await outcome) as never)).toBe('/login');
  });
  it('allows a restored signed-in session', async () => {
    const auth = { loading: signal(false), user: signal({ uid: 'alex' }) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as Observable<unknown>;
    const outcome = firstValueFrom(result);
    TestBed.tick();
    expect(await outcome).toBe(true);
  });
});
