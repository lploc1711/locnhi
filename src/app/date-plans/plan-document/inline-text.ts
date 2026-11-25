import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { inlineText } from './plan-document.parser';
@Component({
  selector: 'app-inline-text',
  template: `@for (part of parts(); track $index) {
    @switch (part.style) {
      @case ('bold') {
        <strong>{{ part.text }}</strong>
      }
      @case ('italic') {
        <em>{{ part.text }}</em>
      }
      @default {
        {{ part.text }}
      }
    }
  }`,
  styles: ':host {display:contents;}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineText {
  readonly text = input.required<string>();
  protected readonly parts = computed(() => inlineText(this.text()));
}
