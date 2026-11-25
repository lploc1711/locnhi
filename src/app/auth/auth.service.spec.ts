import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthService } from './auth.service';

const sdk = vi.hoisted(() => ({
  observer: null as null | ((user: User | null) => void),
  observerError: null as null | (() => void),
  unsubscribe: vi.fn(),
  popup: vi.fn(),
  signOut: vi.fn(),
  parameters: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ useDeviceLanguage: vi.fn() }),
  onAuthStateChanged: (
    _auth: unknown,
    observer: (user: User | null) => void,
    error: () => void,
  ) => {
    sdk.observer = observer;
    sdk.observerError = error;
    return sdk.unsubscribe;
  },
  GoogleAuthProvider: class {
    setCustomParameters = sdk.parameters;
  },
  signInWithPopup: sdk.popup,
  signOut: sdk.signOut,
}));

describe('AuthService', () => {
  let auth: AuthService;
  const user = { uid: 'test-user', displayName: 'Test User', email: 'test@example.com' } as User;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: FirebaseService, useValue: { app: {} } }],
    });
    auth = TestBed.inject(AuthService);
  });

  it('waits for the initial Firebase session before allowing sign-in', async () => {
    expect(auth.loading()).toBe(true);
    await auth.signIn();
    expect(sdk.popup).not.toHaveBeenCalled();
    sdk.observer!(user);
    expect(auth.user()).toBe(user);
    expect(auth.loading()).toBe(false);
  });

  it('signs in using Google and clears pending state', async () => {
    sdk.observer!(null);
    sdk.popup.mockResolvedValue({ user });
    await auth.signIn();
    expect(sdk.parameters).toHaveBeenCalledWith({ prompt: 'select_account' });
    expect(auth.user()).toBe(user);
    expect(auth.busy()).toBe(false);
    expect(auth.error()).toBeNull();
  });

  it('prevents duplicate sign-in requests', async () => {
    sdk.observer!(null);
    let complete!: (value: { user: User }) => void;
    sdk.popup.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const first = auth.signIn();
    expect(auth.busy()).toBe(true);
    await auth.signIn();
    expect(sdk.popup).toHaveBeenCalledTimes(1);
    complete({ user });
    await first;
  });

  it.each([
    ['auth/popup-blocked', 'Allow pop-ups'],
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/network-request-failed', 'internet connection'],
    ['auth/unauthorized-domain', 'auth/unauthorized-domain'],
    ['auth/operation-not-allowed', 'auth/operation-not-allowed'],
    ['auth/configuration-not-found', 'auth/configuration-not-found'],
    ['unknown', 'Please try again'],
  ])('shows a useful error for %s and allows retry', async (code, message) => {
    sdk.observer!(null);
    sdk.popup.mockRejectedValueOnce({ code });
    await auth.signIn();
    expect(auth.error()).toContain(message);
    expect(auth.busy()).toBe(false);
    sdk.popup.mockResolvedValueOnce({ user });
    await auth.signIn();
    expect(auth.error()).toBeNull();
    expect(auth.user()).toBe(user);
  });

  it('signs out and clears the displayed account', async () => {
    sdk.observer!(user);
    sdk.signOut.mockResolvedValue(undefined);
    await auth.signOut();
    expect(sdk.signOut).toHaveBeenCalledOnce();
    expect(auth.user()).toBeNull();
    expect(auth.busy()).toBe(false);
  });

  it('retains the account if sign-out fails', async () => {
    sdk.observer!(user);
    sdk.signOut.mockRejectedValue(new Error('offline'));
    await auth.signOut();
    expect(auth.user()).toBe(user);
    expect(auth.error()).toContain('could not sign you out');
    expect(auth.busy()).toBe(false);
  });

  it('exits loading when session restoration fails', () => {
    sdk.observerError!();
    expect(auth.loading()).toBe(false);
    expect(auth.error()).toContain('restore your session');
  });

  it('unsubscribes when the service is destroyed', () => {
    TestBed.resetTestingModule();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });
});
