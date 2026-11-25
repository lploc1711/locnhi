import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { MemberLayout } from '../shared/member-layout/member-layout';
import { Piece, ROOM_CODE, SIZE, fits, moveCode, play, replay, result } from './blocks';
import { Room, RoomService } from './room.service';

interface Drag {
  pointer: number;
  slot: number;
  fromX: number;
  fromY: number;
  moved: boolean;
}

@Component({
  selector: 'app-heart-blocks',
  imports: [FormsModule, MemberLayout],
  templateUrl: './heart-blocks.html',
  styleUrl: './heart-blocks.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeartBlocks {
  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly arena = viewChild<ElementRef<HTMLElement>>('arena');
  private stopWatching?: () => void;
  private generation = 0;
  private drag?: Drag;

  protected readonly size = SIZE;
  protected readonly room = signal<Room | null>(null);
  protected readonly code = signal('');
  protected readonly joinCode = signal('');
  protected readonly busy = signal(false);
  protected readonly saving = signal(false);
  protected readonly online = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly selected = signal<number | null>(null);
  protected readonly hover = signal<{x: number; y: number} | null>(null);
  protected readonly keyboardCell = signal(0);
  protected readonly confirmForfeit = signal(false);
  protected readonly uid = computed(() => this.auth.user()?.uid ?? '');
  protected readonly otherId = computed(() => {
    const room = this.room();
    return room?.host === this.uid() ? room?.guest ?? '' : room?.host ?? '';
  });
  protected readonly match = computed(() => this.room()?.matches?.[this.room()!.round]);
  protected readonly seed = computed(() => `${this.code()}:${this.room()?.round ?? 1}`);
  protected readonly ownLog = computed(() => this.match()?.logs?.[this.uid()] ?? '');
  protected readonly own = computed(() => replay(this.seed(), this.ownLog()));
  protected readonly other = computed(() =>
    replay(this.seed(), this.match()?.logs?.[this.otherId()] ?? ''));
  protected readonly outcome = computed(() => {
    const own = this.own();
    const other = this.other();
    return own && other ? result(own, other) : null;
  });
  protected readonly ready = computed(() => this.match()?.ready?.[this.uid()] === true);
  protected readonly otherReady = computed(() => this.match()?.ready?.[this.otherId()] === true);
  protected readonly canPlay = computed(() =>
    !!(this.room()?.guest && this.online() && !this.saving() && !this.outcome() &&
      this.own() && this.other() && !this.own()!.out && !this.confirmForfeit()));
  protected readonly highlight = computed(() => {
    const point = this.hover();
    const slot = this.selected();
    const game = this.own();
    const piece = slot === null ? null : game?.tray[slot];
    if (!point || !piece || !game) return { cells: new Set<number>(), valid: false };
    return {
      cells: new Set(piece.cells.filter(([x,y]) =>
        point.x+x >= 0 && point.x+x < SIZE && point.y+y >= 0 && point.y+y < SIZE
      ).map(([x,y]) => (point.y+y)*SIZE+point.x+x)),
      valid: fits(game.board, piece, point.x, point.y),
    };
  });

  constructor() {
    const stopConnection = this.rooms.connection(value => this.online.set(value));
    const subscription = this.route.queryParamMap.subscribe(params => {
      const code = params.get('room') ?? '';
      if (!code) {
        this.resetView();
        return;
      }
      if (code !== this.code()) void this.open(code);
    });
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
      this.stopWatching?.();
      stopConnection();
      subscription.unsubscribe();
    });
  }

  protected async create() {
    if (this.busy() || !this.online()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const code = await this.rooms.create(this.uid());
      await this.navigate(code);
    } catch {
      this.error.set('Không tạo được phòng. Thử lại nhé!');
    } finally {
      this.busy.set(false);
    }
  }

  protected async join() {
    const code = this.joinCode().trim().toLowerCase();
    if (!ROOM_CODE.test(code)) {
      this.error.set('Mã phòng có 24 ký tự. Bạn cũng có thể mở liên kết mời.');
      return;
    }
    await this.navigate(code);
  }

  private navigate(code: string | null) {
    return this.router.navigate([], { relativeTo: this.route, queryParams: { room: code } });
  }

  private resetView() {
    this.generation++;
    this.stopWatching?.();
    this.stopWatching = undefined;
    this.code.set('');
    this.room.set(null);
    this.busy.set(false);
    this.saving.set(false);
    this.confirmForfeit.set(false);
    this.clearSelection();
  }

  private async open(code: string) {
    this.resetView();
    this.notice.set('');
    this.error.set('');
    if (!ROOM_CODE.test(code)) {
      this.error.set('Liên kết phòng không hợp lệ.');
      return;
    }
    const generation = this.generation;
    this.busy.set(true);
    try {
      await this.rooms.join(code, this.uid());
      if (generation !== this.generation) return;
      this.stopWatching = this.rooms.watch(code, room => {
        if (generation !== this.generation) return;
        const previous = this.room();
        if (previous?.round !== room?.round) {
          this.clearSelection();
          this.confirmForfeit.set(false);
          this.keyboardCell.set(0);
        }
        this.code.set(code);
        this.room.set(room);
        this.busy.set(false);
        if (!room) this.error.set('Không tìm thấy phòng này.');
      }, () => {
        if (generation !== this.generation) return;
        this.busy.set(false);
        this.error.set('Không đọc được phòng. Hãy mở lại liên kết mời.');
      });
    } catch {
      if (generation !== this.generation) return;
      this.busy.set(false);
      this.error.set('Không tham gia được. Phòng không tồn tại, đã đủ hai người hoặc kết nối bị gián đoạn.');
    }
  }

  protected inviteUrl() {
    const url = new URL(location.href);
    url.search = new URLSearchParams({room: this.code()}).toString();
    url.hash = '';
    return url.href;
  }

  protected async copyInvite() {
    try {
      await navigator.clipboard.writeText(this.inviteUrl());
      this.notice.set('Đã sao chép liên kết!');
    } catch {
      this.notice.set('Bạn có thể sao chép liên kết trong ô bên trên.');
    }
  }

  protected exit() {
    this.error.set('');
    this.notice.set('');
    void this.navigate(null);
  }

  protected select(slot: number) {
    if (!this.canPlay() || !this.own()?.tray[slot]) return;
    this.selected.set(slot);
    this.hover.set(null);
    this.notice.set('');
  }

  protected previewCell(index: number) {
    if (!this.drag?.moved) this.hover.set({x: index % SIZE, y: Math.floor(index / SIZE)});
  }

  protected async placeCell(index: number) {
    await this.place(index % SIZE, Math.floor(index / SIZE));
  }

  protected boardKey(event: KeyboardEvent, index: number) {
    const step: Record<string, number> = { ArrowUp: -SIZE, ArrowDown: SIZE, ArrowLeft: -1, ArrowRight: 1 };
    if (event.key === 'Escape') { this.clearSelection(); return; }
    if (!(event.key in step)) return;
    event.preventDefault();
    const target = Math.max(0, Math.min(SIZE * SIZE-1, index + step[event.key]));
    this.keyboardCell.set(target);
    this.arena()?.nativeElement.querySelector<HTMLElement>(`[data-cell="${target}"]`)?.focus();
  }

  protected dragStart(event: PointerEvent, slot: number) {
    if (!event.isPrimary || event.button !== 0 || !this.canPlay()) return;
    this.select(slot);
    this.drag = { pointer: event.pointerId, slot, fromX: event.clientX, fromY: event.clientY, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected dragMove(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.fromX, event.clientY - drag.fromY) > 6) drag.moved = true;
    if (drag.moved) this.hover.set(this.dragPoint(event, drag.slot));
  }

  protected dragEnd(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    this.drag = undefined;
    const point = this.dragPoint(event, drag.slot);
    this.hover.set(null);
    if (drag.moved && point) void this.place(point.x, point.y);
  }

  protected cancelDrag() { this.drag = undefined; this.hover.set(null); }

  private dragPoint(event: PointerEvent, slot: number) {
    const bounds = this.arena()?.nativeElement.getBoundingClientRect();
    const piece = this.own()?.tray[slot];
    if (!bounds || !piece || !bounds.width || event.clientX < bounds.left ||
        event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) return null;
    return {
      x: Math.round((event.clientX-bounds.left)/bounds.width*SIZE-piece.width/2),
      y: Math.round((event.clientY-bounds.top)/bounds.height*SIZE-piece.height/2),
    };
  }

  protected pieceCells(piece: Piece) {
    return Array.from({length: piece.width*piece.height}, (_, i) =>
      piece.cells.some(([x,y]) => y*piece.width+x===i));
  }

  private clearSelection() {
    this.drag = undefined;
    this.selected.set(null);
    this.hover.set(null);
  }

  private async place(x: number, y: number) {
    const game = this.own();
    const slot = this.selected();
    if (!game || slot === null || !this.canPlay()) return;
    const next = play(game, this.seed(), slot, x, y);
    if (!next) {
      this.notice.set('Khối này chưa vừa. Thử ô khác nhé.');
      return;
    }
    await this.saveMove(moveCode(slot, x, y, next.out), next.lines-game.lines);
  }

  private async saveMove(command: string, cleared = 0) {
    const room = this.room();
    if (!room || this.saving() || !this.online()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.rooms.append(this.code(), room.round, this.uid(), this.ownLog(), command);
      this.clearSelection();
      this.notice.set(cleared ? `Đã xóa ${cleared} hàng hoặc cột!` : '');
    } catch {
      this.error.set('Chưa lưu được lượt đi. Vui lòng thử lại.');
    } finally {
      this.saving.set(false);
      this.confirmForfeit.set(false);
    }
  }

  protected async forfeit() {
    if (!this.outcome() && this.own() && !this.own()!.out) await this.saveMove('!');
  }

  protected async playAgain() {
    const room = this.room();
    if (!room || (!this.outcome() && !this.own()?.out) || this.saving() ||
        !this.online() || room.round >= 20) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.rooms.requestRematch(this.code(), room.round, this.uid(), this.otherId());
    } catch {
      this.error.set('Chưa mở được ván mới. Hãy thử lại.');
    } finally {
      this.saving.set(false);
    }
  }
}
