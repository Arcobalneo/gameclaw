export type Dir = 'n' | 's' | 'e' | 'w';

export interface Level {
  snake: [number, number][];
  crate: [number, number];
  dock: [number, number];
  moves: Dir[];
}

/** Head first. Borders are walls: x 0 or 6, y 0 or 4. */
export const LEVELS: Level[] = [
  {
    snake: [
      [2, 1],
      [1, 1],
      [1, 2],
    ],
    crate: [4, 2],
    dock: [5, 2],
    moves: ['s', 'e', 'e'],
  },
  {
    snake: [
      [1, 2],
      [1, 1],
      [2, 1],
    ],
    crate: [3, 2],
    dock: [5, 2],
    moves: ['e', 'e', 'e'],
  },
  {
    snake: [
      [2, 2],
      [1, 2],
      [1, 1],
    ],
    crate: [4, 2],
    dock: [4, 3],
    moves: ['n', 'e', 'e', 's'],
  },
];

export const DIR: Record<Dir, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
};
