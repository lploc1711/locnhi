import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject,
  input, output, signal, viewChild,
} from '@angular/core';
import type Phaser from 'phaser';

export interface PuzzleCell {
  symbol: string;
  label: string;
  tone?: number;
  selected?: boolean;
  disabled?: boolean;
  picture?: { tile: number; size: number };
}

const TILE = 96;
const COLORS = [0xffd6e6, 0xf5d7a3, 0xe4d4ff, 0xccecdc, 0xcae8ff, 0xf9d7bf, 0xe3e9af, 0xe9d9eb];

@Component({
  selector: 'app-puzzle-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board" [style.aspect-ratio]="columns() + '/' + rows()" [style.--columns]="columns()">
      <div #canvasMount class="canvas" aria-hidden="true"></div>
      <div class="controls" [class.overlay]="canvasReady()" [attr.aria-label]="label()" role="group">
        @for (cell of cells(); track $index) {
          <button type="button" [attr.aria-label]="cell.label" [disabled]="cell.disabled" [class.selected]="cell.selected"
            (click)="pick.emit($index)"><span aria-hidden="true">{{ cell.symbol }}</span></button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .board { width: min(100%, 480px); position: relative; margin: 10px auto; }
    .canvas, .controls { position: absolute; inset: 0; }
    .controls { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); }
    .controls button { margin: 3px; padding: 0; cursor: pointer; border: 1px solid #987084;
      border-radius: 10px; background: #ffe6ef; color: #47283e; font: 700 clamp(1rem, 5vw, 1.85rem) system-ui; }
    .controls button.selected { border: 3px solid #82395f; }
    .controls button:focus-visible { outline: 3px solid #5e286d; outline-offset: 1px; }
    .controls.overlay { pointer-events: none; }
    .controls.overlay button { background: transparent; border-color: transparent; }
    .controls.overlay span { opacity: 0; }
    .controls button:disabled { cursor: default; }
  `,
})
export class PuzzleCanvas {
  readonly cells = input.required<readonly PuzzleCell[]>();
  readonly columns = input.required<number>();
  readonly label = input.required<string>();
  readonly pick = output<number>();
  protected readonly rows = computed(() => Math.ceil(this.cells().length / this.columns()));
  protected readonly canvasReady = signal(false);
  private readonly mount = viewChild.required<ElementRef<HTMLElement>>('canvasMount');
  private game?: Phaser.Game;
  private redraw?: (cells: readonly PuzzleCell[]) => void;
  private destroyed = false;
  private dimensions = '';

  constructor() {
    afterNextRender(() => void this.start());
    effect(() => {
      const cells = this.cells();
      const dimensions = this.columns() + ':' + this.rows();
      if (this.game && this.dimensions !== dimensions) {
        this.stop();
        void this.start();
      } else {
        this.redraw?.(cells);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stop();
    });
  }

  private async start(): Promise<void> {
    try {
      const phaser = await import('phaser/dist/phaser.esm.js');
      if (this.destroyed) return;
      const columns = this.columns();
      const rows = this.rows();
      if (!columns || !rows) return;
      this.dimensions = columns + ':' + rows;
      const component = this;
      class BoardScene extends phaser.Scene {
        private cells?: Phaser.GameObjects.Container;
        private previous: readonly PuzzleCell[] = [];

        create(): void {
          component.redraw = cells => this.renderBoard(cells);
          this.renderBoard(component.cells());
          component.canvasReady.set(true);
        }

        private renderBoard(cells: readonly PuzzleCell[]): void {
          this.cells?.destroy(true);
          this.cells = this.add.container();
          for (const [index, cell] of cells.entries()) {
            const x = (index % columns + .5) * TILE;
            const y = (Math.floor(index / columns) + .5) * TILE;
            const frame = this.add.graphics();
            const color = cell.tone === undefined ? 0xfcebf3 : COLORS[cell.tone % COLORS.length];
            frame.fillStyle(color).fillRoundedRect(x - 44, y - 44, 88, 88, 15);
            if (cell.picture) {
              const { tile, size } = cell.picture;
              frame.fillStyle(0xe999b8);
              for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                  const px = ((tile % size) * 8 + col + .5) / (size * 8) * 3 - 1.5;
                  const py = 1.65 - (Math.floor(tile / size) * 8 + row + .5) / (size * 8) * 3;
                  if ((px * px + py * py - 1) ** 3 - px * px * py ** 3 < 0) {
                    frame.fillRect(x - 40 + col * 10, y - 40 + row * 10, 10, 10);
                  }
                }
              }
            }
            frame.lineStyle(cell.selected ? 5 : 2, cell.selected ? 0x80305d : 0xb789a2)
              .strokeRoundedRect(x - 44, y - 44, 88, 88, 15);
            const caption = this.add.text(x, y, cell.symbol, {
              color: '#4b2440', fontFamily: 'system-ui, sans-serif', fontSize: cell.symbol.length > 2 ? '29px' : '38px',
              fontStyle: 'bold',
            }).setOrigin(.5);
            this.cells.add([frame, caption]);
            if (!cell.disabled) {
              const hit = this.add.zone(x, y, 88, 88).setInteractive({ useHandCursor: true });
              hit.on('pointerup', () => component.pick.emit(index));
              this.cells.add(hit);
            }
            if (this.previous[index] && this.previous[index].symbol !== cell.symbol) {
              caption.setAlpha(.35);
              this.tweens.add({ targets: caption, alpha: 1, duration: 180 });
            }
          }
          this.previous = cells;
        }
      }
      this.game = new phaser.Game({
        type: phaser.CANVAS,
        parent: this.mount().nativeElement,
        backgroundColor: '#fff7fb',
        width: columns * TILE,
        height: rows * TILE,
        scale: { mode: phaser.Scale.FIT, autoCenter: phaser.Scale.CENTER_BOTH },
        scene: BoardScene,
        audio: { noAudio: true },
        input: { keyboard: false, gamepad: false },
      });
    } catch {
      this.canvasReady.set(false);
    }
  }

  private stop(): void {
    this.redraw = undefined;
    this.game?.destroy(true);
    this.game = undefined;
    this.canvasReady.set(false);
  }
}
