// All winning lines on a 5x5 bingo card (positions 0–24, row-major order)
export const BINGO_LINES: number[][] = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

export function hasBingo(positions: number[]): boolean {
  const set = new Set(positions);
  return BINGO_LINES.some((line) => line.every((p) => set.has(p)));
}

/** Returns true if adding newPosition creates a NEW bingo line */
export function hasNewBingo(prevApproved: number[], newPosition: number): boolean {
  return !hasBingo(prevApproved) && hasBingo([...prevApproved, newPosition]);
}

export function isBlackout(approved: number[]): boolean {
  return approved.length === 25;
}

/** Human-readable label for a grid position, e.g. position 6 → "B2" */
export function posLabel(pos: number): string {
  const col = ["B", "I", "N", "G", "O"][pos % 5];
  const row = Math.floor(pos / 5) + 1;
  return `${col}${row}`;
}
