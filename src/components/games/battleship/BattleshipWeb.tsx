// src/components/games/battleship/BattleshipWeb.tsx
import React from "react";
import {
  SIZE, FLEET_SIZES, Orientation,
  Grid, Shots, Fleet,
  makeGrid, makeShots, randomFleet,
  placeShip, canPlace, receiveShot, allSunk,
  makeAIState, aiPick, aiOnHit,
} from "lib/battleship";

import {
  MPMode, Role, generateCode, parseRoomCodeFromHash, buildInviteHash,
  createFirebaseAdapter,
} from "lib/mp";
import { Room } from "lib/mp/room";

/* ----------------- UI bits (unchanged from your last version) ----------------- */
const cellBase =
  "relative aspect-square rounded-md ring-1 transition select-none " +
  "ring-gray-300 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 " +
  "hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center";

const HitMark = () => (
  <svg viewBox="0 0 100 100" className="w-2/3 h-2/3 text-rose-500 dark:text-rose-300">
    <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
  </svg>
);

const MissMark = () => (
  <svg viewBox="0 0 100 100" className="w-1/3 h-1/3 text-gray-500 dark:text-gray-400">
    <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="8" fill="none" />
  </svg>
);

/* ----------------- sunk overlays (unchanged) ----------------- */
type SunkOverlay = { r0: number; c0: number; r1: number; c1: number; cells: string[]; };
function computeSunkOverlays(grid: Grid, shots: Shots): SunkOverlay[] {
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

function BoardGrid({
  title, grid, shots, revealShips = false, onCellClick, disabled = false,
  greenEllipseOnly = false, // NEW: for player board green pill
}: {
  title: string;
  grid: Grid;
  shots: Shots;
  revealShips?: boolean;
  onCellClick?: (r: number, c: number) => void;
  disabled?: boolean;
  greenEllipseOnly?: boolean;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = React.useState<{ cell: number; gap: number; pad: number } | null>(null);

  const sunkOverlays = React.useMemo(() => computeSunkOverlays(grid, shots), [grid, shots]);
  const sunkCells = React.useMemo(() => {
    const s = new Set<string>();
    sunkOverlays.forEach(o => o.cells.forEach(k => s.add(k)));
    return s;
  }, [sunkOverlays]);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const firstBtn = el.querySelector<HTMLButtonElement>('button[data-rc="0,0"]');
      const nextBtn  = el.querySelector<HTMLButtonElement>('button[data-rc="0,1"]');
      if (!firstBtn || !nextBtn) return;
      const wrapBox = el.getBoundingClientRect();
      const a = firstBtn.getBoundingClientRect();
      const b = nextBtn.getBoundingClientRect();
      const cell = a.width;
      const gap = Math.max(0, b.left - a.right);
      const padLeft = a.left - wrapBox.left;
      setMetrics({ cell, gap, pad: padLeft });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`w-full`}>
      <div className="mb-2 font-semibold text-gray-700 dark:text-gray-200">{title}</div>

      <div ref={wrapRef} className="relative grid grid-cols-10 gap-1 p-2 rounded-xl bg-gray-200 dark:bg-gray-900 ring-1 ring-black/10 dark:ring-white/10">
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE), c = i % SIZE;
          const shipId = grid[r][c];
          const shot = shots[r][c];

          const canClick = !disabled && !!onCellClick && shot === 0;
          const classes = cellBase + (canClick ? " cursor-pointer" : " cursor-default");

          const inSunk = sunkCells.has(`${r},${c}`);
          const showGreen = revealShips && shipId > 0;

          return (
            <button
              key={`cell-${title}-${r}-${c}`}
              data-rc={`${r},${c}`}
              className={classes}
              onClick={canClick ? () => onCellClick!(r, c) : undefined}
              disabled={!canClick}
              aria-label={`${title} ${r},${c}`}
            >
              {/* Player board: green ellipse pill (if requested) */}
              {showGreen && greenEllipseOnly && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 pointer-events-none" />
              )}

              {/* Enemy board (or any non-pill reveal): original emerald square */}
              {showGreen && !greenEllipseOnly && (
                <span className="absolute inset-0 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 pointer-events-none" />
              )}

              {/* Hide X if whole ship is sunk; still show misses */}
              {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
            </button>
          );
        })}

        {/* sunk overlays */}
        {metrics &&
          sunkOverlays.map((o, idx) => {
            const { cell, gap, pad } = metrics;
            const x = pad + o.c0 * (cell + gap);
            const y = pad + o.r0 * (cell + gap);
            const w = (o.c1 - o.c0 + 1) * cell + (o.c1 - o.c0) * gap;
            const h = (o.r1 - o.r0 + 1) * cell + (o.r1 - o.r0) * gap;
            const radius = Math.min(w, h) / 2;
            return (
              <div
                key={`sunk-${idx}`}
                className="absolute pointer-events-none bg-rose-500/30 ring-1 ring-rose-500/40"
                style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
                aria-hidden
                title="Sunk ship"
              />
            );
          })}
      </div>
    </div>
  );
}

/* ----------------- Main component with Bot / Multiplayer ----------------- */

type Phase = "place" | "play" | "over";
type Props = { onRegisterReset?: (fn: () => void) => void; };

export default function BattleshipWeb({ onRegisterReset }: Props) {
  // mode & MP
  const [mode, setMode] = React.useState<MPMode>(() => (parseRoomCodeFromHash() ? "mp" : "bot"));
  const [role, setRole] = React.useState<Role>("host");
  const [roomCode, setRoomCode] = React.useState<string>(() => parseRoomCodeFromHash() || "");
  const roomRef = React.useRef<Room | null>(null);

  // game state
  const [phase, setPhase] = React.useState<Phase>("place");
  const [orientation, setOrientation] = React.useState<Orientation>("H");

  // Player
  const [playerGrid, setPlayerGrid]   = React.useState<Grid>(() => makeGrid());
  const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
  const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots()); // Bot's shots on us

  // Enemy (Bot or remote player)
  const [enemyGrid, setEnemyGrid]   = React.useState<Grid>(() => makeGrid());
  const [enemyFleet, setEnemyFleet] = React.useState<Fleet>({});
  const [enemyShots, setEnemyShots] = React.useState<Shots>(() => makeShots()); // our shots on them

  const [toPlace, setToPlace] = React.useState<number[]>(() => [...FLEET_SIZES]);
  const [turn, setTurn] = React.useState<"player" | "ai">("player");
  const [msg, setMsg] = React.useState("Place your ships (Toggle Orientation)");

  const aiRef = React.useRef(makeAIState());

  // init enemy for Bot mode
  React.useEffect(() => {
    if (mode === "bot") {
      const { grid, fleet } = randomFleet();
      setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode]);

  // keyboard R rotate
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "place" && (e.key === "r" || e.key === "R")) {
        setOrientation((o) => (o === "H" ? "V" : "H"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Expose "reset" as a full rematch for Bot mode; in MP we'll use room.rematch()
  const resetLocal = React.useCallback(() => {
    setPhase("place"); setOrientation("H");
    setPlayerGrid(makeGrid()); setPlayerFleet({});
    setPlayerShots(makeShots());
    setEnemyGrid(makeGrid()); setEnemyFleet({});
    setEnemyShots(makeShots());
    setToPlace([...FLEET_SIZES]);
    setTurn("player");
    aiRef.current = makeAIState();
    setMsg("Place your ships (Toggle Orientation)");
    if (mode === "bot") {
      const { grid, fleet } = randomFleet(); setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode]);

  React.useEffect(() => { if (onRegisterReset) onRegisterReset(resetLocal); }, [onRegisterReset, resetLocal]);

  /* ----------------- Multiplayer wiring ----------------- */
  const ensureRoom = React.useCallback(async (asHost: boolean) => {
    const adapter = await createFirebaseAdapter();
    const code = asHost ? (roomCode || generateCode()) : roomCode;
    if (!code) return;
    setRoomCode(code);
    const r = new Room(adapter, code, asHost ? "host" : "guest", {
      onShot: ({ by, r, c }) => {
        // if opponent fires on us, we compute result locally, update our board, and send result back
        if ((by === "host" && role === "guest") || (by === "guest" && role === "host")) {
          const res = receiveShot(playerGrid, playerShots, playerFleet, r, c);
          setPlayerShots(res.shots);
          setPlayerFleet(res.fleet);
          const result = res.result === "hit" || res.result === "sunk" ? res.result : "miss";
          rObj().result(by, result as any, r, c); // to attacker
          // check loss
          if (allSunk(res.fleet)) {
            setPhase("over");
            setMsg("Bot wins!"); // message re-used; in MP it means Opponent wins
            rObj().phase("over");
          } else {
            setTurn("player");
            setMsg(result === "miss" ? "Opponent missed. Your turn!" : "Opponent hit you! Your turn.");
          }
        }
      },
      onResult: ({ to, result, r, c }) => {
        // our shot got a result back
        if ((to === "host" && role === "host") || (to === "guest" && role === "guest")) {
          const resShots = enemyShots.map(row => row.slice());
          resShots[r][c] = result === "miss" ? 1 : 2;
          setEnemyShots(resShots);
          if (result === "sunk" || result === "hit") {
            setMsg(result === "sunk" ? "Sunk! Opponent’s turn…" : "Hit! Opponent’s turn…");
          } else {
            setMsg("You missed. Opponent’s turn…");
          }
          setTurn("ai"); // opponent
        }
      },
      onPhase: (ph) => setPhase(ph),
      onRematch: () => resetLocal(),
    });
    roomRef.current = r;
    setRole(asHost ? "host" : "guest");
    if (asHost) await r.create();
    else await r.join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, role, playerGrid, playerShots, playerFleet, enemyShots]);

  React.useEffect(() => {
    // auto-join if URL has battleship-XXXX
    const code = parseRoomCodeFromHash();
    if (mode === "mp" && code && !roomRef.current) {
      setRoomCode(code);
      ensureRoom(false); // guest
    }
    // cleanup on unmount
    return () => { roomRef.current?.leave(); };
  }, [mode, ensureRoom]);

  const rObj = () => roomRef.current!;

  /* ----------------- Placement ----------------- */
  const onPlaceClick = (r: number, c: number) => {
    if (phase !== "place" || toPlace.length === 0) return;
    const length = toPlace[0];
    if (!canPlace(playerGrid, r, c, length, orientation)) {
      setMsg("Can't place there");
      return;
    }
    const nextId = Object.keys(playerFleet).length + 1;
    const res = placeShip(playerGrid, playerFleet, nextId, r, c, length, orientation);
    setPlayerGrid(res.grid);
    setPlayerFleet(res.fleet);

    const remaining = toPlace.slice(1);
    setToPlace(remaining);
    setMsg(remaining.length ? `Placed ${length}. Next: ${remaining[0]} (Toggle Orientation)` : "All placed! Start firing →");

    if (remaining.length === 0) {
      setPhase("play");
      setTurn("player");
      if (mode === "mp") rObj().phase("play");
    }
  };

  /* ----------------- Bot turn ----------------- */
  const aiTurn = () => {
    const ai = aiRef.current;
    const [rr, cc] = aiPick(playerShots, ai);
    const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
    setPlayerShots(res.shots);
    setPlayerFleet(res.fleet);

    if (res.result === "hit" || res.result === "sunk") aiOnHit(rr, cc, res.shots, ai);

    if (allSunk(res.fleet)) {
      setPhase("over"); setMsg("Bot wins!"); return;
    }

    setTurn("player");
    setMsg(res.result === "miss" ? "Bot missed. Your turn!" : "Bot hit you! Your turn.");
  };

  /* ----------------- Fire on enemy (Bot or MP) ----------------- */
  const onEnemyClick = (r: number, c: number) => {
    if (phase !== "play") return;

    if (mode === "bot") {
      if (turn !== "player" || enemyShots[r][c] !== 0) return;
      try {
        const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
        setEnemyShots(res.shots);
        setEnemyFleet(res.fleet);

        if (allSunk(res.fleet)) { setPhase("over"); setMsg("You win! 🎉"); return; }

        setTurn("ai");
        setMsg(res.result === "miss" ? "You missed. Bot's turn…" : "Hit! Bot's turn…");
        setTimeout(() => aiTurn(), 400);
      } catch { /* noop */ }
      return;
    }

    // MP
    if (turn !== "player" || enemyShots[r][c] !== 0) return;
    // Optimistically mark we fired (we'll wait for result event to color hit/miss)
    const resShots = enemyShots.map(row => row.slice());
    resShots[r][c] = 0; // keep as 0; result will set 1 or 2
    setEnemyShots(resShots);

    // send shot event
    rObj().shot(role, r, c);
    setMsg("Fired. Waiting for result…");
  };

  /* ----------------- Top control (mode + MP controls) ----------------- */
  const inviteHash = roomCode ? buildInviteHash(roomCode) : "";

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
        {/* Mode switch */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
          <div className="font-semibold text-gray-800 dark:text-gray-200">Mode:</div>
          <button
            className={`px-3 py-1.5 rounded-lg ${mode === "bot" ? "bg-purple-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}`}
            onClick={() => { roomRef.current?.leave(); setMode("bot"); resetLocal(); }}
          >Bot</button>
          <button
            className={`px-3 py-1.5 rounded-lg ${mode === "mp" ? "bg-purple-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}`}
            onClick={() => { setMode("mp"); resetLocal(); }}
          >Another Player</button>

          {mode === "mp" && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!roomRef.current && (
                <>
                  <button
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
                    onClick={() => ensureRoom(true)}
                  >
                    Create Room
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="Code (e.g., AX9G)"
                      className="px-2 py-1 rounded-md bg-white/80 dark:bg-gray-700 text-sm"
                    />
                    <button
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
                      onClick={() => ensureRoom(false)}
                    >
                      Join
                    </button>
                  </div>
                </>
              )}
              {roomRef.current && (
                <>
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    Room: <b>{roomCode}</b>
                  </span>
                  <button
                    className="px-3 py-1.5 rounded-lg bg-gray-700 text-white"
                    onClick={() => {
                      const { origin, pathname } = window.location;
                      navigator.clipboard.writeText(`${origin}${pathname}${inviteHash}`);
                    }}
                  >
                    Copy Invite Link
                  </button>
                  <a
                    href={inviteHash}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700"
                  >
                    Open Link
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        {/* Placement controls (only during placement) */}
        {phase === "place" && (
          <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Ships to place: <span className="tracking-wide">{toPlace.join(", ")}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Orientation:</span>
              <button
                onClick={() => setOrientation((o) => (o === "H" ? "V" : "H"))}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
              >
                {orientation === "H" ? "Horizontal" : "Vertical"} (R)
              </button>
            </div>
          </div>
        )}

        {/* Boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Player board: green ellipse pill; X's vanish when sunk; red pill overlay stays */}
          <BoardGrid
            title="Your Board"
            grid={playerGrid}
            shots={playerShots}
            revealShips
            greenEllipseOnly
            onCellClick={phase === "place" ? onPlaceClick : undefined}
            disabled={phase !== "place"}
          />

          {/* Enemy board:
              - Bot: behaves the same as before
              - MP: at game over (we lost), show enemy unsunk ships with emerald pill; preserve any X we found */}
          <BoardGrid
            title="Enemy Board"
            grid={enemyGrid}
            shots={enemyShots}
            revealShips={mode === "bot" ? phase === "over" : phase === "over"} // (MP: reveal on over)
            onCellClick={onEnemyClick}
            disabled={phase !== "play" || (mode === "bot" ? (turn !== "player") : false)}
          />
        </div>

        {/* Bottom bar: Reset for Bot; Rematch for MP */}
        <div className="flex items-center justify-between">
          {mode === "bot" ? (
            <button
              onClick={resetLocal}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
            >
              Reset
            </button>
          ) : roomRef.current ? (
            <button
              onClick={() => roomRef.current?.rematch()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
            >
              Rematch
            </button>
          ) : (
            <div />
          )}
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg}</div>
        </div>
      </div>
    </div>
  );
}





// // src/components/BattleshipWeb.tsx
// import React from "react";
// import {
//   SIZE, FLEET_SIZES, Orientation,
//   Grid, Shots, Fleet,
//   makeGrid, makeShots, randomFleet,
//   placeShip, canPlace, receiveShot, allSunk,
//   makeAIState, aiPick, aiOnHit,
// } from "lib/battleship";

// type Props = {
//   onRegisterReset?: (fn: () => void) => void;
//   showInternalReset?: boolean;
// };

// type Phase = "place" | "play" | "over";

// /** Base cell styling */
// const cellBase =
//   "relative aspect-square rounded-md ring-1 transition select-none " +
//   "ring-gray-300 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 " +
//   "hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center";

// const HitMark = () => (
//   <svg viewBox="0 0 100 100" className="w-2/3 h-2/3 text-rose-500 dark:text-rose-300">
//     <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
//     <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
//   </svg>
// );

// const MissMark = () => (
//   <svg viewBox="0 0 100 100" className="w-1/3 h-1/3 text-gray-500 dark:text-gray-400">
//     <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="8" fill="none" />
//   </svg>
// );

// /** ----- helpers: overlays ----- */
// type Overlay = {
//   id: number;
//   r0: number; c0: number; r1: number; c1: number; // inclusive bbox
//   cells: string[]; // "r,c"
// };

// /** All ships as overlays (by id), regardless of shots */
// function computeShipOverlays(grid: Grid): Overlay[] {
//   const byId: Record<number, Array<[number, number]>> = {};
//   for (let r = 0; r < SIZE; r++) {
//     for (let c = 0; c < SIZE; c++) {
//       const id = grid[r][c];
//       if (id > 0) (byId[id] ||= []).push([r, c]);
//     }
//   }
//   const overlays: Overlay[] = [];
//   for (const idStr of Object.keys(byId)) {
//     const id = Number(idStr);
//     const cellsRC = byId[id];
//     let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
//     const keys: string[] = [];
//     for (const [r, c] of cellsRC) {
//       if (r < r0) r0 = r;
//       if (c < c0) c0 = c;
//       if (r > r1) r1 = r;
//       if (c > c1) c1 = c;
//       keys.push(`${r},${c}`);
//     }
//     overlays.push({ id, r0, c0, r1, c1, cells: keys });
//   }
//   return overlays;
// }

// /** Only ships that are fully hit become "sunk overlays" */
// function computeSunkOverlays(grid: Grid, shots: Shots): Overlay[] {
//   const all = computeShipOverlays(grid);
//   return all.filter(ov =>
//     ov.cells.every(k => {
//       const [r, c] = k.split(",").map(Number);
//       return shots[r][c] === 2; // 2 = hit
//     })
//   );
// }

// /** ----- Board grid (used for both player/enemy) ----- */
// function BoardGrid({
//   title,
//   grid,
//   shots,
//   isPlayerBoard = false,   // green pills for your ships (until sunk)
//   isEnemyBoard = false,    // allows special behavior on loss
//   showUnsunkPills = false, // for enemy board when Bot wins: show emerald pills for every unsunk ship
//   onCellClick,
//   disabled = false,
// }: {
//   title: string;
//   grid: Grid;
//   shots: Shots;
//   isPlayerBoard?: boolean;
//   isEnemyBoard?: boolean;
//   showUnsunkPills?: boolean;
//   onCellClick?: (r: number, c: number) => void;
//   disabled?: boolean;
// }) {
//   const wrapRef = React.useRef<HTMLDivElement>(null);
//   const [metrics, setMetrics] = React.useState<{ cell: number; gap: number; pad: number } | null>(null);

//   // overlays
//   const shipOverlays = React.useMemo(() => computeShipOverlays(grid), [grid]);
//   const sunkOverlays = React.useMemo(() => computeSunkOverlays(grid, shots), [grid, shots]);
//   const sunkIds = React.useMemo(() => new Set(sunkOverlays.map(o => o.id)), [sunkOverlays]);

//   // for hiding X marks on fully sunk ships
//   const sunkCells = React.useMemo(() => {
//     const s = new Set<string>();
//     sunkOverlays.forEach(o => o.cells.forEach(k => s.add(k)));
//     return s;
//   }, [sunkOverlays]);

//   // measure cell size/gap so overlays align perfectly
//   React.useLayoutEffect(() => {
//     const el = wrapRef.current;
//     if (!el) return;
//     const ro = new ResizeObserver(() => {
//       const firstBtn = el.querySelector<HTMLButtonElement>('button[data-rc="0,0"]');
//       const nextBtn = el.querySelector<HTMLButtonElement>('button[data-rc="0,1"]');
//       if (!firstBtn || !nextBtn) return;

//       const wrapBox = el.getBoundingClientRect();
//       const a = firstBtn.getBoundingClientRect();
//       const b = nextBtn.getBoundingClientRect();

//       const cell = a.width;
//       const gap = Math.max(0, b.left - a.right);
//       const padLeft = a.left - wrapBox.left;
//       setMetrics({ cell, gap, pad: padLeft });
//     });
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   return (
//     <div className={`w-full`}>
//       <div className="mb-2 font-semibold text-gray-700 dark:text-gray-200">{title}</div>

//       {/* relative so overlays can absolutely position */}
//       <div
//         ref={wrapRef}
//         className="relative grid grid-cols-10 gap-1 p-2 rounded-xl bg-gray-200 dark:bg-gray-900 ring-1 ring-black/10 dark:ring-white/10"
//       >
//         {/* cells */}
//         {Array.from({ length: SIZE * SIZE }).map((_, i) => {
//           const r = Math.floor(i / SIZE);
//           const c = i % SIZE;
//           const shot = shots[r][c];

//           const canClick = !disabled && !!onCellClick && shot === 0;
//           const classes = cellBase + (canClick ? " cursor-pointer" : " cursor-default");

//           const inSunk = sunkCells.has(`${r},${c}`);

//           return (
//             <button
//               key={`cell-${title}-${r}-${c}`}
//               data-rc={`${r},${c}`}
//               className={classes}
//               onClick={canClick ? () => onCellClick!(r, c) : undefined}
//               disabled={!canClick}
//               aria-label={`${title} ${r},${c}`}
//             >
//               {/* Hide X if that whole ship is sunk; still show misses */}
//               {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
//             </button>
//           );
//         })}

//         {/* --- PLAYER-ONLY GREEN SHIP PILLS (skip sunk) --- */}
//         {isPlayerBoard && metrics &&
//           shipOverlays
//             .filter(ov => !sunkIds.has(ov.id))
//             .map((ov) => {
//               const { cell, gap, pad } = metrics;
//               const x = pad + ov.c0 * (cell + gap);
//               const y = pad + ov.r0 * (cell + gap);
//               const w = (ov.c1 - ov.c0 + 1) * cell + (ov.c1 - ov.c0) * gap;
//               const h = (ov.r1 - ov.r0 + 1) * cell + (ov.r1 - ov.r0) * gap;
//               const radius = Math.min(w, h) / 2;
//               return (
//                 <div
//                   key={`own-${ov.id}`}
//                   className="absolute pointer-events-none bg-emerald-500/25 dark:bg-emerald-400/20 ring-1 ring-emerald-600/25"
//                   style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
//                   aria-hidden
//                   title="Your ship"
//                 />
//               );
//             })}

//         {/* --- ENEMY UNSUNK GREEN PILLS (only when Bot wins) --- */}
//         {isEnemyBoard && showUnsunkPills && metrics &&
//           shipOverlays
//             .filter(ov => !sunkIds.has(ov.id)) // only ships not fully sunk by you
//             .map((ov) => {
//               const { cell, gap, pad } = metrics;
//               const x = pad + ov.c0 * (cell + gap);
//               const y = pad + ov.r0 * (cell + gap);
//               const w = (ov.c1 - ov.c0 + 1) * cell + (ov.c1 - ov.c0) * gap;
//               const h = (ov.r1 - ov.r0 + 1) * cell + (ov.r1 - ov.r0) * gap;
//               const radius = Math.min(w, h) / 2;
//               return (
//                 <div
//                   key={`enemy-unsunk-${ov.id}`}
//                   className="absolute pointer-events-none bg-emerald-500/25 dark:bg-emerald-400/20 ring-1 ring-emerald-600/25"
//                   style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
//                   aria-hidden
//                   title="Enemy ship (unsunk)"
//                 />
//               );
//             })}

//         {/* --- SUNK SHIP RED PILLS (both boards) --- */}
//         {metrics &&
//           sunkOverlays.map((o) => {
//             const { cell, gap, pad } = metrics;
//             const x = pad + o.c0 * (cell + gap);
//             const y = pad + o.r0 * (cell + gap);
//             const w = (o.c1 - o.c0 + 1) * cell + (o.c1 - o.c0) * gap;
//             const h = (o.r1 - o.r0 + 1) * cell + (o.r1 - o.r0) * gap;
//             const radius = Math.min(w, h) / 2;
//             return (
//               <div
//                 key={`sunk-${o.id}`}
//                 className="absolute pointer-events-none bg-rose-500/30 ring-1 ring-rose-500/40"
//                 style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
//                 aria-hidden
//                 title="Sunk ship"
//               />
//             );
//           })}
//       </div>
//     </div>
//   );
// }

// /** ----- Main component ----- */
// export default function BattleshipWeb({ onRegisterReset, showInternalReset = false }: Props) {
//   // phase/orientation
//   const [phase, setPhase] = React.useState<Phase>("place");
//   const [orientation, setOrientation] = React.useState<Orientation>("H");

//   // track winner so Enemy board knows when to show unsunk pills
//   const [winner, setWinner] = React.useState<null | "player" | "bot">(null);

//   // Player
//   const [playerGrid, setPlayerGrid] = React.useState<Grid>(() => makeGrid());
//   const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
//   const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots()); // Bot's shots on us

//   // Enemy (Bot)
//   const [enemyGrid, setEnemyGrid] = React.useState<Grid>(() => makeGrid());
//   const [enemyFleet, setEnemyFleet] = React.useState<Fleet>({});
//   const [enemyShots, setEnemyShots] = React.useState<Shots>(() => makeShots()); // our shots on Bot

//   // queue for placement
//   const [toPlace, setToPlace] = React.useState<number[]>(() => [...FLEET_SIZES]);

//   // turn
//   const [turn, setTurn] = React.useState<"player" | "ai">("player");

//   // message
//   const [msg, setMsg] = React.useState<string>("Place your ships (Toggle Orientation)");

//   // Bot targeting state
//   const aiRef = React.useRef(makeAIState());

//   // init Bot board
//   React.useEffect(() => {
//     const { grid, fleet } = randomFleet();
//     setEnemyGrid(grid);
//     setEnemyFleet(fleet);
//   }, []);

//   // keyboard: R to rotate during placement
//   React.useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if (phase === "place" && (e.key === "r" || e.key === "R")) {
//         setOrientation((o) => (o === "H" ? "V" : "H"));
//       }
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [phase]);

//   // expose reset
//   const reset = React.useCallback(() => {
//     setPhase("place");
//     setWinner(null);
//     setOrientation("H");
//     setPlayerGrid(makeGrid());
//     setPlayerFleet({});
//     setPlayerShots(makeShots());
//     const enemy = randomFleet();
//     setEnemyGrid(enemy.grid);
//     setEnemyFleet(enemy.fleet);
//     setEnemyShots(makeShots());
//     setToPlace([...FLEET_SIZES]);
//     setTurn("player");
//     aiRef.current = makeAIState();
//     setMsg("Place your ships (Toggle Orientation)");
//   }, []);
//   React.useEffect(() => {
//     if (onRegisterReset) onRegisterReset(reset);
//   }, [onRegisterReset, reset]);

//   // placement click (player board)
//   const onPlaceClick = (r: number, c: number) => {
//     if (phase !== "place" || toPlace.length === 0) return;
//     const length = toPlace[0];
//     if (!canPlace(playerGrid, r, c, length, orientation)) {
//       setMsg("Can't place there");
//       return;
//     }
//     const nextId = Object.keys(playerFleet).length + 1;
//     const res = placeShip(playerGrid, playerFleet, nextId, r, c, length, orientation);
//     setPlayerGrid(res.grid);
//     setPlayerFleet(res.fleet);

//     const remaining = toPlace.slice(1);
//     setToPlace(remaining);
//     setMsg(
//       remaining.length
//         ? `Placed ${length}. Next: ${remaining[0]} (Toggle Orientation)`
//         : "All placed! Start firing →"
//     );

//     if (remaining.length === 0) {
//       setPhase("play");
//       setTurn("player");
//     }
//   };

//   // player fires on Bot board
//   const onEnemyClick = (r: number, c: number) => {
//     if (phase !== "play" || turn !== "player" || enemyShots[r][c] !== 0) return;

//     try {
//       const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
//       setEnemyShots(res.shots);
//       setEnemyFleet(res.fleet);

//       if (allSunk(res.fleet)) {
//         setPhase("over");
//         setWinner("player");
//         setMsg("You win! 🎉");
//         return;
//       }

//       // Bot's turn
//       setTurn("ai");
//       setMsg(res.result === "miss" ? "You missed. Bot's turn…" : "Hit! Bot's turn…");

//       setTimeout(() => {
//         aiTurn();
//       }, 400);
//     } catch {
//       /* noop */
//     }
//   };

//   // Bot turn
//   const aiTurn = () => {
//     const ai = aiRef.current;
//     const [rr, cc] = aiPick(playerShots, ai);
//     const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
//     setPlayerShots(res.shots);
//     setPlayerFleet(res.fleet);

//     if (res.result === "hit" || res.result === "sunk") {
//       aiOnHit(rr, cc, res.shots, ai);
//     }

//     if (allSunk(res.fleet)) {
//       setPhase("over");
//       setWinner("bot");
//       setMsg("Bot wins!");
//       return;
//     }

//     setTurn("player");
//     setMsg(res.result === "miss" ? "Bot missed. Your turn!" : "Bot hit you! Your turn.");
//   };

//   // --- UI ---
//   return (
//     <div className="w-full flex justify-center">
//       <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
//         {/* Placement controls */}
//         {phase === "place" && (
//           <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
//             <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
//               Ships to place: <span className="tracking-wide">{toPlace.join(", ")}</span>
//             </div>
//             <div className="flex items-center gap-3">
//               <span className="text-sm text-gray-700 dark:text-gray-300">Orientation:</span>
//               <button
//                 onClick={() => setOrientation((o) => (o === "H" ? "V" : "H"))}
//                 className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
//               >
//                 {orientation === "H" ? "Horizontal" : "Vertical"} (R)
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Boards */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {/* Player board — unchanged from your last version */}
//           <BoardGrid
//             title="Your Board"
//             grid={playerGrid}
//             shots={playerShots}
//             isPlayerBoard
//             onCellClick={phase === "place" ? onPlaceClick : undefined}
//             disabled={phase !== "place"}
//           />

//           {/* Enemy board — show emerald pills for ALL unsunk ships iff Bot wins */}
//           <BoardGrid
//             title="Enemy Board"
//             grid={enemyGrid}
//             shots={enemyShots}
//             isEnemyBoard
//             showUnsunkPills={winner === "bot"}  // << key line
//             onCellClick={onEnemyClick}
//             disabled={phase !== "play" || turn !== "player"}
//           />
//         </div>

//         {/* Bottom bar */}
//         <div className="flex items-center justify-between">
//           <button
//             onClick={reset}
//             className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
//           >
//             Reset
//           </button>
//           <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg}</div>
//         </div>
//       </div>
//     </div>
//   );
// }

