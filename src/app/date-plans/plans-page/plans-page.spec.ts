import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/auth.service';
import { DatePlansService } from '../date-plans.service';
import type { DatePlan } from '../date-plan';
import { PlansPage } from './plans-page';

const plan: DatePlan = {
  id: 'one',
  title: 'Coffee together',
  date: '',
  location: 'Cafe',
  note: 'Window seat',
  done: false,
  createdAt: 1,
};
describe('Date plans page', () => {
  const auth = {
    user: signal<User | null>({ uid: 'alex' } as User),
    loading: signal(false),
    busy: signal(false),
    error: signal(null),
    signOut: vi.fn(),
  };
  const plans = signal<DatePlan[]>([]);
  const dates = {
    plans,
    completed: computed(() => plans().filter((p) => p.done).length),
    ready: signal(true),
    loading: signal(false),
    saving: signal(false),
    error: signal<string | null>(null),
    save: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn(),
  };
  const router = { navigateByUrl: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user.set({ uid: 'alex' } as User);
    dates.plans.set([]);
    dates.ready.set(true);
    dates.loading.set(false);
    dates.saving.set(false);
    dates.error.set(null);
    TestBed.configureTestingModule({
      imports: [PlansPage],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: DatePlansService, useValue: dates },
        provideRouter([]),
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(router.navigateByUrl);
  });
  async function render() {
    const fixture = TestBed.createComponent(PlansPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }
  it('shows the requested first section and a real empty state', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Du an ma cua chung ta');
    expect(element.querySelector('.empty-state')).toBeTruthy();
    expect(element.querySelector('app-plan-card')).toBeNull();
  });
  it('creates a plan through the editor and closes only after success', async () => {
    dates.save.mockResolvedValue(true);
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('.add-plan')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const title = element.querySelector<HTMLInputElement>('input[name=title]')!;
    title.value = 'Our next date';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dates.save).toHaveBeenCalledWith(
      { title: 'Our next date', date: '', location: '', note: '' },
      undefined,
    );
    expect(element.querySelector('app-plan-editor')).toBeNull();
  });
  it('retains the draft after a failed save', async () => {
    dates.save.mockResolvedValue(false);
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('.add-plan')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const title = element.querySelector<HTMLInputElement>('input[name=title]')!;
    title.value = 'Keep this draft';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('input[name=title]')?.value).toBe(
      'Keep this draft',
    );
  });
  it('opens existing plan data for editing', async () => {
    dates.plans.set([plan]);
    dates.save.mockResolvedValue(true);
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('.card-actions .text-button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector<HTMLInputElement>('input[name=title]')?.value).toBe(plan.title);
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(dates.save).toHaveBeenCalledWith(
      { title: plan.title, date: '', location: plan.location, note: plan.note },
      'one',
    );
  });
  it('filters completion and marks a plan complete', async () => {
    dates.plans.set([plan, { ...plan, id: 'two', title: 'A memory', done: true }]);
    dates.toggle.mockResolvedValue(true);
    const { fixture, element } = await render();
    const filters = element.querySelectorAll<HTMLButtonElement>('.filters button');
    filters[1].click();
    fixture.detectChanges();
    expect(element.querySelectorAll('app-plan-card').length).toBe(1);
    element.querySelector<HTMLButtonElement>('.complete-button')!.click();
    await fixture.whenStable();
    expect(dates.toggle).toHaveBeenCalledWith(plan);
    filters[2].click();
    fixture.detectChanges();
    expect(element.querySelector('.plan-card h3')?.textContent).toBe('A memory');
  });
  it('requires explicit confirmation before deleting a plan', async () => {
    dates.plans.set([plan]);
    dates.remove.mockResolvedValue(true);
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('.delete-button')!.click();
    fixture.detectChanges();
    expect(dates.remove).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.delete-confirm button')!.click();
    await fixture.whenStable();
    expect(dates.remove).toHaveBeenCalledWith(plan);
  });
  it('redirects to the letter after sign-out', async () => {
    const { fixture } = await render();
    auth.user.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});
