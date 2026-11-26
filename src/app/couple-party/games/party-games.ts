import type { Type } from '@angular/core';
import type { PartyRoom } from '../party-connection';
import type { InputSignal } from '@angular/core';

interface PartyGameView {
  room: InputSignal<PartyRoom>;
  vietnamese: InputSignal<boolean>;
}

export interface PartyGame {
  id: string;
  names: [string, string];
  instructions: [string, string];
  load: () => Promise<Type<PartyGameView>>;
}

export const PARTY_GAMES: readonly PartyGame[] = [
  {
    id: 'couple-questions',
    names: ['Couple Questions', 'Hiểu nhau hơn'],
    instructions: ['Answer in private, then reveal and discuss together.',
      'Trả lời riêng, sau đó cùng xem và trò chuyện về câu trả lời.'],
    load: () => import('./couple-questions').then(game => game.CoupleQuestions),
  },
  {
    id: 'puzzle-battle',
    names: ['Puzzle Battle', 'Đấu giải đố'],
    instructions: ['Solve the same puzzles on separate boards. The first to win three rounds wins.',
      'Cùng giải những câu đố giống nhau trên hai bàn riêng. Ai thắng ba vòng trước sẽ thắng trận.'],
    load: () => import('./puzzle-battle').then(game => game.PuzzleBattle),
  },
];
