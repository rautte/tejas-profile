// src/lib/minesweeper.ts
export type CellState = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number; // adjacent mines
};

export type Board = CellState[][];
export type Pos = [number, number];

export function makeBoard(rows=9, cols=9, mines=10, seed?: number): Board {
  const rnd = mulberry32(seed ?? Date.now());
  const board: Board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false, revealed: false, flagged: false, count: 0
    }))
  );

  // place mines
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(rnd() * rows);
    const c = Math.floor(rnd() * cols);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // compute counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      board[r][c].count = neighbors(r, c, rows, cols)
        .reduce((sum, [rr, cc]) => sum + (board[rr][cc].mine ? 1 : 0), 0);
    }
  }
  return board;
}

export function clone(b: Board): Board {
  return b.map(row => row.map(cell => ({ ...cell })));
}

export function inBounds(r: number, c: number, rows: number, cols: number) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

export function neighbors(r: number, c: number, rows: number, cols: number): Pos[] {
  const out: Pos[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc, rows, cols)) out.push([rr, cc]);
    }
  return out;
}

export function reveal(b: Board, r: number, c: number): { board: Board; hitMine: boolean } {
  if (b[r][c].revealed || b[r][c].flagged) return { board: b, hitMine: false };
  const nb = clone(b);
  if (nb[r][c].mine) {
    nb[r][c].revealed = true;
    return { board: nb, hitMine: true };
  }
  floodReveal(nb, r, c);
  return { board: nb, hitMine: false };
}

export function toggleFlag(b: Board, r: number, c: number): Board {
  if (b[r][c].revealed) return b;
  const nb = clone(b);
  nb[r][c].flagged = !nb[r][c].flagged;
  return nb;
}

export function isWin(b: Board): boolean {
  // win = all non-mine cells revealed
  for (const row of b)
    for (const cell of row)
      if (!cell.mine && !cell.revealed) return false;
  return true;
}

function floodReveal(b: Board, r: number, c: number) {
  const rows = b.length, cols = b[0].length;
  const stack: Pos[] = [[r, c]];
  while (stack.length) {
    const [rr, cc] = stack.pop()!;
    const cell = b[rr][cc];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.count === 0) {
      for (const [nr, nc] of neighbors(rr, cc, rows, cols)) {
        if (!b[nr][nc].revealed && !b[nr][nc].mine) stack.push([nr, nc]);
      }
    }
  }
}

// tiny seeded RNG (so restarts can be consistent if you pass a seed)
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export {};
