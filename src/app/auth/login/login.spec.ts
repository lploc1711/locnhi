import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { AuthService } from '../auth.service';
import { Login } from './login';

describe('Letter login', () => {
  const auth = {
    user: signal<User | null>(null),
    loading: signal(false),
    busy: signal(false),
    error: signal<string | null>(null),
    signIn: vi.fn(),
  };
  const router = { navigateByUrl: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    router.navigateByUrl.mockResolvedValue(true);
    auth.user.set(null);
    auth.loading.set(false);
    auth.busy.set(false);
    auth.error.set(null);
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([])],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(router.navigateByUrl);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  function render() {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }
  it('starts Google sign-in from the closed letter', () => {
    const { element } = render();
    expect(element.querySelector('.is-open')).toBeNull();
    element.querySelector<HTMLButtonElement>('.google-button')!.click();
    expect(auth.signIn).toHaveBeenCalledOnce();
  });
  it('disables sign-in while a request is pending', () => {
    auth.busy.set(true);
    const { element } = render();
    expect(element.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  });
  it('waits for session restoration without showing sign-in', () => {
    auth.loading.set(true);
    const { element } = render();
    expect(element.querySelector('[role="status"]')).toBeTruthy();
    expect(element.querySelector('button')).toBeNull();
  });
  it('opens the letter after authentication and navigates after the animation', async () => {
    vi.useFakeTimers();
    const { fixture, element } = render();
    auth.user.set({ uid: 'alex' } as User);
    fixture.detectChanges();
    expect(element.querySelector('.is-open')).toBeTruthy();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1600);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });
  it('cancels navigation when the component is destroyed', async () => {
    vi.useFakeTimers();
    auth.user.set({ uid: 'alex' } as User);
    const { fixture } = render();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(1600);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
  it('offers navigation retry if routing fails', async () => {
    vi.useFakeTimers();
    router.navigateByUrl.mockRejectedValue(new Error('load failed'));
    auth.user.set({ uid: 'alex' } as User);
    const { fixture, element } = render();
    await vi.advanceTimersByTimeAsync(1600);
    fixture.detectChanges();
    expect(element.querySelector('button')).toBeTruthy();
  });
  it('announces authentication errors', () => {
    auth.error.set('Please try again.');
    const { element } = render();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Please try again.');
  });
});
