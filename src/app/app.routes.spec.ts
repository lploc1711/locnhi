import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { Login } from './auth/login/login';
import { DatePlansService } from './date-plans/date-plans.service';
import { Home } from './home/home';
import { PlansPage } from './date-plans/plans-page/plans-page';
import { ItineraryPage } from './date-plans/itinerary-page/itinerary-page';

describe('Feature routing', () => {
  const auth = {
    user: signal<User | null>(null),
    loading: signal(false),
    busy: signal(false),
    error: signal<string | null>(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  beforeEach(() => {
    auth.user.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: auth },
        {
          provide: DatePlansService,
          useValue: {
            plans: signal([]),
            completed: signal(0),
            ready: signal(true),
            loading: signal(false),
            saving: signal(false),
            error: signal(null),
          },
        },
      ],
    });
  });
  it.each(['/', '/unknown-page'])('opens the letter from %s', async (url) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Login);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('.envelope')).toBeTruthy();
  });
  it('redirects a signed-out home visit to the letter', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', Login);
    expect(TestBed.inject(Router).url).toBe('/login');
  });
  it('loads the home feature and its shared brand for a signed-in user', async () => {
    auth.user.set({ uid: 'routing-test' } as User);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', Home);
    expect(TestBed.inject(Router).url).toBe('/home');
    expect(harness.routeNativeElement?.querySelector('.plans-section')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.intro-link')?.getAttribute('href')).toBe(
      '/date-plans',
    );
    expect(harness.routeNativeElement?.querySelector('app-brand a')?.getAttribute('href')).toBe(
      '/home',
    );
  });
  it('redirects a signed-out plans visit to the letter', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/date-plans', Login);
    expect(TestBed.inject(Router).url).toBe('/login');
  });
  it('loads the date planner on its own protected page', async () => {
    auth.user.set({ uid: 'routing-test' } as User);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/date-plans', PlansPage);
    expect(TestBed.inject(Router).url).toBe('/date-plans');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      'Du an ma cua chung ta',
    );
    expect(harness.routeNativeElement?.querySelector('.home-intro')).toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('nav a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/date-plans');
  });
  it('protects the full itinerary behind sign-in', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/date-plans/da-lat-3n2d', Login);
    expect(TestBed.inject(Router).url).toBe('/login');
  });
  it('opens the complete itinerary from its direct route', async () => {
    auth.user.set({ uid: 'routing-test' } as User);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/date-plans/da-lat-3n2d', ItineraryPage);
    expect(harness.routeNativeElement?.querySelectorAll('table')).toHaveLength(5);
  });
});
