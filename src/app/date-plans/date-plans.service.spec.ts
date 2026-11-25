import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firebase.service';
import { DatePlansService } from './date-plans.service';
import type { DatePlan, PlanInput } from './date-plan';

interface TestSnapshot {
  forEach(callback: (entry: { key: string; val(): Record<string, unknown> }) => void): void;
}
const sdk = vi.hoisted(() => ({
  observer: null as null | ((snapshot: TestSnapshot) => void),
  fail: null as null | (() => void),
  unsubscribe: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('firebase/database', () => ({
  getDatabase: () => ({}),
  ref: (_db: unknown, path: string) => path,
  push: (path: string) => path + '/generated-id',
  serverTimestamp: () => ({ '.sv': 'timestamp' }),
  onValue: (_ref: unknown, observer: typeof sdk.observer, fail: typeof sdk.fail) => {
    sdk.observer = observer;
    sdk.fail = fail;
    return sdk.unsubscribe;
  },
  set: sdk.set,
  update: sdk.update,
  remove: sdk.remove,
  runTransaction: sdk.transaction,
}));
function emit(plans: Array<{ id: string; data: Record<string, unknown> }> = []): void {
  sdk.observer!({
    forEach: (callback) => {
      plans.forEach((plan) => callback({ key: plan.id, val: () => plan.data }));
    },
  });
}
const input: PlanInput = {
  title: 'Coffee together',
  date: '2026-12-01',
  location: 'Cafe',
  note: 'Window seat',
};
const plan: DatePlan = { ...input, id: 'first', done: false, createdAt: 123 };

describe('DatePlansService', () => {
  const auth = { user: signal<User | null>(null) };
  let dates: DatePlansService;
  beforeEach(() => {
    vi.resetAllMocks();
    auth.user.set({ uid: 'alex' } as User);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: FirebaseService,
          useValue: { app: { options: { databaseURL: 'https://demo-and-va-em.firebaseio.com' } } },
        },
      ],
    });
    dates = TestBed.inject(DatePlansService);
    TestBed.tick();
  });
  function ready() {
    emit();
  }
  it('waits for Realtime Database before allowing writes', async () => {
    expect(dates.loading()).toBe(true);
    expect(await dates.save(input)).toBe(false);
    expect(sdk.set).not.toHaveBeenCalled();
    ready();
    expect(dates.ready()).toBe(true);
  });
  it('creates a plan in the signed-in user path', async () => {
    ready();
    sdk.set.mockResolvedValue({ id: 'new' });
    expect(await dates.save(input)).toBe(true);
    expect(sdk.set).toHaveBeenCalledWith(
      'users/alex/datePlans/generated-id',
      expect.objectContaining({ ...input, done: false, createdAt: { '.sv': 'timestamp' } }),
    );
  });
  it('updates existing plans without changing completion or creation time', async () => {
    ready();
    sdk.update.mockResolvedValue(undefined);
    expect(await dates.save(input, 'first')).toBe(true);
    expect(sdk.update).toHaveBeenCalledWith('users/alex/datePlans/first', input);
  });
  it('validates before writing', async () => {
    ready();
    expect(await dates.save({ ...input, title: ' ' })).toBe(false);
    expect(sdk.set).not.toHaveBeenCalled();
    expect(dates.error()).toBeTruthy();
  });
  it('reads updates and counts completed dates', () => {
    emit([{ id: 'first', data: { ...plan, done: true } }]);
    expect(dates.plans()[0].title).toBe(input.title);
    expect(dates.completed()).toBe(1);
  });
  it('changes completion and deletes from the owner path', async () => {
    ready();
    sdk.update.mockResolvedValue(undefined);
    sdk.remove.mockResolvedValue(undefined);
    await dates.toggle(plan);
    expect(sdk.update).toHaveBeenCalledWith('users/alex/datePlans/first', { done: true });
    await dates.remove(plan);
    expect(sdk.remove).toHaveBeenCalledWith('users/alex/datePlans/first');
  });
  it('clears data and subscriptions on sign-out', async () => {
    emit([{ id: 'first', data: { ...plan } }]);
    auth.user.set(null);
    TestBed.tick();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
    expect(dates.plans()).toEqual([]);
    expect(await dates.save(input)).toBe(false);
  });
  it('handles read errors without enabling writes', () => {
    sdk.fail!();
    expect(dates.loading()).toBe(false);
    expect(dates.ready()).toBe(false);
    expect(dates.error()).toBeTruthy();
  });
  it('handles save errors without reporting success', async () => {
    ready();
    sdk.set.mockRejectedValue(new Error('permission-denied'));
    expect(await dates.save(input)).toBe(false);
    expect(dates.saving()).toBe(false);
    expect(dates.error()).toBeTruthy();
  });
  it('blocks duplicate writes until the first finishes', async () => {
    ready();
    let finish!: () => void;
    sdk.set.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const first = dates.save(input);
    expect(dates.saving()).toBe(true);
    expect(await dates.save(input)).toBe(false);
    expect(sdk.set).toHaveBeenCalledOnce();
    finish();
    expect(await first).toBe(true);
  });
  it('does not report success to a different user after an account change', async () => {
    ready();
    let finish!: () => void;
    sdk.set.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const pending = dates.save(input);
    auth.user.set({ uid: 'another' } as User);
    TestBed.tick();
    finish();
    expect(await pending).toBe(false);
    expect(dates.plans()).toEqual([]);
  });
  it('shows a configuration error when the database URL is missing', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: FirebaseService, useValue: { app: { options: {} } } },
      ],
    });
    const unconfigured = TestBed.inject(DatePlansService);
    TestBed.tick();
    expect(unconfigured.ready()).toBe(false);
    expect(unconfigured.loading()).toBe(false);
    expect(unconfigured.error()).toContain('Realtime Database');
  });
  it('sorts live data with newest plans first', () => {
    emit([
      { id: 'old', data: { ...plan, createdAt: 1 } },
      { id: 'new', data: { ...plan, createdAt: 3 } },
    ]);
    expect(dates.plans().map((plan) => plan.id)).toEqual(['new', 'old']);
  });
  it('ignores late data from a previous account', () => {
    const previousObserver = sdk.observer!;
    auth.user.set({ uid: 'another' } as User);
    TestBed.tick();
    previousObserver({ forEach: (callback) => callback({ key: 'old', val: () => ({ ...plan }) }) });
    expect(dates.plans()).toEqual([]);
    expect(dates.ready()).toBe(false);
  });
  it('imports a starter plan once and preserves an existing record', async () => {
    ready();
    sdk.transaction.mockResolvedValue({ committed: true });
    expect(await dates.importPlan('starter', input)).toBe(true);
    const [path, updater, options] = sdk.transaction.mock.calls[0];
    expect(path).toBe('users/alex/datePlans/starter');
    expect(options).toEqual({ applyLocally: false });
    expect(updater(null)).toEqual({ ...input, done: false, createdAt: { '.sv': 'timestamp' } });
    expect(updater({ ...plan, title: 'My edits' })).toBeUndefined();
  });
  it('keeps import failures visible without reporting success', async () => {
    ready();
    sdk.transaction.mockRejectedValue(new Error('permission-denied'));
    expect(await dates.importPlan('starter', input)).toBe(false);
    expect(dates.error()).toBeTruthy();
    expect(dates.saving()).toBe(false);
  });
});
