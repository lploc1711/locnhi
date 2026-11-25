import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberLayout } from '../../shared/member-layout/member-layout';
import { DatePlansService } from '../date-plans.service';
import { daLatItinerary } from '../itineraries/da-lat-itinerary';
import { PlanDocument } from '../plan-document/plan-document';
@Component({
  selector: 'app-itinerary-page',
  imports: [MemberLayout, RouterLink, PlanDocument],
  templateUrl: './itinerary-page.html',
  styleUrl: './itinerary-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItineraryPage {
  protected readonly itinerary = daLatItinerary;
  protected readonly dates = inject(DatePlansService);
  protected readonly saved = computed(() =>
    this.dates.plans().some((plan) => plan.id === this.itinerary.id),
  );
  protected readonly feedback = signal('');
  protected async save(): Promise<void> {
    if (await this.dates.importPlan(this.itinerary.id, this.itinerary.input))
      this.feedback.set('Đã cất trọn lịch trình Đà Lạt vào sổ hẹn của bạn.');
  }
}
