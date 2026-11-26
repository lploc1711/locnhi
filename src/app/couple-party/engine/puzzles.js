import { integer, requireMove, shuffle } from './game-utils.js';

function makeArray(size, fn) {
  return Array.from({ length: size }, (_, index) => fn(index));
}

const pick = (values, random) => values[Math.floor(random() * values.length)];
const distance = (a, b, size) => Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size));
const swap = (cells, a, b) => { [cells[a], cells[b]] = [cells[b], cells[a]]; };

export function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const memory = {
  generate(difficulty, random) {
    const pairs = 6 + difficulty * 2;
    return { score: 0, faces: shuffle(makeArray(pairs * 2, i => i % pairs), random),
      matched: Array(pairs * 2).fill(false), first: -1, second: -1, hideAt: 0 };
  },
  move(board, action, now) {
    const index = integer(action.index, 0, board.faces.length - 1);
    requireMove(board.second < 0, 'Wait for the cards to turn back.');
    requireMove(index !== board.first && !board.matched[index], 'Choose a face-down card.');
    if (board.first < 0) board.first = index;
    else if (board.faces[board.first] === board.faces[index]) {
      board.matched[board.first] = board.matched[index] = true;
      board.score++;
      board.first = -1;
    } else {
      board.second = index;
      board.hideAt = now + 750;
    }
  },
  tickAt: board => board.hideAt || null,
  tick(board) { board.first = board.second = -1; board.hideAt = 0; },
  view: board => ({
    locked: board.second >= 0, matched: board.matched,
    cells: board.faces.map((face, i) => board.matched[i] || i === board.first || i === board.second ? face : null),
  }),
  progress: board => board.score,
  target: board => board.faces.length / 2,
};

const sliding = {
  generate(difficulty, random) {
    const size = difficulty === 2 ? 4 : 3;
    const board = { size, cells: makeArray(size * size, i => (i + 1) % (size * size)) };
    let empty = board.cells.length - 1;
    let previous = -1;
    for (let i = 0; i < 8 + 5 * difficulty || this.progress(board) === this.target(board); i++) {
      const next = pick(board.cells.map((_, j) => j).filter(j => j !== previous && distance(j, empty, size) === 1), random);
      swap(board.cells, empty, next);
      previous = empty;
      empty = next;
    }
    return board;
  },
  move(board, action) {
    const tile = integer(action.index, 0, board.cells.length - 1);
    const empty = board.cells.indexOf(0);
    requireMove(distance(tile, empty, board.size) === 1, 'Choose a tile next to the empty space.');
    swap(board.cells, tile, empty);
  },
  view: board => board,
  progress: board => board.cells.filter((tile, i) => tile === i + 1).length,
  target: board => board.cells.length - 1,
};

function rotate(cells, rotation) {
  let shape = cells;
  for (let turn = 0; turn < rotation; turn++) shape = shape.map(([x, y]) => [-y, x]);
  const left = Math.min(...shape.map(cell => cell[0]));
  const top = Math.min(...shape.map(cell => cell[1]));
  return shape.map(([x, y]) => [x - left, y - top]);
}

function occupied(board, exclude) {
  const { size, placed, pieces } = board;
  const cells = Array(size * size).fill(-1);
  placed.forEach((location, piece) => {
    if (!location || piece === exclude) return;
    for (const [x, y] of rotate(pieces[piece], location.rotation)) {
      cells[location.index + y * size + x] = piece;
    }
  });
  return cells;
}

const blocks = {
  generate(difficulty, random) {
    const size = difficulty === 0 ? 4 : 5;
    let remaining = makeArray(size * size, i => i);
    const pieces = [];
    while (remaining.length) {
      const length = 3 + Math.floor(random() * 2);
      const shape = [pick(remaining, random)];
      remaining = remaining.filter(cell => cell !== shape[0]);
      while (shape.length < length) {
        const neighbors = remaining.filter(cell => shape.some(piece => distance(cell, piece, size) === 1));
        if (!neighbors.length) break;
        const next = pick(neighbors, random);
        shape.push(next);
        remaining = remaining.filter(cell => cell !== next);
      }
      pieces.push(rotate(shape.map(cell => [cell % size, Math.floor(cell / size)]), difficulty ? Math.floor(random() * 4) : 0));
    }
    return { size, pieces, placed: pieces.map(() => null) };
  },
  move(board, action) {
    const piece = integer(action.piece, 0, board.pieces.length - 1);
    if (action.remove === true) {
      requireMove(board.placed[piece], 'This piece is not on the board.');
      board.placed[piece] = null;
      return;
    }
    const { size } = board;
    const index = integer(action.index, 0, size * size - 1);
    const rotation = integer(action.rotation, 0, 3);
    const cells = occupied(board, piece);
    requireMove(rotate(board.pieces[piece], rotation).every(([x, y]) =>
      x + index % size < size && y + Math.floor(index / size) < size && cells[index + y * size + x] < 0),
    'That piece does not fit there.');
    board.placed[piece] = { index, rotation };
  },
  view: board => ({ ...board, cells: occupied(board) }),
  progress: board => board.placed.reduce((score, spot, i) => score + (spot ? board.pieces[i].length : 0), 0),
  target: board => board.size ** 2,
};

function choicePuzzle(task) {
  return {
    generate: (difficulty, random) => ({ score: 0, retryAt: 0,
      tasks: makeArray(4 + difficulty * 2, i => task(difficulty, random, i)) }),
    move(board, action, now) {
      requireMove(now >= board.retryAt, 'Wait a moment before trying again.');
      const question = board.tasks[board.score];
      if (integer(action.index, 0, question.options.length - 1) === question.correct) {
        board.score++;
        board.retryAt = 0;
      } else board.retryAt = now + 2400;
    },
    tickAt: board => board.retryAt || null,
    tick(board) { board.retryAt = 0; },
    view(board) {
      const { correct, ...task } = board.tasks[board.score];
      return { ...task, wrong: board.retryAt > 0 };
    },
    progress: board => board.score,
    target: board => board.tasks.length,
  };
}

function options(task, values, answer, random) {
  const choices = shuffle(values, random);
  return { ...task, options: choices, correct: choices.indexOf(answer) };
}

const patterns = choicePuzzle((difficulty, random) => {
  const length = 2 + difficulty;
  const symbols = shuffle([0, 1, 2, 3, 4, 5, 6], random);
  const missing = difficulty === 0 ? length * 3 - 1 : length + Math.floor(random() * length * 2);
  return options({ sequence: makeArray(length * 3, i => i === missing ? null : symbols[i % length]) },
    symbols.slice(0, 4), symbols[missing % length], random);
});

const logic = choicePuzzle((difficulty, random, variant) => {
  const number = 4 + Math.floor(random() * (8 + 7 * difficulty));
  const step = 2 + Math.floor(random() * (3 + 3 * difficulty));
  const offset = 1 + Math.floor(random() * (number - 1));
  const choices = [number, number - 1, number + 1, number + step];
  switch (variant % (3 + difficulty)) {
    case 0:
      return options({ prompt: [`My number plus ${offset} is ${number + offset}. What is my number?`,
        `Số của tôi cộng ${offset} bằng ${number + offset}. Số đó là gì?`] }, choices, number, random);
    case 1: {
      const smallest = Math.max(1, number - step);
      const largest = number + step;
      const list = shuffle([smallest, number, largest], random).join(', ');
      const left = random() < .5;
      return options({ prompt: [`The boxes hold ${list}. Left > right. Center < right. What is in the ${left ? 'left' : 'right'} box?`,
        `Ba hộp chứa các số ${list}. Trái > phải. Giữa < phải. Hộp bên ${left ? 'trái' : 'phải'} chứa số nào?`] },
      [smallest, number, largest, largest + 1], left ? largest : number, random);
    }
    case 2:
      return options({ prompt: [`Two equal stacks contain ${number * 2} blocks total. How many are in one stack?`,
        `Hai chồng giống nhau có tổng cộng ${number * 2} khối. Mỗi chồng có bao nhiêu khối?`] }, choices, number, random);
    case 3:
      return options({ prompt: [`My number is ${number % 2 ? 'odd' : 'even'} and strictly between ${number - 1} and ${number + 2}. Which number fits?`,
        `Số của tôi là số ${number % 2 ? 'lẻ' : 'chẵn'}, lớn hơn ${number - 1} và nhỏ hơn ${number + 2}. Số nào đúng?`] },
      [number - 1, number, number + 1, number + 2], number, random);
    default:
      return options({ prompt: [`Triple my number, then add ${step}. The result is ${number * 3 + step}. Find my number.`,
        `Nhân số của tôi với ba rồi cộng ${step} thì được ${number * 3 + step}. Tìm số đó.`] }, choices, number, random);
  }
});

const SIZE = 6;

function matches(cells) {
  const result = new Set();
  cells.forEach((color, i) => {
    for (const direction of [1, SIZE]) {
      if ((direction === 1 ? i % SIZE < SIZE - 2 : i < SIZE * (SIZE - 2)) &&
        cells[i + direction] === color && cells[i + 2 * direction] === color) {
        result.add(i).add(i + direction).add(i + 2 * direction);
      }
    }
  });
  return result;
}

function hasMove(cells) {
  return cells.some((color, from) => [from + 1, from + SIZE].some(to => {
    if (to >= cells.length || distance(from, to, SIZE) !== 1 || color === cells[to]) return false;
    swap(cells, from, to);
    const valid = matches(cells).size > 0;
    swap(cells, from, to);
    return valid;
  }));
}

function fresh(colors, random) {
  let cells;
  do {
    cells = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      let color;
      do { color = Math.floor(random() * colors); } while (
        (i % SIZE >= 2 && cells[i - 1] === color && cells[i - 2] === color) ||
        (i >= 2 * SIZE && cells[i - SIZE] === color && cells[i - 2 * SIZE] === color));
      cells.push(color);
    }
  } while (!hasMove(cells));
  return cells;
}

const matchThree = {
  generate(difficulty, random) {
    return { size: SIZE, colors: 4 + difficulty, seed: Math.floor(random() * 2 ** 32), step: 0,
      score: 0, target: 24 + difficulty * 9, cells: fresh(4 + difficulty, random) };
  },
  move(board, action) {
    const { cells } = board;
    const from = integer(action.from, 0, cells.length - 1);
    const to = integer(action.index, 0, cells.length - 1);
    requireMove(distance(from, to, SIZE) === 1, 'Swap two neighboring tiles.');
    swap(cells, from, to);
    let hit = matches(cells);
    requireMove(hit.size > 0, 'Choose a swap that makes a line of three or more.');
    const random = seededRandom(board.seed ^ Math.imul(++board.step, 0x9e3779b9));
    while (hit.size && board.score < board.target) {
      board.score = Math.min(board.target, board.score + hit.size);
      for (let col = 0; col < SIZE; col++) {
        let write = SIZE - 1;
        for (let row = SIZE - 1; row >= 0; row--) {
          if (!hit.has(row * SIZE + col)) cells[write-- * SIZE + col] = cells[row * SIZE + col];
        }
        while (write >= 0) cells[write-- * SIZE + col] = Math.floor(random() * board.colors);
      }
      hit = matches(cells);
    }
    if (board.score < board.target && !hasMove(cells)) board.cells = fresh(board.colors, random);
  },
  view: ({ size, cells }) => ({ size, cells }),
  target: board => board.target,
  progress: board => board.score,
};

export const puzzles = { memory, blocks, patterns, sliding, 'match-three': matchThree, logic };
