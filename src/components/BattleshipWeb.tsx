// src/components/BattleshipWeb.tsx
import React from "react";
import {
  SIZE, FLEET_SIZES, Orientation,
  Grid, Shots, Fleet,
  makeGrid, makeShots, randomFleet,
  placeShip, canPlace, receiveShot, allSunk,
  makeAIState, aiPick, aiOnHit,
} from "lib/battleship";

type Props = {
  onRegisterReset?: (fn: () => void) => void;
  showInternalReset?: boolean; // default hidden; top Reset comes from GameLayout
};

type Phase = "place" | "play" | "over";

const cellBase =
  "aspect-square rounded-md ring-1 transition select-none " +
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

function BoardGrid({
  title,
  grid,      // ship ids grid (for player board)
  shots,     // shots overlay
  revealShips = false, // show ships (player board true; enemy false until game over)
  onCellClick,
  disabled = false,
}: {
  title: string;
  grid: Grid;
  shots: Shots;
  revealShips?: boolean;
  onCellClick?: (r: number, c: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`w-full`}>
      <div className="mb-2 font-semibold text-gray-700 dark:text-gray-200">{title}</div>
      <div className="grid grid-cols-10 gap-1 p-2 rounded-xl bg-gray-200 dark:bg-gray-900 ring-1 ring-black/10 dark:ring-white/10">
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          const shipId = grid[r][c];
          const shot = shots[r][c];
          const showShip = revealShips && shipId > 0;

          const canClick = !disabled && !!onCellClick && shot === 0;
          const classes =
            cellBase +
            (canClick ? " cursor-pointer" : " cursor-default") +
            (showShip ? " bg-emerald-600/25 dark:bg-emerald-500/20" : "");

          return (
            <button
              key={`cell-${title}-${r}-${c}`}
              className={classes}
              onClick={canClick ? () => onCellClick!(r, c) : undefined}
              disabled={!canClick}
              aria-label={`${title} ${r},${c}`}
            >
              {shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BattleshipWeb({ onRegisterReset, showInternalReset = false }: Props) {
  // --- state ---
  const [phase, setPhase] = React.useState<Phase>("place");
  const [orientation, setOrientation] = React.useState<Orientation>("H");

  // Player
  const [playerGrid, setPlayerGrid] = React.useState<Grid>(() => makeGrid());
  const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
  const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots()); // AI's shots (hits/miss on us)

  // Enemy
  const [enemyGrid, setEnemyGrid] = React.useState<Grid>(() => makeGrid());
  const [enemyFleet, setEnemyFleet] = React.useState<Fleet>({});
  const [enemyShots, setEnemyShots] = React.useState<Shots>(() => makeShots()); // our shots on AI

  // queue of ships to place (copy so we can pop as we place)
  const [toPlace, setToPlace] = React.useState<number[]>(() => [...FLEET_SIZES]);

  // Turn handling
  const [turn, setTurn] = React.useState<"player" | "ai">("player");

  // Messages
  const [msg, setMsg] = React.useState<string>("Place your ships (toggle Rotate)");

  // AI target memory
  const aiRef = React.useRef(makeAIState());

  // Init enemy on first mount (random fleet)
  React.useEffect(() => {
    const { grid, fleet } = randomFleet();
    setEnemyGrid(grid);
    setEnemyFleet(fleet);
  }, []);

  // Keyboard: R to rotate during placement
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "place" && (e.key === "r" || e.key === "R")) {
        setOrientation((o) => (o === "H" ? "V" : "H"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Expose reset to parent (GameLayout)
  const reset = React.useCallback(() => {
    setPhase("place");
    setOrientation("H");
    setPlayerGrid(makeGrid());
    setPlayerFleet({});
    setPlayerShots(makeShots());
    const enemy = randomFleet();
    setEnemyGrid(enemy.grid);
    setEnemyFleet(enemy.fleet);
    setEnemyShots(makeShots());
    setToPlace([...FLEET_SIZES]);
    setTurn("player");
    aiRef.current = makeAIState();
    setMsg("Place your ships (toggle Rotate)");
  }, []);
  React.useEffect(() => {
    if (onRegisterReset) onRegisterReset(reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterReset]);

  // Placement click (on player board)
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
    setMsg(remaining.length ? `Placed ${length}. Next: ${remaining[0]} (Rotate to orient)` : "All placed! Start firing →");

    if (remaining.length === 0) {
      setPhase("play");
      setTurn("player");
    }
  };

  // Player fires on enemy board
  const onEnemyClick = (r: number, c: number) => {
    if (phase !== "play" || turn !== "player" || enemyShots[r][c] !== 0) return;

    try {
      const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
      setEnemyShots(res.shots);
      setEnemyFleet(res.fleet);

      if (allSunk(res.fleet)) {
        setPhase("over");
        setMsg("You win! 🎉");
        return;
      }

      // Alternate turns for simplicity
      setTurn("ai");
      setMsg(res.result === "miss" ? "You missed. AI's turn…" : "Hit! AI's turn…");

      // AI acts after a small delay
      setTimeout(() => {
        aiTurn();
      }, 400);
    } catch {
      /* ignore */
    }
  };

  // AI turn
  const aiTurn = () => {
    const ai = aiRef.current;
    const [rr, cc] = aiPick(playerShots, ai);
    const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
    setPlayerShots(res.shots);
    setPlayerFleet(res.fleet);

    if (res.result === "hit" || res.result === "sunk") {
      aiOnHit(rr, cc, res.shots, ai);
    }

    if (allSunk(res.fleet)) {
      setPhase("over");
      setMsg("AI wins!");
      return;
    }

    setTurn("player");
    setMsg(res.result === "miss" ? "AI missed. Your turn!" : "AI hit you! Your turn.");
  };

  // --- UI ---
  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
        {/* Top row: placement controls (only during placement) */}
        {phase === "place" && (
          <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Ships to place:{" "}
              <span className="tracking-wide">
                {toPlace.join(", ")}
              </span>
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
          {/* Player board: reveal ships, clickable only in placement */}
          <BoardGrid
            title="Your Board"
            grid={playerGrid}
            shots={playerShots}
            revealShips
            onCellClick={phase === "place" ? onPlaceClick : undefined}
            disabled={phase !== "place"}
          />

          {/* Enemy board: never reveal ships (until game over); clickable only when playing & player's turn */}
          <BoardGrid
            title="Enemy Board"
            grid={enemyGrid}
            shots={enemyShots}
            revealShips={phase === "over"} // reveal at the end (optional)
            onCellClick={onEnemyClick}
            disabled={phase !== "play" || turn !== "player"}
          />
        </div>

        {/* Bottom: message + optional inline Reset */}
        <div className="flex items-center justify-between">
            <button
                onClick={reset}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
            >
                Reset
            </button>
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg}</div>
        </div>
      </div>
    </div>
  );
}
