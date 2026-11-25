import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MemberLayout } from '../../shared/member-layout/member-layout';
import { RouterLink } from '@angular/router';
import { daLatItinerary } from '../itineraries/da-lat-itinerary';
import { DatePlansService } from '../date-plans.service';
import type { DatePlan, PlanInput } from '../date-plan';
import { PlanCard } from '../plan-card/plan-card';
import { PlanEditor } from '../plan-editor/plan-editor';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-plans-page',
  imports: [MemberLayout, RouterLink, PlanCard, PlanEditor],
  templateUrl: './plans-page.html',
  styleUrl: './plans-page.scss',
})
export class PlansPage {
  protected readonly itinerary = daLatItinerary;
  protected readonly dates = inject(DatePlansService);
  protected readonly hasItinerary = computed(() =>
    this.dates.plans().some((plan) => plan.id === this.itinerary.id),
  );
  protected readonly formOpen = signal(false);
  protected readonly editingPlan = signal<DatePlan | null>(null);
  protected readonly filter = signal<'all' | 'planned' | 'done'>('all');
  protected readonly feedback = signal('');
  protected readonly visiblePlans = computed(() =>
    this.dates
      .plans()
      .filter(
        (plan) => this.filter() === 'all' || (this.filter() === 'done' ? plan.done : !plan.done),
      )
      .sort((a, b) => (a.id === this.itinerary.id ? -1 : b.id === this.itinerary.id ? 1 : 0)),
  );
  protected readonly pendingCount = computed(
    () => this.dates.plans().length - this.dates.completed(),
  );
  protected openForm(plan?: DatePlan): void {
    this.editingPlan.set(plan ?? null);
    this.feedback.set('');
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
  }
  protected async save(input: PlanInput): Promise<void> {
    const wasEditing = !!this.editingPlan();
    if (await this.dates.save(input, this.editingPlan()?.id)) {
      this.formOpen.set(false);
      this.filter.set('all');
      this.feedback.set(
        wasEditing ? 'Đã lưu những thay đổi của mình.' : 'Đã cất thêm một cuộc hẹn vào góc nhỏ.',
      );
    }
  }
  protected async toggle(plan: DatePlan): Promise<void> {
    if (await this.dates.toggle(plan))
      this.feedback.set(
        plan.done
          ? 'Cuộc hẹn lại nằm trong những điều đang ấp ủ.'
          : 'Thêm một kỷ niệm của chúng mình ♡',
      );
  }
  protected async remove(plan: DatePlan): Promise<void> {
    if (await this.dates.remove(plan)) {
      if (this.editingPlan()?.id === plan.id) this.closeForm();
      this.feedback.set('Đã xóa cuộc hẹn.');
    }
  }
}
