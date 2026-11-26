import { requireMove } from './game-utils.js';
import { questions } from './questions.js';
import { puzzleBattle } from './puzzle-battle.js';

const games = new Map([['couple-questions', questions], ['puzzle-battle', puzzleBattle]]);

function gameFor(id) {
  requireMove(games.has(id), 'Game unavailable.');
  return games.get(id);
}

export function create(code, game, player) {
  return { code, game, round: 1, revision: 1, phase: 'WAITING', players: [player], votes: [false, false],
    settings: gameFor(game).settings(), state: null, result: null };
}

export function change(current, player, command, now, random) {
  const room = structuredClone(current);
  const game = gameFor(room.game);
  const seat = room.players.findIndex(member => member.uid === player.uid);
  if (command.type === 'join') {
    if (seat >= 0) return current;
    requireMove(room.players.length === 1, 'This room already has two players.');
    room.players.push(player);
    room.phase = 'READY';
  } else {
    requireMove(seat >= 0, 'Open the room first.');
    if (command.type === 'tick') {
      if (room.phase !== 'PLAYING') return current;
      const due = game.tickAt?.(room.state);
      if (due == null || now < due) return current;
      complete(room, game.tick(room.state, now, random));
    } else {
      const exact = command.type === 'select' || command.type === 'configure';
      requireMove(command.round === room.round && Number.isSafeInteger(command.revision) && command.revision >= 1 &&
        command.revision <= room.revision && (!exact || command.revision === room.revision),
      'The room changed. Try again.');
      const action = command.action ?? {};
      switch (command.type) {
        case 'ready':
        case 'rematch': {
          const rematch = command.type === 'rematch';
          requireMove(room.phase === (rematch ? 'RESULTS' : 'READY') && room.players.length === 2,
            'Both players must be seated at the correct stage.');
          if (room.votes[seat]) return current;
          room.votes[seat] = true;
          if (room.votes.every(Boolean)) {
            room.round += Number(rematch);
            room.phase = 'PLAYING';
            room.votes = [false, false];
            room.state = game.start(room.settings, now, random);
            room.result = null;
          }
          break;
        }
        case 'select':
        case 'configure': {
          requireMove(seat === 0 && room.phase !== 'PLAYING', 'The host can choose a game between matches.');
          const selecting = command.type === 'select';
          if (selecting && action.game === room.game && room.phase !== 'RESULTS') return current;
          room.game = selecting ? action.game : room.game;
          room.settings = gameFor(room.game).settings(selecting ? undefined : action);
          room.round++;
          room.phase = room.players.length === 2 ? 'READY' : 'WAITING';
          room.votes = [false, false];
          room.state = room.result = null;
          break;
        }
        case 'play':
          requireMove(room.phase === 'PLAYING', 'The game is not active.');
          complete(room, game.play(room.state, seat, action, now));
          break;
        default:
          requireMove(false, 'Unknown room command.');
      }
    }
  }
  room.revision++;
  return room;
}

function complete(room, result) {
  if (result) {
    room.result = result;
    room.phase = 'RESULTS';
  }
}

export function roomView(room, seat) {
  const game = gameFor(room.game);
  return {
    type: 'room', room: room.code, game: room.game, phase: room.phase, round: room.round, revision: room.revision,
    seat, players: room.players.map(({ uid, name }, index) => ({ uid, name, ready: room.votes[index] })),
    state: room.state ? game.view(room.state, seat) : null, result: room.result, settings: room.settings,
    tickAt: room.phase === 'PLAYING' ? game.tickAt?.(room.state, seat) ?? null : null,
  };
}
