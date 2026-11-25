import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { Home } from './home';

describe('Home landing page', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'test', displayName: 'Test' }),
            loading: signal(false),
            busy: signal(false),
            error: signal(null),
            signOut: vi.fn(),
          },
        },
      ],
    });
  });
  it('links to the separate date plans page without loading plan controls', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.intro-link')?.getAttribute('href')).toBe('/date-plans');
    expect(element.querySelector('app-plan-editor')).toBeNull();
    expect(element.querySelector('.plans-section')).toBeNull();
    expect(element.querySelector('app-love-note')).toBeTruthy();
  });
});
