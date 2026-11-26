export function requireMove(valid, message) {
  if (!valid) throw new GameError(message);
}

export class GameError extends Error {}

export function integer(value, min, max, message = 'Choose a valid puzzle move.') {
  requireMove(Number.isSafeInteger(value) && value >= min && value <= max, message);
  return value;
}

export function shuffle(values, random) {
  const items = [...values];
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}
