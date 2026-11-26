import bank from './questions.json' with { type: 'json' };
import { integer, requireMove, shuffle } from './game-utils.js';

const byId = new Map(bank.map(question => [question.id, question]));
const limits = {};
for (const { category } of bank) limits[category] = (limits[category] ?? 0) + 1;
const categories = Object.keys(limits);
const modes = ['guess', 'same', 'deep'];

function settings(input) {
  if (!input) return { mode: 'guess', count: 6, categories, limits };
  const { mode, count, categories: selected } = input;
  requireMove(modes.includes(mode) && Number.isSafeInteger(count) && count >= 1 && count <= 12 &&
    Array.isArray(selected) && selected.length > 0 && selected.length <= categories.length,
  'Choose a mode, categories, and between 1 and 12 questions.');
  requireMove(new Set(selected).size === selected.length && selected.every(category => categories.includes(category)),
    'Invalid category selection.');
  requireMove(selected.reduce((total, category) => total + limits[category], 0) >= count,
    'Choose more categories or fewer questions.');
  return { mode, count, categories: selected, limits };
}

function start(config, now, random) {
  const queue = shuffle(bank.filter(question => config.categories.includes(question.category)), random)
    .slice(0, config.count).map(question => question.id);
  return next({ queue, mode: config.mode, scores: [0, 0], matches: 0, answered: 0, skipped: 0 }, 0);
}

function next(state, index) {
  return Object.assign(state, { index, stage: 'answer', responses: [null, null], next: [false, false], discussion: [] });
}

function submit(state, seat, action) {
  requireMove(!state.responses[seat], 'Answer already submitted.');
  const size = byId.get(state.queue[state.index]).choices.length;
  const choice = value => integer(value, 0, size - 1, 'Select an answer for each choice.');
  state.responses[seat] = state.mode === 'deep'
    ? { text: text(action.answer, 500, 'Enter an answer up to 500 characters.') }
    : { choice: choice(action.choice), ...(state.mode === 'guess' ? { guess: choice(action.guess) } : {}) };
  if (!state.responses.every(Boolean)) return;
  state.stage = 'revealed';
  state.answered++;
  if (state.mode === 'guess') {
    for (const player of [0, 1]) {
      if (state.responses[player].guess === state.responses[1 - player].choice) state.scores[player]++;
    }
  }
  if (state.mode === 'same' && state.responses[0].choice === state.responses[1].choice) state.matches++;
}

function play(state, seat, action) {
  requireMove(action.index === state.index, 'That question has already changed.');
  switch (action.kind) {
    case 'submit':
      requireMove(state.stage === 'answer', 'This question is already closed.');
      submit(state, seat, action);
      break;
    case 'skip':
      requireMove(state.stage === 'answer', 'This question is already closed.');
      state.stage = 'skipped';
      state.skipped++;
      state.responses = [null, null];
      break;
    case 'discuss':
      requireMove(state.stage === 'revealed', 'This question is already closed.');
      requireMove(state.discussion.length < 24, "This question's discussion is full.");
      state.discussion.push({ seat, message: text(action.message, 300, 'Enter a message up to 300 characters.') });
      break;
    case 'next':
      requireMove(state.stage === 'revealed' || state.stage === 'skipped', 'Finish this question first.');
      state.next[seat] = true;
      if (!state.next.every(Boolean)) break;
      if (state.index + 1 < state.queue.length) {
        next(state, state.index + 1);
        break;
      }
      const { mode, scores, matches, answered, skipped } = state;
      const winner = scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1;
      state.stage = 'finished';
      state.responses = [null, null];
      delete state.discussion;
      return { mode, scores, matches, answered, skipped, ...(mode === 'guess' ? { winner } : {}) };
    default:
      requireMove(false, 'Unknown question action.');
  }
}

function text(value, limit, message) {
  requireMove(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit, message);
  return value.trim();
}

function view(state) {
  const { mode, stage, index, scores, matches, answered, skipped, next } = state;
  const summary = { mode, stage, index, scores, matches, answered, skipped, next };
  if (stage === 'finished') return summary;
  return { ...summary, question: byId.get(state.queue[index]), count: state.queue.length,
    submitted: state.responses.map(Boolean),
    ...(stage === 'revealed' ? { responses: state.responses, discussion: state.discussion } : {}) };
}

export const questions = { settings, start, play, view };
