import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/auth.service';
import { DatePlansService } from '../date-plans.service';
import { daLatItinerary } from '../itineraries/da-lat-itinerary';
import type { DatePlan } from '../date-plan';
import { ItineraryPage } from './itinerary-page';

describe('Da Lat itinerary page', () => {
  const plans = signal<DatePlan[]>([]);
  const dates = {
    plans,
    ready: signal(true),
    saving: signal(false),
    error: signal<string | null>(null),
    importPlan: vi.fn(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    plans.set([]);
    dates.ready.set(true);
    dates.saving.set(false);
    dates.error.set(null);
    TestBed.configureTestingModule({
      imports: [ItineraryPage],
      providers: [
        provideRouter([]),
        { provide: DatePlansService, useValue: dates },
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'alex' }),
            loading: signal(false),
            busy: signal(false),
            error: signal(null),
            signOut: vi.fn(),
          },
        },
      ],
    });
  });
  async function render() {
    const fixture = TestBed.createComponent(ItineraryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }
  it('renders the complete supplied schedule, budget and checklist', async () => {
    const { element } = await render();
    expect(element.querySelectorAll('table')).toHaveLength(5);
    expect(element.textContent).toContain('Chưa chốt');
    expect(element.textContent).toContain('5.550.000–7.180.000');
    expect(element.querySelectorAll('.checklist li')).toHaveLength(9);
  });
  it('saves the entire original document to the current account', async () => {
    dates.importPlan.mockResolvedValue(true);
    const { element, fixture } = await render();
    element.querySelector<HTMLButtonElement>('.save-area button')!.click();
    await fixture.whenStable();
    expect(dates.importPlan).toHaveBeenCalledWith(daLatItinerary.id, daLatItinerary.input);
  });
  it('does not offer a second import when the plan is already saved', async () => {
    plans.set([{ ...daLatItinerary.input, id: daLatItinerary.id, done: false, createdAt: 1 }]);
    const { element } = await render();
    expect(element.querySelector('.save-area button')).toBeNull();
    expect(element.querySelector('.saved-message')).toBeTruthy();
  });
  it('disables saving until database access is ready', async () => {
    dates.ready.set(false);
    const { element } = await render();
    expect(element.querySelector<HTMLButtonElement>('.save-area button')?.disabled).toBe(true);
  });
});
