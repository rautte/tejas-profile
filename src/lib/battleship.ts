// src/lib/battleship.ts
export const SIZE = 10;
export const FLEET_SIZES = [5, 4, 3, 3, 3] as const;

// NEW: authoritative shape specs (len, wid)
export const FLEET_SPECS = [
  { len: 5, wid: 2 }, // carrier (5×2)
  { len: 4, wid: 1 },
  { len: 3, wid: 1 },
  { len: 3, wid: 1 },
  { len: 3, wid: 1 },
] as const;

export type Orientation = "H" | "V";

// Shots grid: 0 unknown, 1 miss, 2 hit
export type Shots = number[][]; // SIZE×SIZE

// Ship placement grid: 0 empty, >0 shipId
export type Grid = number[][];  // SIZE×SIZE

export type Coord = [number, number]; // [r, c]

export type Ship = {
  id: number;
  length: number;      // NOTE: now stores TOTAL CELLS (len * wid) so sunk logic remains correct
  coords: Coord[];
  hits: number;        // how many coords have been hit
  wid?: number;        // NEW: width (defaults to 1 when absent)
};

export type Fleet = Record<number, Ship>;

// ---------- helpers ----------
const inBounds = (r: number, c: number) => r >= 0 && c >= 0 && r < SIZE && c < SIZE;
const key = (r: number, c: number) => `${r},${c}`;

// neighbors in + shape (for simple target AI)
export const neighbors4 = (r: number, c: number): Coord[] =>
  [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([rr, cc]) => inBounds(rr, cc)) as Coord[];

// ---------- constructors ----------
export function makeGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function makeShots(): Shots {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => [...row]);
}

export function cloneShots(s: Shots): Shots {
  return s.map((row) => [...row]);
}

// ---------- placement ----------
// (C) UPSERT: widen canPlace (default wid=1 keeps old calls valid)
export function canPlace(
  grid: Grid,
  r: number, c: number,
  len: number,
  orient: Orientation,
  wid: number = 1
): boolean {
  // rows/cols spanned by the rectangle
  const rows = orient === "H" ? wid : len;
  const cols = orient === "V" ? wid : len;

  const endR = r + rows - 1;
  const endC = c + cols - 1;
  if (r < 0 || c < 0 || endR >= SIZE || endC >= SIZE) return false;

  for (let i = 0; i < len; i++) {
    for (let w = 0; w < wid; w++) {
      const rr = r + (orient === "V" ? i : w);
      const cc = c + (orient === "H" ? i : w);
      if (grid[rr][cc] !== 0) return false;
    }
  }
  return true;
}

// (D) UPSERT: widen placeShip (default wid=1). Return shape kept the same.
export function placeShip(
  grid: Grid,
  fleet: Fleet,
  nextId: number,
  r: number,
  c: number,
  len: number,
  orient: Orientation,
  wid: number = 1
): { grid: Grid; fleet: Fleet; id: number } {
  if (!canPlace(grid, r, c, len, orient, wid)) throw new Error("Invalid placement");
  const g = cloneGrid(grid);
  const coords: Coord[] = [];

  for (let i = 0; i < len; i++) {
    for (let w = 0; w < wid; w++) {
      const rr = orient === "V" ? r + i : r + w;
      const cc = orient === "H" ? c + i : c + w;
      g[rr][cc] = nextId;
      coords.push([rr, cc]);
    }
  }

  // IMPORTANT: store TOTAL cell count so receiveShot/allSunk continue to work.
  const totalCells = len * wid;
  const newFleet: Fleet = {
    ...fleet,
    [nextId]: { id: nextId, length: totalCells, coords, hits: 0, wid },
  };
  return { grid: g, fleet: newFleet, id: nextId };
}

// (E) UPSERT: spec-driven randomFleet (places the 5×2 carrier as well)
export function randomFleet(): { grid: Grid; fleet: Fleet } {
  let grid = makeGrid();
  let fleet: Fleet = {};
  let nextId = 1;

  for (const spec of FLEET_SPECS) {
    let placed = false;

    // random attempts first
    for (let tries = 0; tries < 200 && !placed; tries++) {
      const orient: Orientation = Math.random() < 0.5 ? "H" : "V";
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (canPlace(grid, r, c, spec.len, orient, spec.wid)) {
        const res = placeShip(grid, fleet, nextId, r, c, spec.len, orient, spec.wid);
        grid = res.grid;
        fleet = res.fleet;
        nextId++;
        placed = true;
      }
    }

    // deterministic fallback sweep
    if (!placed) {
      outer: for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          for (const orient of ["H", "V"] as Orientation[]) {
            if (canPlace(grid, r, c, spec.len, orient, spec.wid)) {
              const res = placeShip(grid, fleet, nextId, r, c, spec.len, orient, spec.wid);
              grid = res.grid;
              fleet = res.fleet;
              nextId++;
              placed = true;
              break outer;
            }
          }
        }
      }
    }

    if (!placed) throw new Error("Failed to place AI fleet");
  }

  return { grid, fleet };
}

// ---------- gameplay ----------
export type ShotResult = "miss" | "hit" | "sunk";
export function receiveShot(
  shipGrid: Grid,
  shots: Shots,
  fleet: Fleet,
  r: number,
  c: number
): { result: ShotResult; shots: Shots; fleet: Fleet; shipId: number } {
  if (!inBounds(r, c)) throw new Error("Out of bounds");
  if (shots[r][c] !== 0) throw new Error("Cell already shot");

  const newShots = cloneShots(shots);
  const hitShipId = shipGrid[r][c];

  if (hitShipId === 0) {
    newShots[r][c] = 1; // miss
    return { result: "miss", shots: newShots, fleet, shipId: 0 };
  }

  newShots[r][c] = 2; // hit
  const ship = fleet[hitShipId];
  const newFleet: Fleet = { ...fleet, [hitShipId]: { ...ship, hits: ship.hits + 1 } };
  const isSunk = newFleet[hitShipId].hits >= newFleet[hitShipId].length;
  return { result: isSunk ? "sunk" : "hit", shots: newShots, fleet: newFleet, shipId: hitShipId };
}

export function allSunk(fleet: Fleet): boolean {
  return Object.values(fleet).every((s) => s.hits >= s.length);
}

// ---------- simple target AI ----------
export type AITargetState = {
  queue: Coord[];      // next target cells (neighbors to try)
  tried: Set<string>;  // to avoid duplicates in queue
};

export function makeAIState(): AITargetState {
  return { queue: [], tried: new Set() };
}

// pick next shot from target queue if available, else random unknown
export function aiPick(shots: Shots, ai: AITargetState): Coord {
  // dequeue targets that are still unknown
  while (ai.queue.length > 0) {
    const [r, c] = ai.queue.shift()!;
    if (shots[r][c] === 0) return [r, c];
  }
  // pick random unknown
  const unknown: Coord[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (shots[r][c] === 0) unknown.push([r, c]);
  return unknown[Math.floor(Math.random() * unknown.length)];
}

// after a hit, push its neighbors to queue
export function aiOnHit(r: number, c: number, shots: Shots, ai: AITargetState) {
  for (const [rr, cc] of neighbors4(r, c)) {
    const k = key(rr, cc);
    if (shots[rr][cc] === 0 && !ai.tried.has(k)) {
      ai.tried.add(k);
      ai.queue.push([rr, cc]);
    }
  }
}
