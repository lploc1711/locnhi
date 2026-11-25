import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InlineText } from './inline-text';
import { parsePlanDocument } from './plan-document.parser';
@Component({
  selector: 'app-plan-document',
  imports: [InlineText],
  templateUrl: './plan-document.html',
  styleUrl: './plan-document.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanDocument {
  readonly content = input.required<string>();
  protected readonly blocks = computed(() => parsePlanDocument(this.content()));
}
