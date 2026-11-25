import { describe, expect, it } from 'vitest';
import { Game, Piece, SIZE, fits, moveCode, play, replay, result, start } from './blocks';

const seed = 'same-invitation:1';
const block: Piece = {width: 1, height: 1, cells: [[0,0]], color: 1};

describe('Heart Blocks rules', () => {
  it('deals the same shapes to each player in a round and replays legal moves', () => {
    const initial = start(seed);
    const move = play(initial, seed, 0, 0, 0);
    expect(move).not.toBeNull();
    expect(replay(seed, moveCode(0,0,0,false))).toEqual(move);
    expect(move!.score).toBe(initial.tray[0]!.cells.length * 10);
    expect(initial.board.every(cell => cell===0)).toBe(true);
    expect(play(move!,seed,0,4,4)).toBeNull();
  });

  it('rejects overlaps, out-of-board placement, incorrect terminals, and illegal logs', () => {
    const initial = start(seed);
    expect(fits(initial.board, block, 8, 0)).toBe(false);
    initial.board[0] = 3;
    expect(fits(initial.board, block, 0, 0)).toBe(false);
    expect(replay(seed,'0A0B')).toBeNull();
    expect(replay(seed,'0A.')).toBeNull();
    expect(replay(seed,'0A!1B')).toBeNull();
  });

  it('clears a completed row and column together and awards the multi-line bonus', () => {
    const game: Game = { ...start(seed), tray:[block,block,null] };
    for (let i=1; i<SIZE; i++) {
      game.board[i] = 1;
      game.board[i*SIZE] = 1;
    }
    const next = play(game, seed, 0, 0, 0)!;
    expect(next.board.every(cell => cell===0)).toBe(true);
    expect(next.lines).toBe(2);
    expect(next.score).toBe(210);
    expect(next.tray).toEqual([null,block,null]);
    const nextDeal = play(next, seed, 1, 1, 1)!;
    expect(nextDeal.tray.filter(Boolean)).toHaveLength(3);
    expect(nextDeal.deal).toBe(1);
  });

  it('ends a board when none of the remaining pieces fits', () => {
    const wide: Piece = {width:2,height:1,cells:[[0,0],[1,0]],color:1};
    const game = { ...start(seed), tray:[block,wide,null] };
    game.board = Array.from({length:64}, (_, i)=> (i%8 + Math.floor(i/8))%2);
    const next = play(game, seed, 0, 0, 0)!;
    expect(next.out).toBe(true);
    expect(play(next, seed, 1, 1, 0)).toBeNull();
  });

  it('compares finished scores, waits for the partner, and honors surrender', () => {
    const initial = start(seed);
    const ended = {...initial, out:true, score:100};
    expect(result(ended,initial)).toBeNull();
    expect(result(ended,{...ended,score:90})).toBe('win');
    expect(result(ended,{...ended,score:110})).toBe('loss');
    expect(result(ended,ended)).toBe('tie');
    expect(result(initial,replay(seed,'!')!)).toBe('win');
  });
});
