import { integer, requireMove, shuffle } from './game-utils.js';
import { puzzles } from './puzzles.js';

const types = Object.keys(puzzles);
const countdown = 4000;
const roundBreak = 5000;
const matchLimit = 600000;

function settings(input) {
  if (!input) return { type: 'mix', difficulty: 1 };
  requireMove(input.type === 'mix' || types.includes(input.type), 'Choose a puzzle type.');
  return { type: input.type, difficulty: integer(input.difficulty, 0, 2) };
}

function start(options, now, random) {
  return nextRound({ options, endsAt: now + matchLimit, wins: [0, 0], history: [], queue: [] }, 1, now, random);
}

function nextRound(state, heat, now, random) {
  const { difficulty } = state.options;
  let { type } = state.options;
  if (type === 'mix') {
    if (!state.queue.length) state.queue = shuffle(types, random);
    type = state.queue.shift();
  }
  const initial = puzzles[type].generate(difficulty, random);
  return Object.assign(state, {
    stage: 'countdown', type, heat, startsAt: now + countdown, nextAt: null,
    deadline: Math.min(state.endsAt, now + countdown + (45 + difficulty * 15) * 1000),
    boards: [initial, structuredClone(initial)], sequences: [0, 0],
  });
}

function play(state, seat, action, now) {
  requireMove(state.stage === 'race' && now < state.deadline, 'Wait for the next puzzle.');
  requireMove(action.heat === state.heat, 'That puzzle has already changed.');
  requireMove(action.sequence === state.sequences[seat], 'The board changed. Try again.');
  requireMove(action.move && typeof action.move === 'object' && !Array.isArray(action.move), 'Choose a valid puzzle move.');
  const puzzle = puzzles[state.type];
  const board = state.boards[seat];
  puzzle.move(board, action.move, now);
  state.sequences[seat]++;
  if (puzzle.progress(board) >= puzzle.target(board)) return roundFinished(state, seat, now);
}

function tickAt(state, seat) {
  switch (state.stage) {
    case 'countdown': return Math.min(state.startsAt, state.endsAt);
    case 'round-result': return Math.min(state.nextAt, state.endsAt);
    case 'race': {
      const puzzle = puzzles[state.type];
      const boards = seat === undefined ? state.boards : [state.boards[seat]];
      return Math.min(state.deadline, ...boards.map(board => puzzle.tickAt?.(board) ?? Infinity));
    }
    default: return null;
  }
}

function tick(state, now, random) {
  if (now >= state.endsAt) {
    return state.stage === 'race' ? roundFinished(state, -1, now) : finish(state, -1);
  }
  if (state.stage === 'countdown') {
    if (now >= state.deadline) return roundFinished(state, -1, now);
    state.stage = 'race';
  } else if (state.stage === 'round-result') {
    nextRound(state, state.heat + 1, now, random);
  } else if (state.stage === 'race') {
    if (now >= state.deadline) return roundFinished(state, -1, now);
    const puzzle = puzzles[state.type];
    state.boards.forEach((board, seat) => {
      const due = puzzle.tickAt?.(board);
      if (due != null && now >= due) {
        puzzle.tick(board);
        state.sequences[seat]++;
      }
    });
  }
}

function roundFinished(state, winner, now) {
  const puzzle = puzzles[state.type];
  state.history.push({ heat: state.heat, type: state.type, winner,
    elapsedMs: Math.min(now, state.deadline) - state.startsAt,
    progress: state.boards.map(puzzle.progress), target: puzzle.target(state.boards[0]) });
  if (winner >= 0 && ++state.wins[winner] === 3) return finish(state, winner);
  if (now >= state.endsAt) return finish(state, -1);
  delete state.boards;
  delete state.sequences;
  state.stage = 'round-result';
  state.nextAt = now + roundBreak;
}

function finish(state, winner) {
  delete state.boards;
  delete state.sequences;
  state.stage = 'finished';
  state.timeLimitReached = winner < 0;
  return { wins: state.wins, history: state.history, timeLimitReached: state.timeLimitReached,
    ...(winner >= 0 ? { winner } : {}) };
}

function view(state, seat) {
  const { type, heat, stage, startsAt, deadline, nextAt, wins, history, timeLimitReached } = state;
  const snapshot = { type, heat, stage, startsAt, deadline, nextAt, wins, history, timeLimitReached };
  if (stage === 'race') {
    const puzzle = puzzles[type];
    const board = state.boards[seat];
    Object.assign(snapshot, { board: puzzle.view(board), sequence: state.sequences[seat],
      progress: puzzle.progress(board), opponentProgress: puzzle.progress(state.boards[1 - seat]), target: puzzle.target(board) });
  }
  return snapshot;
}

export const puzzleBattle = { settings, start, play, view, tickAt, tick };
