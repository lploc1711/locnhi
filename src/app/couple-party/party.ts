import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, type Type } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MemberLayout } from '../shared/member-layout/member-layout';
import { PartyConnection } from './party-connection';
import { PARTY_GAMES } from './games/party-games';
import { VIETNAMESE_FEEDBACK } from './party-feedback';

@Component({
  selector: 'app-party',
  imports: [MemberLayout, RouterLink, NgComponentOutlet],
  providers: [PartyConnection],
  templateUrl: './party.html',
  styleUrl: './party.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Party {
  protected readonly connection = inject(PartyConnection);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly vietnamese = signal(navigator.language.startsWith('vi'));
  protected readonly copied = signal(false);
  protected readonly online = computed(() => this.connection.status() === 'online');
  protected readonly games = PARTY_GAMES;
  private readonly gameId = computed(() => this.connection.room()?.game);
  protected readonly game = computed(() => this.games.find(game => game.id === this.gameId()));
  protected readonly gameView = signal<Type<unknown> | null>(null);
  protected readonly viewFailed = signal(false);
  protected readonly winner = computed(() => {
    const result = this.connection.room()?.result as { winner?: number } | null;
    return result?.winner ?? null;
  });
  private displayedCode = this.route.snapshot.queryParamMap.get('room') ?? '';

  constructor() {
    void this.connection.open(this.displayedCode);
    effect(() => {
      const room = this.connection.room();
      if (room && room.room !== this.displayedCode) this.updateUrl(room.room);
    });
    effect(onCleanup => {
      const game = this.game();
      this.gameView.set(null);
      this.viewFailed.set(false);
      if (game) {
        let current = true;
        onCleanup(() => { current = false; });
        void game.load().then(
          component => { if (current) this.gameView.set(component); },
          () => { if (current) this.viewFailed.set(true); },
        );
      }
    });
  }

  protected text(en: string, vi: string): string {
    return this.vietnamese() ? vi : en;
  }

  protected feedback(message: string): string {
    return this.text(message, VIETNAMESE_FEEDBACK[message] ?? 'Không thể thực hiện thao tác. Hãy thử lại.');
  }

  protected invite(code: string): string {
    return new URL('/games/party?room=' + code, location.origin).href;
  }

  protected async copyInvite(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.invite(code));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected leave(): void {
    this.connection.leave();
    this.copied.set(false);
    this.updateUrl('');
  }

  private updateUrl(code: string): void {
    this.displayedCode = code;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: code ? { room: code } : {},
      replaceUrl: true,
    });
  }
}
