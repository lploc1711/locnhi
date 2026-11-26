import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { get, getDatabase, onDisconnect, onValue, push, ref, remove, serverTimestamp, set, update, type DatabaseReference } from 'firebase/database';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firebase.service';
import { PARTY_ROOM_CODE } from './party-room-code';
import { preview, promptId, replay, roomView, type Answer, type GameEvent, type Meta, type Player, type Room, type RoomView } from './engine/replay.js';

export type PartyRoom = Omit<RoomView, 'players'> & {
  players: { name: string; ready: boolean; connected: boolean }[];
  serverNow: number;
};
type Command = 'ready' | 'play' | 'rematch' | 'select' | 'configure';
type Stream = { head: number; items?: Record<string, GameEvent | null> };
const COLLECTION = 'coupleGames';

@Injectable()
export class PartyConnection {
  private readonly auth = inject(AuthService);
  private readonly db = getDatabase(inject(FirebaseService).app);
  private readonly current = signal<PartyRoom | null>(null);
  private readonly connection = signal<'connecting' | 'online' | 'offline'>('connecting');
  private readonly message = signal('');
  readonly room = this.current.asReadonly();
  readonly status = this.connection.asReadonly();
  readonly error = this.message.asReadonly();

  private meta?: Meta;
  private stream?: Stream;
  private view?: RoomView;
  private roomState?: Room;
  private presence: Record<string, Record<string, true>> = {};
  private presenceRef?: DatabaseReference;
  private confirmedAnswers = new Map<string, Answer[]>();
  private connected = false;
  private offset = 0;
  private roomCode = '';
  private pendingInvite = '';
  private entering = false;
  private writing = false;
  private generation = 0;
  private refreshVersion = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private queued = Promise.resolve();
  private subscriptions: (() => void)[] = [];

  constructor() {
    const stopTime = onValue(ref(this.db, '.info/serverTimeOffset'), snapshot => {
      this.offset = Number(snapshot.val()) || 0;
      this.publish();
      this.schedule();
    });
    const stopConnection = onValue(ref(this.db, '.info/connected'), snapshot => {
      this.connected = snapshot.val() === true;
      this.connection.set(this.connected ? 'online' : 'offline');
      if (this.connected) this.tryInvite();
      else this.presenceRef = undefined;
      void this.markPresent();
      this.schedule();
    });
    inject(DestroyRef).onDestroy(() => { stopTime(); stopConnection(); this.leave(); });
    effect(() => { if (!this.auth.loading() && !this.auth.user()) this.leave(); });
  }

  async open(invite: string): Promise<void> {
    this.pendingInvite = PARTY_ROOM_CODE.test(invite) ? invite : '';
    this.tryInvite();
  }

  create(game: string): void {
    void this.enter(async player => {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
        byte.toString(16).padStart(2, '0')).join('');
      await set(this.path(code), { meta: { host: player, game }, stream: { head: 0 } });
      return code;
    });
  }

  join(input: string): void {
    const code = input.trim().toLowerCase();
    if (!PARTY_ROOM_CODE.test(code)) { this.message.set('Invalid room code.'); return; }
    void this.enter(async player => {
      const head = await get(this.path(code, 'stream/head'));
      if (!head.exists()) throw new Error('Room not found.');
      try {
        const meta = (await get(this.path(code, 'meta'))).val() as Meta | null;
        if (meta?.host.uid === player.uid || meta?.guest?.uid === player.uid) return code;
      } catch { /* A new guest cannot read room metadata until claiming the seat. */ }
      const event = this.event(player, 'join');
      try {
        await this.append(code, event, { 'meta/guest': player });
      } catch (error) {
        const metadata = await get(this.path(code, 'meta')).catch(() => null);
        if ((metadata?.val() as Meta | null)?.guest?.uid !== player.uid) throw error;
      }
      return code;
    });
  }

  leave(): void {
    this.generation++;
    this.refreshVersion++;
    this.entering = false;
    this.writing = false;
    this.pendingInvite = '';
    this.subscriptions.forEach(stop => stop());
    this.subscriptions = [];
    clearTimeout(this.timer);
    clearTimeout(this.retry);
    const previous = this.presenceRef;
    this.presenceRef = undefined;
    if (previous && this.connected) void remove(previous).catch(() => undefined);
    this.roomCode = '';
    this.meta = this.stream = this.view = this.roomState = undefined;
    this.presence = {};
    this.confirmedAnswers = new Map();
    this.current.set(null);
    this.message.set('');
  }

  command(type: Command, action?: object): void {
    const room = this.roomState;
    const player = this.player();
    if (room && player) this.send(this.event(player, type, action, room), action);
  }

  private player(): Player | undefined {
    const user = this.auth.user();
    return user ? { uid: user.uid, name: user.displayName?.trim().slice(0, 60) || 'Player' } : undefined;
  }

  private tryInvite(): void {
    if (!this.connected || !this.pendingInvite) return;
    const invite = this.pendingInvite;
    this.pendingInvite = '';
    this.join(invite);
  }

  private async enter(operation: (player: Player) => Promise<string>): Promise<void> {
    const player = this.player();
    if (!this.connected || this.entering || !player) return;
    this.entering = true;
    const generation = this.generation;
    this.message.set('');
    try {
      const code = await operation(player);
      if (this.generation !== generation) return;
      this.leave();
      this.roomCode = code;
      const subscribed = this.generation;
      this.subscriptions = [
        onValue(this.path(code, 'meta'), snapshot => {
          if (subscribed !== this.generation) return;
          this.meta = snapshot.val() as Meta;
          void this.refresh();
        }, error => this.report(error, subscribed)),
        onValue(this.path(code, 'stream'), snapshot => {
          if (subscribed !== this.generation) return;
          this.stream = snapshot.val() as Stream;
          void this.refresh();
        }, error => this.report(error, subscribed)),
        onValue(this.path(code, 'presence'), snapshot => {
          if (subscribed !== this.generation) return;
          this.presence = snapshot.val() ?? {};
          this.publish();
        }, error => this.report(error, subscribed)),
      ];
      void this.markPresent();
    } catch (error) {
      this.report(error, generation);
    } finally {
      if (this.generation === generation) this.entering = false;
    }
  }

  private async refresh(): Promise<void> {
    if (this.writing || !this.meta || !this.stream) return;
    clearTimeout(this.retry);
    const generation = this.generation;
    const version = ++this.refreshVersion;
    const code = this.roomCode;
    const confirmed = this.confirmedAnswers;
    try {
      const { room, blocked } = await replay(code, this.meta, this.stream.items ?? {}, async (prompt, ids) => {
        if (confirmed.has(prompt)) return confirmed.get(prompt);
        const answers = await Promise.all(ids.map(async uid => {
          const result = await get(this.path(code, `private/${prompt}/answers/${uid}`));
          return result.val() as Answer | null;
        })).catch(() => undefined);
        if (!answers?.every(answer => answer !== null)) return undefined;
        const valid = answers as Answer[];
        confirmed.set(prompt, valid);
        return valid;
      });
      if (generation !== this.generation || version !== this.refreshVersion) return;
      const seat = room.players.findIndex(member => member.uid === this.auth.user()?.uid);
      if (seat < 0) return;
      this.roomState = room;
      this.view = roomView(room, seat);
      this.publish();
      this.schedule();
      if (blocked && this.connected) this.retry = setTimeout(() => { void this.refresh(); }, 450);
    } catch (error) {
      if (version === this.refreshVersion) this.report(error, generation);
    }
  }

  private async markPresent(): Promise<void> {
    const player = this.player();
    if (!this.connected || !this.roomCode || !player || this.presenceRef) return;
    const path = push(this.path(this.roomCode, `presence/${player.uid}`));
    this.presenceRef = path;
    try {
      await onDisconnect(path).remove();
      if (this.presenceRef === path && this.connected) await set(path, true);
    } catch {
      if (this.presenceRef === path) this.presenceRef = undefined;
    }
  }

  private publish(): void {
    if (!this.view) return;
    this.current.set({ ...this.view, serverNow: Date.now() + this.offset,
      players: this.view.players.map(({ uid, ...player }) => ({
        ...player, connected: Object.keys(this.presence[uid] ?? {}).length > 0,
      })),
    });
  }

  private schedule(): void {
    clearTimeout(this.timer);
    const due = this.view?.tickAt;
    const player = this.player();
    if (!this.connected || due == null || !player || !this.roomState) return;
    const delay = Math.max(100, due - Date.now() - this.offset + 55);
    this.timer = setTimeout(() => {
      if (this.roomState) this.send(this.event(player, 'tick', undefined, this.roomState));
    }, delay);
  }

  private event(player: Player, type: string, action?: object, room?: Room): GameEvent {
    const data = (action ?? {}) as { kind?: string; index?: number };
    const kind = type === 'play' ? data.kind ?? '' : '';
    const prompt = room && (kind === 'submit' || kind === 'skip') && typeof data.index === 'number'
      ? promptId(room, data.index) : '';
    const payload = kind === 'submit' ? { kind, index: data.index } : data;
    return { uid: player.uid, type, kind, prompt, payload: JSON.stringify(payload),
      round: room?.round ?? 0, revision: room?.revision ?? 0, at: Date.now() + this.offset };
  }

  private send(event: GameEvent, action?: object): void {
    const generation = this.generation;
    const code = this.roomCode;
    this.queued = this.queued.then(async () => {
      const room = this.roomState;
      const player = this.player();
      if (generation !== this.generation || !room || !player || !this.connected) return;
      if (event.type !== 'tick') this.message.set('');
      this.writing = true;
      this.refreshVersion++;
      try {
        // Preview using the full local submission; the log contains only its marker.
        const local = { ...event, at: Date.now() + this.offset, ...(action ? { payload: JSON.stringify(action) } : {}) };
        if (preview(room, player, local, (this.stream?.head ?? 0) + 1) === room) return;
        const updates: Record<string, unknown> = {};
        const answer = action as Answer | undefined;
        if (event.kind === 'submit' && answer) {
          updates[`private/${event.prompt}/answers/${player.uid}`] = answer.answer?.trim()
            ? { answer: answer.answer.trim() }
            : { choice: answer.choice, ...(typeof answer.guess === 'number' && answer.guess >= 0 ? { guess: answer.guess } : {}) };
        }
        if (event.kind === 'skip') updates[`private/${event.prompt}/skipped`] = player.uid;
        await this.append(code, event, updates);
      } catch (error) {
        if (event.type !== 'tick') this.report(error, generation);
      } finally {
        if (generation === this.generation) {
          this.writing = false;
          await this.refresh();
        }
      }
    });
  }

  private async append(code: string, event: GameEvent, extra: Record<string, unknown>): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const head = (await get(this.path(code, 'stream/head'))).val() as number | null;
      if (head === null) throw new Error('Room not found.');
      try {
        await update(this.path(code), {
          ...extra, 'stream/head': head + 1, [`stream/items/${head + 1}`]: { ...event, at: serverTimestamp() },
        });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        if ((await get(this.path(code, 'stream/head'))).val() === head) {
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
          if ((await get(this.path(code, 'stream/head'))).val() === head) throw error;
        }
      }
    }
  }

  private report(error: unknown, generation: number): void {
    if (this.generation !== generation) return;
    const message = error instanceof Error ? error.message : '';
    this.message.set(/permission.denied/i.test(message) ? 'The room changed or you do not have access.' :
      message || 'Room service is temporarily unavailable.');
  }

  private path(code: string, child = ''): DatabaseReference {
    return ref(this.db, `${COLLECTION}/${code}${child ? '/' + child : ''}`);
  }
}
