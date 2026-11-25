import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { DatePlan } from '../date-plan';
import { RouterLink } from '@angular/router';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-plan-card',
  imports: [RouterLink],
  templateUrl: './plan-card.html',
  styleUrl: './plan-card.scss',
})
export class PlanCard {
  readonly plan = input.required<DatePlan>();
  readonly detailLink = input<string | null>(null);
  readonly busy = input(false);
  readonly tone = input(0);
  readonly completed = output<DatePlan>();
  readonly edited = output<DatePlan>();
  readonly removed = output<DatePlan>();
  protected readonly deleting = signal(false);
  protected formatDate(value: string): string {
    if (!value) return 'Một ngày thật gần';
    const date = new Date(value + 'T12:00:00');
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          date,
        )
      : value;
  }
}
