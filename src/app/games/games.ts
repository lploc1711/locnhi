import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberLayout } from '../shared/member-layout/member-layout';

@Component({
  selector: 'app-games',
  imports: [MemberLayout, RouterLink],
  template: `
    <app-member-layout>
      <section class="games" aria-labelledby="games-title">
        <h1 id="games-title">Games</h1>
        <p>Chọn một trò để chơi cùng người ấy.</p>
        <a class="game-card" routerLink="/games/block-blast">
          <span class="mosaic" aria-hidden="true">
            @for (tile of tiles; track $index) { <i [attr.data-tile]="tile || null"></i> }
          </span>
          <span class="game-copy">
            <strong>Block Blast</strong>
            <span>Xếp khối và so điểm cùng người ấy.</span>
            <span class="launch">Chơi ngay <span aria-hidden="true">→</span></span>
          </span>
        </a>
      </section>
    </app-member-layout>
  `,
  styles: `
    .games { max-width: 640px; margin: auto; padding: clamp(30px, 7vw, 80px) 0; }
    h1 { margin: 0; line-height: 1.1; font-size: clamp(2.3rem, 8vw, 4rem); }
    p { margin: 10px 0 26px; color: var(--muted); }
    .game-card {
      display: grid; grid-template-columns: auto 1fr; align-items: center; gap: clamp(14px, 4vw, 26px);
      padding: clamp(14px, 4vw, 24px); border: 1px solid #ead3e0; border-radius: 22px;
      color: #40243c; background: #fff7fb; text-decoration: none;
      box-shadow: 0 8px 22px #54264410;
    }
    .game-card:hover { border-color: #ba6f97; }
    .game-card:focus-visible { outline: 3px solid #8851b3; outline-offset: 4px; }
    .mosaic {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;
      width: clamp(76px, 22vw, 124px); aspect-ratio: 1;
      padding: 6px; border-radius: 12px; background: #4c304e;
    }
    .mosaic i { border-radius: 4px; background: #634364; }
    .mosaic [data-tile="1"] { background: #ef88ae; }
    .mosaic [data-tile="2"] { background: #b89bea; }
    .mosaic [data-tile="3"] { background: #f5b37d; }
    .mosaic [data-tile="4"] { background: #78c8b5; }
    .game-copy { display: grid; gap: 4px; font-size: .9rem; }
    .game-copy strong { font-size: clamp(1.25rem, 4vw, 1.75rem); }
    .launch { margin-top: 5px; color: #983762; font-weight: 750; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Games {
  protected readonly tiles = [0,1,1,0,1,1,2,2,3,0,0,2,3,3,4,4];
}
