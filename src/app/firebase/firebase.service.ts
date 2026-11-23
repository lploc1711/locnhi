import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import { firebaseConfig } from './firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app = getApps().some((app) => app.name === '[DEFAULT]')
    ? getApp()
    : initializeApp(firebaseConfig);

  private readonly platformId = inject(PLATFORM_ID);
  analytics: Analytics | null = null;

  async initializeAnalytics(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      if (await isSupported()) {
        this.analytics = getAnalytics(this.app);
      }
    } catch (error) {
      console.warn('Firebase Analytics could not be initialized.', error);
    }
  }
}
