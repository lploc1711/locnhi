import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PartyConnection, type PartyRoom } from '../party-connection';

type Localized = readonly [string, string];
type Mode = 'guess' | 'same' | 'deep';
interface Settings { mode: Mode; count: number; categories: string[]; limits: Record<string, number> }
interface QuestionState {
  index: number; count: number; mode: Mode; stage: 'answer' | 'revealed' | 'skipped' | 'finished';
  question?: { category: string; prompt: Localized; choices: Localized[] };
  submitted: boolean[]; next: boolean[]; scores: number[]; matches: number; answered: number; skipped: number;
  responses?: { choice?: number; guess?: number; text?: string }[];
  discussion?: { seat: number; message: string }[];
}

const CATEGORIES: Record<string, Localized> = {
  habits: ['Preferences and habits', 'Sở thích và thói quen'],
  love: ['Love and relationships', 'Tình yêu và mối quan hệ'],
  memories: ['Childhood and memories', 'Tuổi thơ và kỷ niệm'],
  emotions: ['Personality and emotions', 'Tính cách và cảm xúc'],
  funny: ['Funny situations', 'Tình huống hài hước'],
  future: ['Future plans and dreams', 'Kế hoạch và ước mơ'],
  communication: ['Communication and conflict resolution', 'Giao tiếp và giải quyết bất đồng'],
  romance: ['Romantic expectations', 'Mong đợi trong tình yêu'],
};
const MODES: Record<Mode, Localized> = {
  guess: ['Guess Your Partner', 'Đoán ý người ấy'],
  same: ['Same Answer', 'Cùng câu trả lời'],
  deep: ['Deep Talk', 'Trò chuyện sâu'],
};

@Component({
  selector: 'app-couple-questions',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './couple-questions.html',
  styles: `
    :host { display: block; }
    fieldset { margin: 12px 0; padding: 10px 12px; border: 1px solid #dfc5d4; border-radius: 10px; min-width: 0; }
    label { display: block; margin: 8px 0; }
    input[type=checkbox], input[type=radio] { accent-color: #82395f; width: 18px; height: 18px; vertical-align: middle; }
    select, input[type=number], textarea { font: inherit; padding: 8px; border: 1px solid #ba8fa9; border-radius: 8px; background: #fff; color: inherit; }
    textarea { box-sizing: border-box; width: 100%; min-height: 96px; resize: vertical; }
    button { font: inherit; font-weight: 700; min-height: 44px; padding: 8px 12px; margin: 6px 0;
      border: 1px solid #82395f; border-radius: 10px; color: white; background: #82395f; cursor: pointer; }
    button.secondary { color: #70415e; background: #fff; }
    button:disabled { opacity: .65; }
    .categories, .answers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 6px 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .answer { border: 1px solid #ead3e0; border-radius: 12px; background: #fff; padding: 10px 12px; overflow-wrap: anywhere; }
    .reply { white-space: pre-wrap; }
    .discussion { margin: 12px 0; }
    .discussion label { margin: 0; }
    .discussion-log { margin: 0; max-height: 170px; overflow-y: auto; padding: 0; list-style: none; }
    .discussion-log li { margin: 5px 0; padding: 6px 8px; background: #f5e3ef; border-radius: 7px; overflow-wrap: anywhere; }
    h3, h4 { margin: 8px 0; }
  `,
})
export class CoupleQuestions {
  readonly room = input.required<PartyRoom>();
  readonly vietnamese = input.required<boolean>();
  protected readonly connection = inject(PartyConnection);
  protected readonly state = computed(() => this.room().state as QuestionState | null);
  protected readonly settings = computed(() => this.room().settings as Settings);
  protected readonly canSend = computed(() => this.connection.status() === 'online');
  private readonly settingsKey = computed(() => JSON.stringify(this.settings()));
  protected readonly configuration = linkedSignal(() => JSON.parse(this.settingsKey()) as Settings);
  protected readonly changed = computed(() => JSON.stringify(this.configuration()) !== this.settingsKey());
  protected readonly maxCount = computed(() => this.capacity(this.configuration()));
  private readonly promptKey = computed(() => [this.room().round, this.state()?.index].join(':'));
  protected readonly response = linkedSignal({ source: this.promptKey,
    computation: () => ({ choice: -1, guess: -1, answer: '' }) });
  protected readonly message = linkedSignal({ source: this.promptKey, computation: () => '' });
  protected readonly categories = Object.entries(CATEGORIES);
  protected readonly modes = Object.entries(MODES);

  protected local(text: Localized): string { return text[this.vietnamese() ? 1 : 0]; }
  protected tr(en: string, vi: string): string { return this.local([en, vi]); }
  protected category(key: string): string { return this.local(CATEGORIES[key]); }
  protected modeName(mode: Mode): string { return this.local(MODES[mode]); }
  protected setMode(mode: Mode): void { this.configuration.update(value => ({ ...value, mode })); }
  protected setCount(count: number): void { this.configuration.update(value => ({ ...value, count })); }

  protected toggleCategory(key: string): void {
    this.configuration.update(value => {
      const categories = value.categories.includes(key) ? value.categories.filter(item => item !== key) : [...value.categories, key];
      return { ...value, categories, count: Math.min(value.count, Math.max(1, this.capacity({ ...value, categories }))) };
    });
  }

  protected save(): void {
    if (this.changed() && this.maxCount() >= this.configuration().count) {
      this.connection.command('configure', this.configuration());
    }
  }

  protected answer(field: 'choice' | 'guess' | 'answer', value: number | string): void {
    this.response.update(response => ({ ...response, [field]: value }));
  }

  protected action(kind: 'submit' | 'skip' | 'next', state: QuestionState): void {
    this.connection.command('play', { kind, index: state.index, ...(kind === 'submit' ? this.response() : {}) });
  }

  protected selection(choices: Localized[], answer?: number): string {
    return answer === undefined ? '' : this.local(choices[answer]);
  }

  protected discuss(state: QuestionState): void {
    const message = this.message().trim();
    if (!message || !this.canSend()) return;
    this.connection.command('play', { kind: 'discuss', index: state.index, message });
    this.message.set('');
  }

  private capacity(settings: Settings): number {
    return Math.min(12, settings.categories.reduce((total, category) => total + (settings.limits[category] ?? 0), 0));
  }
}
