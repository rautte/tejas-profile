import { SIZE } from "lib/battleship";
import type { Grid, Shots } from "lib/battleship";

export type SunkOverlay = { r0: number; c0: number; r1: number; c1: number; cells: string[]; };

export function computeSunkOverlays(grid: Grid, shots: Shots): SunkOverlay[] {
  const byId: Record<number, Array<[number, number]>> = {};
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const id = grid[r][c]; if (id > 0) (byId[id] ||= []).push([r, c]);
  }
  const out: SunkOverlay[] = [];
  for (const id of Object.keys(byId)) {
    const cells = byId[Number(id)];
    const sunk = cells.every(([r, c]) => shots[r][c] === 2);
    if (!sunk) continue;
    let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
    const keys: string[] = [];
    for (const [r, c] of cells) {
      if (r < r0) r0 = r; if (c < c0) c0 = c;
      if (r > r1) r1 = r; if (c > c1) c1 = c;
      keys.push(`${r},${c}`);
    }
    out.push({ r0, c0, r1, c1, cells: keys });
  }
  return out;
}
