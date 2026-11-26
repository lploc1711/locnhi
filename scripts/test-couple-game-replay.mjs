import assert from 'node:assert/strict';
import test from 'node:test';
import { replay, roomView } from '../src/app/couple-party/engine/replay.js';
import { puzzles, seededRandom } from '../src/app/couple-party/engine/puzzles.js';

const code = '1234567890abcdef1234567890abcdef';
const host = { uid: 'host', name: 'Host' };
const guest = { uid: 'guest', name: 'Guest' };
const meta = { host, guest, game: 'couple-questions' };
const config = { mode: 'guess', count: 1, categories: ['habits'] };
const event = (uid, type, revision, action = {}, at = 100, round = 2) => ({
  uid, type, revision, round, at, kind: action.kind ?? '', prompt: action.kind === 'submit' || action.kind === 'skip' ? '2_0' : '',
  payload: JSON.stringify(action),
});
const setup = value => ({
  1: event('guest', 'join', 0),
  2: event('host', 'configure', 2, value, 100, 1),
  3: event('host', 'ready', 3),
  4: event('guest', 'ready', 3),
});
const missing = async () => undefined;

test('revealed answers determine scores and do not appear in the public log', async () => {
  const events = setup(config);
  events[5] = event('host', 'play', 5, { kind: 'submit', index: 0 });
  let rendered = await replay(code, meta, events, missing);
  assert.deepEqual(roomView(rendered.room, 1).state.submitted, [true, false]);
  assert.equal(roomView(rendered.room, 1).state.responses, undefined);
  events[6] = event('guest', 'play', 5, { kind: 'submit', index: 0 });
  rendered = await replay(code, meta, events, missing);
  assert.equal(rendered.blocked, true);
  assert.equal(roomView(rendered.room, 0).state.responses, undefined);
  const answers = [{ choice: 0, guess: 2 }, { choice: 2, guess: 1 }];
  rendered = await replay(code, meta, events, async () => answers);
  assert.deepEqual(roomView(rendered.room, 1).state.scores, [1, 0]);
  assert.deepEqual(roomView(rendered.room, 0).state.responses, answers);
  events[7] = event('host', 'play', 7, { kind: 'next', index: 0 });
  events[8] = event('guest', 'play', 7, { kind: 'next', index: 0 });
  events[9] = event('host', 'rematch', 9);
  events[10] = event('guest', 'rematch', 9);
  rendered = await replay(code, meta, events, async () => answers);
  assert.equal(rendered.room.round, 3);
  assert.equal(rendered.room.phase, 'PLAYING');
  assert.equal(roomView(rendered.room, 1).state.responses, undefined);
});

test('skipping keeps an unanswered response private', async () => {
  const events = setup({ ...config, mode: 'deep' });
  events[5] = event('host', 'play', 5, { kind: 'submit', index: 0 });
  events[6] = event('guest', 'play', 5, { kind: 'skip', index: 0 });
  const { room } = await replay(code, meta, events, () => { throw new Error('Attempt to read skipped answer'); });
  assert.equal(roomView(room, 1).state.stage, 'skipped');
  assert.equal(roomView(room, 1).state.responses, undefined);
});

test('puzzle replay produces equal initial boards and independent moves', async () => {
  const events = setup({ type: 'memory', difficulty: 0 });
  const puzzleMeta = { ...meta, game: 'puzzle-battle' };
  let rendered = await replay(code, puzzleMeta, events, missing);
  assert.equal(roomView(rendered.room, 0).state.board, undefined);
  events[5] = event('guest', 'tick', 5, {}, 4100);
  rendered = await replay(code, puzzleMeta, events, missing);
  assert.deepEqual(roomView(rendered.room, 0).state.board, roomView(rendered.room, 1).state.board);
  events[6] = event('host', 'play', 6, { heat: 1, sequence: 0, move: { index: 0 } }, 4200);
  rendered = await replay(code, puzzleMeta, events, missing);
  assert.notEqual(roomView(rendered.room, 0).state.board.cells[0], null);
  assert.equal(roomView(rendered.room, 1).state.board.cells[0], null);
  const restored = await replay(code, puzzleMeta, events, missing);
  assert.deepEqual(rendered.room, restored.room);
});

test('all six puzzle types can generate unfinished boards', () => {
  assert.equal(Object.keys(puzzles).length, 6);
  for (const puzzle of Object.values(puzzles)) {
    for (const level of [0, 1, 2]) {
      const board = puzzle.generate(level, seededRandom(71));
      assert.deepEqual(board, puzzle.generate(level, seededRandom(71)));
      assert.ok(puzzle.progress(board) < puzzle.target(board));
    }
  }
});
