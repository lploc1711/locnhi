import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getAuth(inject(FirebaseService).app);
  private readonly currentUser = signal<User | null>(null);
  private readonly initializing = signal(true);
  private readonly pending = signal(false);
  private readonly message = signal<string | null>(null);
  readonly user = this.currentUser.asReadonly();
  readonly loading = this.initializing.asReadonly();
  readonly busy = this.pending.asReadonly();
  readonly error = this.message.asReadonly();

  constructor() {
    this.auth.useDeviceLanguage();
    const unsubscribe = onAuthStateChanged(
      this.auth,
      (user) => {
        this.currentUser.set(user);
        this.initializing.set(false);
      },
      () => {
        this.message.set('We could not restore your session. Please reload and try again.');
        this.initializing.set(false);
      },
    );
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  async signIn(): Promise<void> {
    if (this.loading() || this.busy()) return;
    this.pending.set(true);
    this.message.set(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(this.auth, provider);
      this.currentUser.set(result.user);
    } catch (error) {
      this.message.set(this.describeError(error));
    } finally {
      this.pending.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (this.loading() || this.busy()) return;
    this.pending.set(true);
    this.message.set(null);
    try {
      await signOut(this.auth);
      this.currentUser.set(null);
    } catch {
      this.message.set('We could not sign you out. Please try again.');
    } finally {
      this.pending.set(false);
    }
  }

  private describeError(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
    switch (code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled. Select Continue with Google to try again.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
      case 'auth/network-request-failed':
        return 'Please check your internet connection and try again.';
      case 'auth/unauthorized-domain':
        return 'Sign-in is not permitted on this website address. Please contact the site owner. (auth/unauthorized-domain)';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is disabled for this app. Please contact the site owner. (auth/operation-not-allowed)';
      case 'auth/configuration-not-found':
        return 'Authentication has not been set up for this app. Please contact the site owner. (auth/configuration-not-found)';
      case 'auth/account-exists-with-different-credential':
        return 'This email already uses another sign-in method. Please contact the site owner.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      default:
        return 'We could not sign you in. Please try again.';
    }
  }
}
