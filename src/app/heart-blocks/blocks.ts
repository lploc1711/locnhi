export const SIZE = 8;
export const MAX_MOVES = 2048;
export const ROOM_CODE = /^[0-9a-f]{24}$/;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const shapes = [
  ['1'], ['11'], ['1','1'], ['111'], ['1','1','1'], ['11','11'],
  ['10','11'], ['01','11'], ['11','10'], ['11','01'],
  ['111','010'], ['010','111'], ['110','011'], ['011','110'],
  ['1111'], ['1','1','1','1'], ['100','111'], ['001','111'],
  ['111','111'], ['11','11','11'], ['111','111','111'],
];

export interface Piece {
  width: number;
  height: number;
  cells: readonly (readonly [number, number])[];
  color: number;
}

export interface Game {
  board: number[];
  tray: (Piece | null)[];
  score: number;
  moves: number;
  deal: number;
  streak: number;
  lines: number;
  out: boolean;
  resigned: boolean;
}

function deal(seed: string, index: number): Piece[] {
  let hash = 2166136261;
  for (const char of `${seed}:${index}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const next = () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    return hash >>> 8;
  };
  return Array.from({ length: 3 }, () => {
    const shape = shapes[next() % shapes.length];
    const cells: [number, number][] = [];
    shape.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell === '1') cells.push([x, y]);
    }));
    return { width: shape[0].length, height: shape.length, cells, color: 1 + next() % 5 };
  });
}

export function start(seed: string): Game {
  return {
    board: Array(SIZE * SIZE).fill(0), tray: deal(seed, 0), score: 0, moves: 0,
    deal: 0, streak: 0, lines: 0, out: false, resigned: false,
  };
}

export function fits(board: readonly number[], piece: Piece, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
    x + piece.width <= SIZE && y + piece.height <= SIZE &&
    piece.cells.every(([dx, dy]) => board[(y + dy) * SIZE + x + dx] === 0);
}

export function play(game: Game, seed: string, slot: number, x: number, y: number): Game | null {
  const piece = game.tray[slot];
  if (!piece || game.out || game.resigned || !fits(game.board, piece, x, y)) return null;
  const board = game.board.slice();
  for (const [dx, dy] of piece.cells) board[(y + dy) * SIZE + x + dx] = piece.color;
  const clear = new Set<number>();
  let lines = 0;
  for (let row = 0; row < SIZE; row++) {
    const indices = Array.from({ length: SIZE }, (_, column) => row * SIZE + column);
    if (indices.every(i => board[i])) {
      lines++;
      indices.forEach(i => clear.add(i));
    }
  }
  for (let column = 0; column < SIZE; column++) {
    const indices = Array.from({ length: SIZE }, (_, row) => row * SIZE + column);
    if (indices.every(i => board[i])) {
      lines++;
      indices.forEach(i => clear.add(i));
    }
  }
  clear.forEach(i => board[i] = 0);
  const moves = game.moves + 1;
  const streak = lines ? game.streak + 1 : 0;
  let tray = game.tray.map((item, i) => i === slot ? null : item);
  let dealIndex = game.deal;
  if (tray.every(item => item === null)) tray = deal(seed, ++dealIndex);
  const out = moves >= MAX_MOVES ||
    !tray.some(item => item && board.some((_, i) => fits(board, item, i % SIZE, Math.floor(i / SIZE))));
  return {
    board, tray, moves, deal: dealIndex, streak, lines: game.lines + lines, out, resigned: false,
    score: game.score + 10 * piece.cells.length + 80 * lines +
      40 * Math.max(0, lines - 1) + 20 * Math.max(0, streak - 1),
  };
}

export function moveCode(slot: number, x: number, y: number, out: boolean): string {
  return `${slot}${alphabet[y * SIZE + x]}${out ? '.' : ''}`;
}

export function replay(seed: string, log: string): Game | null {
  let game = start(seed);
  const terminal = log.slice(-1);
  const marked = terminal === '!' || terminal === '.';
  const length = log.length - Number(marked);
  if (length > MAX_MOVES * 2 || length % 2) return null;
  for (let i = 0; i < length; i += 2) {
    const slot = '012'.indexOf(log[i]);
    const index = alphabet.indexOf(log[i+1]);
    if (slot < 0 || index < 0) return null;
    const next = play(game, seed, slot, index % SIZE, Math.floor(index / SIZE));
    if (!next) return null;
    game = next;
  }
  if ((terminal === '.') !== game.out) return null;
  return terminal === '!' ? {...game, resigned: true} : game;
}

export function result(own: Game, other: Game): 'win' | 'loss' | 'tie' | null {
  if (own.resigned && other.resigned) return 'tie';
  if (own.resigned) return 'loss';
  if (other.resigned) return 'win';
  if (!own.out || !other.out) return null;
  return own.score === other.score ? 'tie' : own.score > other.score ? 'win' : 'loss';
}
