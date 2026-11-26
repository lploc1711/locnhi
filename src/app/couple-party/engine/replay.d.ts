export interface Player { uid: string; name: string }
export interface Meta { game: string; host: Player; guest?: Player }
export interface Answer { answer?: string; choice?: number; guess?: number }
export interface GameEvent {
  uid: string;
  type: string;
  kind: string;
  prompt: string;
  round: number;
  revision: number;
  payload: string;
  at: number;
}
export interface Room {
  code: string;
  game: string;
  phase: 'WAITING' | 'READY' | 'PLAYING' | 'RESULTS';
  round: number;
  revision: number;
  players: Player[];
}
export interface RoomView {
  type: 'room';
  room: string;
  game: string;
  phase: Room['phase'];
  round: number;
  revision: number;
  seat: number;
  players: (Player & { ready: boolean })[];
  state: unknown;
  result: unknown;
  settings: unknown;
  tickAt: number | null;
}
export function roomView(room: Room, seat: number): RoomView;
export function promptId(room: Room, index: number): string;
export function preview(room: Room, player: Player, event: GameEvent, number: number): Room;
export function replay(code: string, meta: Meta, events: Record<string, GameEvent | null>,
  readAnswers: (prompt: string, ids: string[]) => Promise<Answer[] | undefined>): Promise<{ room: Room; blocked: boolean }>;
