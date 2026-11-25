import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DatePlan, PlanInput } from '../date-plan';
import { MAX_PLAN_NOTE_LENGTH } from '../date-plan';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-plan-editor',
  imports: [FormsModule],
  templateUrl: './plan-editor.html',
  styleUrl: './plan-editor.scss',
})
export class PlanEditor {
  protected readonly noteLimit = MAX_PLAN_NOTE_LENGTH;
  readonly plan = input<DatePlan | null>(null);
  readonly saving = input(false);
  readonly saved = output<PlanInput>();
  readonly closed = output<void>();
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  protected draft: PlanInput = { title: '', date: '', location: '', note: '' };
  constructor() {
    effect(() => {
      const plan = this.plan();
      this.draft = plan
        ? { title: plan.title, date: plan.date, location: plan.location, note: plan.note }
        : { title: '', date: '', location: '', note: '' };
      this.titleInput()?.nativeElement.focus();
    });
  }
  protected save(): void {
    if (!this.saving()) this.saved.emit({ ...this.draft });
  }
}
