import { change, create, roomView } from './rooms.js';
import { GameError } from './game-utils.js';
import { seededRandom } from './puzzles.js';

export { roomView };

function randomFor(code, number) {
  let seed = number;
  for (const digit of code) seed = Math.imul(seed ^ digit.charCodeAt(0), 0x45d9f3b);
  return seededRandom(seed);
}

function transition(room, player, event, number, answer) {
  const action = JSON.parse(event.payload);
  if (!action || typeof action !== 'object' || Array.isArray(action) ||
      (event.type === 'play' && (action.kind ?? '') !== event.kind) ||
      (event.type !== 'play' && event.kind !== '')) throw new GameError('Invalid room command.');
  return change(room, player, { ...event, action: answer ? { ...action, ...answer } : action },
    event.at, randomFor(room.code, number));
}

export function promptId(room, index) { return `${room.round}_${index}`; }

export function preview(room, player, event, number) {
  return transition(room, player, event, number);
}

export async function replay(code, meta, events, readAnswers) {
  let room = create(code, meta.game, meta.host);
  const ordered = Object.entries(events ?? {}).filter(([, event]) => event).sort(([a], [b]) => Number(a) - Number(b));
  for (const [number, event] of ordered) {
    const player = event.uid === meta.host.uid ? meta.host : meta.guest?.uid === event.uid ? meta.guest : null;
    if (!player) continue;
    try {
      if (event.kind !== 'submit') {
        if (event.kind === 'skip' && (room.game !== 'couple-questions' ||
            event.prompt !== promptId(room, room.state?.index))) continue;
        room = transition(room, player, event, Number(number));
        continue;
      }
      const seat = room.players.findIndex(member => member.uid === player.uid);
      const state = room.state;
      if (room.game !== 'couple-questions' || room.phase !== 'PLAYING' || state.stage !== 'answer' ||
          seat < 0 || event.prompt !== promptId(room, state.index) || state.responses[seat]) continue;
      if (!state.responses[1 - seat]) {
        room = transition(room, player, event, Number(number),
          state.mode === 'deep' ? { answer: 'Hidden until reveal' } : { choice: 0, guess: 0 });
        continue;
      }
      const answers = await readAnswers(event.prompt, room.players.map(member => member.uid));
      if (!answers) return { room, blocked: true };
      const revealed = structuredClone(room);
      const partner = answers[1 - seat];
      revealed.state.responses[1 - seat] = state.mode === 'deep' ? { text: partner.answer } : partner;
      room = transition(revealed, player, event, Number(number), answers[seat]);
    } catch (error) {
      if (!(error instanceof GameError || error instanceof SyntaxError)) throw error;
    }
  }
  return { room, blocked: false };
}
