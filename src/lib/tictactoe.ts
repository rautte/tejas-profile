// src/lib/tictactoe.ts
// Web port of your Python AI logic (minimax with ±Infinity),
// plus a greedy front layer: take instant win, otherwise block
// opponent's instant win, otherwise run full minimax.

export type Cell = 0 | 1 | 2;          // 0 empty, 1 HUMAN (O), 2 AI (X)
export type Board = Cell[][];

export const HUMAN: Cell = 1;
export const AI: Cell = 2;

// ---- board helpers ----
export function emptyBoard(): Board {
  return [
    [0, 0, 0] as Cell[],
    [0, 0, 0] as Cell[],
    [0, 0, 0] as Cell[],
  ];
}

export function clone(b: Board): Board {
  return b.map(row => [...row]) as Board;
}

export function availableSquares(b: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    if (b[r][c] === 0) out.push([r, c]);
  return out;
}

export function isFull(b: Board): boolean {
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (b[r][c] === 0) return false;
  return true;
}

export function checkWin(b: Board, p: Cell): boolean {
  // rows
  for (let r = 0; r < 3; r++) {
    if (b[r][0] === p && b[r][1] === p && b[r][2] === p) return true;
  }
  // cols
  for (let c = 0; c < 3; c++) {
    if (b[0][c] === p && b[1][c] === p && b[2][c] === p) return true;
  }
  // diags
  if (b[0][0] === p && b[1][1] === p && b[2][2] === p) return true;
  if (b[0][2] === p && b[1][1] === p && b[2][0] === p) return true;
  return false;
}

// ---- immediate tactical checks (greedy layer) ----
function wouldWin(b: Board, p: Cell, r: number, c: number): boolean {
  if (b[r][c] !== 0) return false;
  const prev = b[r][c];
  b[r][c] = p;
  const win = checkWin(b, p);
  b[r][c] = prev;
  return win;
}

function findImmediate(b: Board, p: Cell): [number, number] | null {
  for (const [r, c] of availableSquares(b)) {
    if (wouldWin(b, p, r, c)) return [r, c];
  }
  return null;
}

// ---- minimax (mirrors your Python approach) ----
// Uses ±Infinity like your code. If you want to prefer quicker wins / slower
// losses, you can swap the Infinity/−Infinity for (+10 - depth) / (−10 + depth).
function minimax(b: Board, isMax: boolean): number {
  if (checkWin(b, AI))   return  Infinity;
  if (checkWin(b, HUMAN))return -Infinity;
  if (isFull(b))         return  0;

  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of availableSquares(b)) {
      b[r][c] = AI;
      const score = minimax(b, false);
      b[r][c] = 0;
      if (score > best) best = score;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of availableSquares(b)) {
      b[r][c] = HUMAN;
      const score = minimax(b, true);
      b[r][c] = 0;
      if (score < best) best = score;
    }
    return best;
  }
}

// ---- public: choose AI move ----
export function bestMove(b: Board): [number, number] | null {
  // 1) take immediate win
  const winNow = findImmediate(b, AI);
  if (winNow) return winNow;

  // 2) block opponent's immediate win
  const blockNow = findImmediate(b, HUMAN);
  if (blockNow) return blockNow;

  // 3) otherwise, full minimax (pick any move that yields the best score)
  let move: [number, number] | null = null;
  let best = -Infinity;

  for (const [r, c] of availableSquares(b)) {
    b[r][c] = AI;
    const score = minimax(b, false);
    b[r][c] = 0;

    if (score > best) {
      best = score;
      move = [r, c];
    }
  }
  return move;
}

// 👇 ensures file is treated as a module even if you miss exports
export {};
