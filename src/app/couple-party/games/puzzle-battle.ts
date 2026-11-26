import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PartyConnection, type PartyRoom } from '../party-connection';
import { PuzzleCanvas, type PuzzleCell } from './puzzle-canvas';

type Localized = readonly [string, string];
type PuzzleType = 'memory' | 'blocks' | 'patterns' | 'sliding' | 'match-three' | 'logic';
type Coordinate = [number, number];
interface Settings { type: 'mix' | PuzzleType; difficulty: 0 | 1 | 2 }
interface Board {
  cells?: (number | null)[];
  matched?: boolean[];
  size?: number;
  locked?: boolean;
  wrong?: boolean;
  sequence?: (number | null)[];
  options?: number[];
  prompt?: Localized;
  pieces?: Coordinate[][];
  placed?: ({ index: number; rotation: number } | null)[];
}
interface Round {
  heat: number; type: PuzzleType; winner: number; elapsedMs: number; progress: number[]; target: number;
}
interface PuzzleState {
  type: PuzzleType; heat: number; stage: 'countdown' | 'race' | 'round-result' | 'finished';
  startsAt: number; deadline: number; nextAt?: number; wins: number[]; history: Round[];
  timeLimitReached?: boolean;
  board?: Board; sequence?: number; progress?: number; opponentProgress?: number; target?: number;
}

const TYPES: Record<Settings['type'], Localized> = {
  mix: ['Mixed puzzles', 'Nhiều loại câu đố'],
  memory: ['Memory Matching', 'Tìm cặp giống nhau'],
  blocks: ['Block Puzzle', 'Xếp khối'],
  patterns: ['Pattern Matching', 'Tìm quy luật'],
  sliding: ['Sliding Puzzle', 'Trượt ô'],
  'match-three': ['Match Three', 'Ghép ba'],
  logic: ['Logic Puzzle', 'Câu đố logic'],
};
const INSTRUCTIONS: Record<PuzzleType, Localized> = {
  memory: ['Flip two cards to find a pair.', 'Lật hai lá bài để tìm một cặp giống nhau.'],
  blocks: ['Choose a piece, rotate it if needed, then tap where its top-left corner belongs. Cover every square.',
    'Chọn khối, xoay nếu cần, rồi chạm vào vị trí góc trên bên trái. Lấp đầy mọi ô.'],
  patterns: ['Choose what belongs in the missing spot.', 'Chọn hình phù hợp với vị trí còn thiếu.'],
  sliding: ['Slide a tile next to the gap. Put the numbers in order to complete the picture.',
    'Trượt ô nằm cạnh khoảng trống. Xếp số theo thứ tự để hoàn thành bức hình.'],
  'match-three': ['Select neighboring tiles to swap them. Line up three or more of the same symbol.',
    'Chọn hai ô liền kề để hoán đổi. Xếp ít nhất ba hình giống nhau thành một hàng.'],
  logic: ['Read the clue, then choose the number that fits.', 'Đọc gợi ý rồi chọn số phù hợp.'],
};
const SYMBOLS = ['♥', '✿', '★', '☀', '☾', '◆', '♣', '✦', '●', '▲'];
const LABELS: Localized[] = [
  ['heart', 'trái tim'], ['flower', 'bông hoa'], ['star', 'ngôi sao'], ['sun', 'mặt trời'],
  ['moon', 'mặt trăng'], ['diamond', 'hình thoi'], ['club', 'hình chuồn'], ['sparkle', 'đốm sáng'],
  ['circle', 'hình tròn'], ['triangle', 'tam giác'],
];

@Component({
  selector: 'app-puzzle-battle',
  imports: [FormsModule, PuzzleCanvas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './puzzle-battle.html',
  styleUrl: './puzzle-battle.scss',
})
export class PuzzleBattle {
  readonly room = input.required<PartyRoom>();
  readonly vietnamese = input.required<boolean>();
  protected readonly connection = inject(PartyConnection);
  protected readonly state = computed(() => this.room().state as PuzzleState | null);
  protected readonly settings = computed(() => this.room().settings as Settings);
  private readonly settingsKey = computed(() => JSON.stringify(this.settings()));
  protected readonly options = linkedSignal(() => JSON.parse(this.settingsKey()) as Settings);
  protected readonly changed = computed(() => JSON.stringify(this.options()) !== this.settingsKey());
  protected readonly types = Object.entries(TYPES);
  protected readonly difficulties: Localized[] = [['Easy', 'Dễ'], ['Normal', 'Vừa'], ['Hard', 'Khó']];
  protected readonly clock = signal(Date.now());
  private readonly offset = signal(0);
  private readonly heat = computed(() => [this.room().round, this.state()?.heat].join(':'));
  protected readonly selection = linkedSignal({ source: this.heat,
    computation: () => ({ index: -1, rotation: 0 }) });
  private readonly pending = signal<number | null>(null);
  private readonly sequence = computed(() => this.state()?.sequence);
  protected readonly live = computed(() => this.connection.status() === 'online');
  protected readonly columns = computed(() => this.state()?.board?.size ?? 4);
  protected readonly cells = computed(() => this.boardCells());
  protected readonly preview = computed(() => this.piecePreview());

  constructor() {
    const interval = setInterval(() => this.clock.set(Date.now()), 150);
    inject(DestroyRef).onDestroy(() => clearInterval(interval));
    effect(() => this.offset.set(this.room().serverNow - Date.now()));
    effect(() => {
      this.sequence();
      this.connection.error();
      this.pending.set(null);
    });
  }

  protected local(text: Localized): string { return text[this.vietnamese() ? 1 : 0]; }
  protected tr(en: string, vi: string): string { return this.local([en, vi]); }
  protected typeName(type: Settings['type']): string { return this.local(TYPES[type]); }
  protected instruction(type: PuzzleType): string { return this.local(INSTRUCTIONS[type]); }
  protected symbol(index: number | null): string { return index === null ? '?' : SYMBOLS[index]; }
  protected symbolName(index: number | null): string { return index === null ? this.tr('missing', 'còn thiếu') : this.local(LABELS[index]); }
  protected seconds(target: number): number { return Math.max(0, Math.ceil((target - this.clock() - this.offset()) / 1000)); }
  protected setType(type: Settings['type']): void { this.options.update(options => ({ ...options, type })); }
  protected setDifficulty(difficulty: Settings['difficulty']): void { this.options.update(options => ({ ...options, difficulty: Number(difficulty) as Settings['difficulty'] })); }
  protected save(): void { this.connection.command('configure', this.options()); }
  protected choosePiece(index: number): void { this.selection.set({ index, rotation: this.state()?.board?.placed?.[index]?.rotation ?? 0 }); }
  protected rotate(): void {
    this.selection.update(selection => ({ ...selection, rotation: (selection.rotation + 1) % 4 }));
  }

  protected remove(): void {
    if (this.selection().index >= 0) this.send({ piece: this.selection().index, remove: true });
  }

  protected pick(index: number): void {
    const game = this.state();
    if (!game || !this.live() || this.pending() !== null || this.cells()[index]?.disabled) return;
    const selected = this.selection().index;
    if (game.type === 'blocks') {
      if (selected >= 0) this.send({ index, piece: selected, rotation: this.selection().rotation });
    } else if (game.type === 'match-three') {
      const size = this.columns();
      if (selected === index) {
        this.selection.set({ index: -1, rotation: 0 });
      } else if (selected < 0 || Math.abs(selected % size - index % size) +
          Math.abs(Math.floor(selected / size) - Math.floor(index / size)) !== 1) {
        this.selection.set({ index, rotation: 0 });
      } else {
        this.selection.set({ index: -1, rotation: 0 });
        this.send({ index, from: selected });
      }
    } else {
      this.send({ index });
    }
  }

  private send(move: object): void {
    const game = this.state();
    if (!game || game.stage !== 'race' || game.sequence === undefined || !this.live() || this.pending() !== null) return;
    this.pending.set(game.sequence);
    this.connection.command('play', { heat: game.heat, sequence: game.sequence, move });
  }

  private boardCells(): PuzzleCell[] {
    const game = this.state();
    const board = game?.board;
    if (!game || !board) return [];
    if (board.options) {
      return board.options.map(value => ({
        symbol: game.type === 'patterns' ? this.symbol(value) : String(value),
        label: game.type === 'patterns' ? this.symbolName(value) : String(value),
        tone: value,
        disabled: board.wrong,
      }));
    }
    const columns = this.columns();
    const blank = board.cells?.indexOf(0) ?? -1;
    const selection = this.selection().index;
    return (board.cells ?? []).map((value, index) => {
      const position = this.tr('Cell', 'Ô') + ' ' + (index + 1);
      switch (game.type) {
        case 'memory':
          return { symbol: this.symbol(value), label: position + (value === null ? '' : ' · ' + this.symbolName(value)),
            tone: board.matched?.[index] ? 3 : value ?? undefined, disabled: board.locked || value !== null };
        case 'blocks':
          return { symbol: value === null || value < 0 ? '·' : String(value + 1), label: position,
            tone: value === null || value < 0 ? undefined : value, disabled: selection < 0 };
        case 'sliding':
          return { symbol: value ? String(value) : '', label: value ? this.tr('Tile', 'Mảnh') + ' ' + value : this.tr('Gap', 'Ô trống'),
            picture: value ? { tile: value - 1, size: columns } : undefined,
            disabled: !value || Math.abs(index % columns - blank % columns) +
              Math.abs(Math.floor(index / columns) - Math.floor(blank / columns)) !== 1 };
        default:
          return { symbol: this.symbol(value), label: position + ' · ' + this.symbolName(value),
            tone: value ?? undefined, selected: selection === index };
      }
    });
  }

  private piecePreview(): boolean[] {
    const selection = this.selection();
    const shape = this.state()?.board?.pieces?.[selection.index];
    if (!shape) return [];
    let cells = shape;
    for (let turn = 0; turn < selection.rotation; turn++) cells = cells.map(([x, y]) => [-y, x]);
    const left = Math.min(...cells.map(cell => cell[0]));
    const top = Math.min(...cells.map(cell => cell[1]));
    const filled = new Set(cells.map(([x, y]) => (x - left) + (y - top) * 4));
    return Array.from({ length: 16 }, (_, index) => filled.has(index));
  }
}
