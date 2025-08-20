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

/* ----------------- UI bits ----------------- */
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

/* -------- sunk overlays -------- */
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
  greenEllipseOnly = false,
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
    const el = wrapRef.current; if (!el) return;
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
    <div className="w-full">
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
              {/* emerald pill for any ship (non-sunk) cells when revealShips is true */}
              {showGreen && greenEllipseOnly && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {showGreen && !greenEllipseOnly && (
                <span className="absolute inset-0 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {/* hide X when entire ship sunk; always show O for misses */}
              {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
            </button>
          );
        })}

        {/* sunk overlays (red pill) */}
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

/* ----------------- Main ----------------- */
type Phase = "place" | "play" | "over";
type Entry = "landing" | "bot" | "mp";
type Props = { onRegisterReset?: (fn: () => void) => void; };

export default function BattleshipWeb({ onRegisterReset }: Props) {
  // Invite link detection
  const codeFromHash = parseRoomCodeFromHash() || "";
  const fromInvite = !!codeFromHash;

  // Landing vs Bot vs MP
  const [entry, setEntry] = React.useState<Entry>(fromInvite ? "mp" : "landing");
  const [mode, setMode] = React.useState<MPMode>(() => (fromInvite ? "mp" : "bot"));
  const [role, setRole] = React.useState<Role>(fromInvite ? "guest" : "host");
  const [roomCode, setRoomCode] = React.useState<string>(() => codeFromHash);

  // Landing “Join Room” inline box
  const [landingJoinOpen, setLandingJoinOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState("");

  // MP
  const roomRef = React.useRef<Room | null>(null);
  const rObj = () => roomRef.current!;

  // Game state
  const [phase, setPhase] = React.useState<Phase>("place");
  const [orientation, setOrientation] = React.useState<Orientation>("H");

  // Player
  const [playerGrid, setPlayerGrid]   = React.useState<Grid>(() => makeGrid());
  const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
  const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots());

  // Enemy
  const [enemyGrid, setEnemyGrid]   = React.useState<Grid>(() => makeGrid());
  const [enemyFleet, setEnemyFleet] = React.useState<Fleet>({});
  const [enemyShots, setEnemyShots] = React.useState<Shots>(() => makeShots());

  const [toPlace, setToPlace] = React.useState<number[]>(() => [...FLEET_SIZES]);
  const [turn, setTurn] = React.useState<"player" | "ai">("player");
  const [msg, setMsg] = React.useState("Place your ships (Toggle Orientation)");

  // ask/answer flow for rematch when game is over (incl. quit)
  const [rematchAskFromPeer, setRematchAskFromPeer] = React.useState<null | Role>(null);

  // live refs for MP handlers
  const roleRef = React.useRef(role);
  const playerGridRef = React.useRef(playerGrid);
  const playerFleetRef = React.useRef(playerFleet);
  const playerShotsRef = React.useRef(playerShots);

  React.useEffect(() => { roleRef.current = role; }, [role]);
  React.useEffect(() => { playerGridRef.current = playerGrid; }, [playerGrid]);
  React.useEffect(() => { playerFleetRef.current = playerFleet; }, [playerFleet]);
  React.useEffect(() => { playerShotsRef.current = playerShots; }, [playerShots]);

  // reveal state
  const [enemyRevealed, setEnemyRevealed] = React.useState(false);
  const sentRevealRef = React.useRef(false); 

  const aiRef = React.useRef(makeAIState());

  // Ready flags
  const [iAmReady, setIAmReady] = React.useState(false);
  const [peerReady, setPeerReady] = React.useState(false);
  // Opponent presence/state
  const [peerPresent, setPeerPresent] = React.useState(false);
  const [peerState, setPeerState] = React.useState<"unknown" | "joining" | "present" | "left" | "quit">("unknown");

  // Seed bot enemy when needed
  React.useEffect(() => {
    if (mode === "bot") {
      const { grid, fleet } = randomFleet();
      setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode]);

  // Global rotate hotkey — ignore if user is typing
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, [contenteditable="true"]'))) return;
      if (phase === "place" && (e.key === "r" || e.key === "R")) {
        setOrientation((o) => (o === "H" ? "V" : "H"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Reset (local)
  const resetLocal = React.useCallback(() => {
    // keep peerPresent as-is; just clear quit marker back to present if they’re still here
    setPeerState(prev => (prev === "quit" ? (peerPresent ? "present" : "left") : prev));
    setPhase("place"); setOrientation("H");
    setPlayerGrid(makeGrid()); setPlayerFleet({});
    setPlayerShots(makeShots());
    setEnemyGrid(makeGrid()); setEnemyFleet({});
    setEnemyShots(makeShots());
    setToPlace([...FLEET_SIZES]);
    setTurn("player");
    aiRef.current = makeAIState();
    setMsg("Place your ships (Toggle Orientation)");
    setIAmReady(false); setPeerReady(false);
    setEnemyRevealed(false);

    sentRevealRef.current = false;   // ← add this line

    if (mode === "bot") {
      const { grid, fleet } = randomFleet(); setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode]);

  /* ---- MP wiring ---- */
  const ensureRoom = React.useCallback(async (asHost: boolean) => {
    const adapter = await createFirebaseAdapter();
    const code = asHost ? (roomCode || generateCode()) : roomCode;
    if (!code) return;
    setRoomCode(code);

    // If I'm host, I'm waiting for a guest; if I'm guest, host already exists
    setPeerState(asHost ? "joining" : "present");
    setPeerPresent(!asHost);

    const r = new Room(adapter, code, asHost ? "host" : "guest", {
      onShot: ({ by, r, c }) => {
        const myRole = roleRef.current;
        const theyTargetedUs = (by === "host" && myRole === "guest") || (by === "guest" && myRole === "host");
        if (!theyTargetedUs) return;

        const res = receiveShot(
          playerGridRef.current,
          playerShotsRef.current,
          playerFleetRef.current,
          r, c
        );
        setPlayerShots(() => res.shots);
        setPlayerFleet(() => res.fleet);

        // tell attacker their result
        roomRef.current?.result(by, (res.result === "hit" || res.result === "sunk") ? res.result : "miss", r, c);

        if (allSunk(res.fleet)) {
          setPhase("over");
          setEnemyRevealed(true); // reveal opponent ships when we lose (your screen)
          setMsg("Opponent wins!");
          roomRef.current?.phase("over");
        } else {
          setTurn("player");
          setMsg(res.result === "miss" ? "Opponent missed. Your turn!" : "Opponent hit you! Your turn.");
        }
      },

      onResult: ({ to, result, r, c }) => {
        const myRole = roleRef.current;
        if (to !== myRole) return;
        setEnemyShots(prev => {
          const next = prev.map(row => row.slice());
          next[r][c] = result === "miss" ? 1 : 2;
          return next;
        });
        setMsg(
          result === "sunk" ? "Sunk! Opponent’s turn…" :
          result === "hit"  ? "Hit! Opponent’s turn…" :
                              "You missed. Opponent’s turn…"
        );
        setTurn("ai");
      },

      onPhase: (ph) => {
        setPhase(ph);
        if (ph === "over") {
          // End-of-game: reveal opponent ships on your screen
          setEnemyRevealed(true);
        }
      },

      onRematch: () => resetLocal(),

      onReady: ({ by, ready }) => {
        const mine = roleRef.current;
        if (by !== mine) setPeerReady(!!ready);
      },

      // Optional hooks if your adapter supports them:
      onPeerBye: async (_by) => {
        setPeerPresent(false);
        setPeerState("left");
        setPeerReady(false);
        setMsg("Opponent left. Waiting for a new player…");
        resetLocal();
        // If you implemented bumpEpoch on the Room, host can call it here to clear history
        try { await roomRef.current?.bumpEpoch?.(); } catch {}
      },

      onPeerHello: () => {
        setPeerPresent(true);
        setPeerState("present");
      },

      onQuit: (by) => {
        // Opponent (or me) triggered quit — enter over state and reveal.
        setPeerState("quit");
        setPhase("over");
        setMsg("Opponent quit. Revealing boards…");
        // Ensure I send my board once, so both sides can reveal each other
        if (!sentRevealRef.current) {
          sentRevealRef.current = true;
          try {
            roomRef.current?.reveal(roleRef.current, playerGridRef.current as unknown as number[][], playerFleetRef.current as unknown as Record<string, any>);
          } catch {}
        }
      },

      onRematchSignal: ({ action, by }) => {
        const me = roleRef.current;
        if (action === "propose" && by !== me) {
          // Peer asked — show Yes/No prompt locally
          setRematchAskFromPeer(by);
          setMsg("Opponent wants a rematch. Accept?");
        } else if (action === "accept") {
          // Either side accepted -> both reset
          setRematchAskFromPeer(null);
          resetLocal();
          setMsg("Rematch starting. Place your ships.");
        } else if (action === "decline") {
          setRematchAskFromPeer(null);
          setMsg("Rematch declined.");
        }
      },

      onEpoch: (_n) => {
        // host marked a fresh session (e.g., after guest leaves or host exits)
        resetLocal();
        setMsg("New session started.");
      },
      
      onReveal: ({ by, grid, fleet }) => {
        // If the reveal is from the other side, that is my "enemy" board
        const mine = roleRef.current;
        if (by === mine) return; // ignore my own echo
        setEnemyGrid(grid as unknown as Grid);
        setEnemyFleet(fleet as unknown as Fleet);
        setEnemyRevealed(true);
      },
    });

    roomRef.current = r;
    setRole(asHost ? "host" : "guest");
    if (asHost) await r.create();
    else await r.join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DIRECT INVITE: auto-join room immediately (skip 3-button landing)
  React.useEffect(() => {
    if (!fromInvite) return;
    if (roomRef.current) return;
    setEntry("mp");
    setMode("mp");
    setRole("guest");
    setRoomCode(codeFromHash);
    ensureRoom(false); // join as guest
    setMsg("Joining room…");
  }, [fromInvite, codeFromHash, ensureRoom]);

  /* ---- Placement ---- */
  const onPlaceClick = (r: number, c: number) => {
    if (phase !== "place" || toPlace.length === 0) return;
    const length = toPlace[0];
    if (!canPlace(playerGrid, r, c, length, orientation)) { setMsg("Can't place there"); return; }
    const nextId = Object.keys(playerFleet).length + 1;
    const res = placeShip(playerGrid, playerFleet, nextId, r, c, length, orientation);
    setPlayerGrid(res.grid); setPlayerFleet(res.fleet);

    const remaining = toPlace.slice(1);
    setToPlace(remaining);
    setMsg(remaining.length ? `Placed ${length}. Next: ${remaining[0]} (Toggle Orientation)` : "All placed!");

    if (remaining.length === 0) {
      if (mode === "bot") {
        setPhase("play"); setTurn("player"); setMsg("Start firing →");
      } else {
        setIAmReady(true);
        try { roomRef.current?.ready(roleRef.current, true); } catch {}
        setMsg("Waiting for opponent to finish placement…");
      }
    }
  };

  const opponentStatus = React.useMemo(() => {
    const isHost = role === "host";

    // Map role → opponent label
    const opp = isHost ? "Guest" : "Host";

    // Special rules for guest: never show "Host joining..." or "Host left room"
    if (!isHost) {
      if (peerState === "quit") return `${opp} quit game`;
      // During placement: show ready/placing if we know their readiness
      if (phase === "place") {
        return peerReady ? `${opp} is ready` : `${opp} placing ships...`;
      }
      if (phase === "play") return `${opp} in game`;
      if (phase === "over") return `${opp} in game`;
      return ""; // no "Host joining/left" per your requirement
    }

    // Host view (show full set)
    switch (peerState) {
      case "joining": return "Guest joining...";
      case "left":    return "Guest left room";
      case "quit":    return "Guest quit game";
      case "present":
      default:
        if (phase === "place") return peerReady ? "Guest is ready" : "Guest placing ships...";
        if (phase === "play")  return "Guest in game";
        if (phase === "over")  return "Guest in game";
        return "Guest joining...";
    }
  }, [role, peerState, phase, peerReady]);

  /* ---- Bot turn ---- */
  const aiTurn = () => {
    const ai = aiRef.current;
    const [rr, cc] = aiPick(playerShots, ai);
    const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
    setPlayerShots(res.shots); setPlayerFleet(res.fleet);
    if (res.result === "hit" || res.result === "sunk") aiOnHit(rr, cc, res.shots, ai);
    if (allSunk(res.fleet)) {
      setPhase("over");
      setEnemyRevealed(true); // reveal enemy when you lose vs bot
      setMsg("Bot wins!");
      return;
    }
    setTurn("player"); setMsg(res.result === "miss" ? "Bot missed. Your turn!" : "Bot hit you! Your turn.");
  };

  /* ---- Fire on enemy ---- */
  const onEnemyClick = (r: number, c: number) => {
    if (phase !== "play") return;

    if (mode === "bot") {
      if (turn !== "player" || enemyShots[r][c] !== 0) return;
      try {
        const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
        setEnemyShots(res.shots); setEnemyFleet(res.fleet);
        if (allSunk(res.fleet)) {
          setPhase("over"); setMsg("You win! 🎉");
          setEnemyRevealed(true);
          return;
        }
        setTurn("ai"); setMsg(res.result === "miss" ? "You missed. Bot's turn…" : "Hit! Bot's turn…");
        setTimeout(() => aiTurn(), 400);
      } catch { /* noop */ }
      return;
    }

    // MP
    if (turn !== "player" || enemyShots[r][c] !== 0) return;
    roomRef.current?.shot(roleRef.current, r, c);
    setMsg("Fired. Waiting for result…");
  };

  /* ---- Ready gate ---- */
  React.useEffect(() => {
    if (mode !== "mp") return;
    if (phase !== "place") return;
    if (!iAmReady || !peerReady) return;

    setPhase("play");
    const amHost = roleRef.current === "host";
    setTurn(amHost ? "player" : "ai");
    setMsg(amHost ? "You go first. Fire when ready." : "Host goes first. Waiting…");
    try { roomRef.current?.phase("play"); } catch {}
  }, [mode, phase, iAmReady, peerReady]);

  const inviteHash = roomCode ? buildInviteHash(roomCode) : "";

  /* ---- Landing with inline Join ---- */
  if (entry === "landing") {
    return (
      <div className="w-full mt-16 flex justify-center">
        <div className="w-full max-w-sm mx-auto p-6 rounded-xl bg-gray-100 dark:bg-gray-800 shadow-md transition-all border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center gap-3">
            <button
              className="w-full max-w-[220px] px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 text-white"
              onClick={() => { setEntry("bot"); setMode("bot"); resetLocal(); }}
            >
              Play with Bot
            </button>

            <button
              className="w-full max-w-[220px] px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white"
              onClick={() => { setEntry("mp"); setMode("mp"); resetLocal(); ensureRoom(true); }}
            >
              Create Room (Online)
            </button>

            {!landingJoinOpen ? (
              <button
                className="w-full max-w-[220px] px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white"
                onClick={() => { setLandingJoinOpen(true); setJoinCode(""); }}
              >
                Join Room (Online)
              </button>
            ) : (
              <div className="w-full flex flex-col items-center gap-2">
                <div className="w-full flex gap-2">
                  <input
                    autoFocus
                    inputMode="text"
                    pattern="[A-Za-z0-9]{4}"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,4))}
                    placeholder="Code (e.g., AX9G)"
                    className="flex-1 px-3 py-2 rounded-md bg-white/90 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 ring-1 ring-black/10 dark:ring-white/10 outline-none"
                    aria-label="Room code"
                  />
                  <button
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                    disabled={joinCode.length !== 4}
                    onClick={() => {
                      setEntry("mp");
                      setMode("mp");
                      setRole("guest");
                      setRoomCode(joinCode);
                      resetLocal();
                      ensureRoom(false);
                      setMsg("Joining room…");
                    }}
                  >
                    Join
                  </button>
                </div>
                <button
                  className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                  onClick={() => setLandingJoinOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- MP header ---- */
  const MPHeader = () => (
    <div className="p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-800 dark:text-gray-200">
          {opponentStatus || "Invite Player"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            onClick={() => { roomRef.current?.leave(); setEntry("landing"); setMode("bot"); resetLocal(); }}
            title="Back to mode selection"
          >
            ← Back
          </button>
          {roomRef.current && phase !== "over" && (
            <button
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white"
              onClick={() => {
                try {
                  roomRef.current?.quit(roleRef.current);
                  // After quitting, send my reveal once
                  if (!sentRevealRef.current) {
                    sentRevealRef.current = true;
                    // playerGrid / playerFleet are my placements; cast to JSON-y shapes
                    roomRef.current?.reveal(roleRef.current, playerGrid as unknown as number[][], playerFleet as unknown as Record<string, any>);
                  }
                } catch {}
                setPhase("over");
                setMsg("You quit the game. Revealing boards…");
              }}
            >
              Quit Game
            </button>
          )}
          {roomRef.current && (
            <button
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-white"
              onClick={async () => {
                // If host, mark a fresh session so the next guest starts clean
                if (roleRef.current === "host") {
                  try { await roomRef.current?.bumpEpoch(); } catch {}
                }
                await roomRef.current?.leave();
                setEntry("landing"); setMode("bot"); resetLocal();
              }}
              title="Leave room"
            >
              Exit Room
            </button>
          )}
        </div>
      </div>

      {/* Status while connecting */}
      {!roomRef.current ? (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {role === "host" ? "Creating room…" : "Joining room…"}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-200">
            Room: <b>{roomCode}</b> ({role})
          </span>
          <button
            className="px-3 py-1.5 rounded-lg bg-gray-700 text-white"
            onClick={() => {
              const { origin, pathname } = window.location;
              const isDark = document.documentElement.classList.contains("dark");
              const theme = isDark ? "dark" : "light";
              navigator.clipboard.writeText(`${origin}${pathname}?theme=${theme}${inviteHash}`);
            }}
          >
            Copy Invite Link
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
        {mode === "mp" && <MPHeader />}

        {/* Placement controls */}
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
        {mode === "bot" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BoardGrid
              title="Your Board"
              grid={playerGrid}
              shots={playerShots}
              revealShips
              greenEllipseOnly
              onCellClick={phase === "place" ? onPlaceClick : undefined}
              disabled={phase !== "place"}
            />
            <BoardGrid
              title="Enemy Board"
              grid={enemyGrid}
              shots={enemyShots}
              revealShips={phase === "over" && enemyRevealed}
              onCellClick={onEnemyClick}
              disabled={phase !== "play" || turn !== "player"}
            />
          </div>
        ) : (
          <>
            {phase === "place" && (
              <div className="grid grid-cols-1 gap-6">
                <BoardGrid
                  title="Your Board (place your ships)"
                  grid={playerGrid}
                  shots={playerShots}
                  revealShips
                  greenEllipseOnly
                  onCellClick={onPlaceClick}
                  disabled={toPlace.length === 0}
                />
                {iAmReady && !peerReady && (
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    You’re ready. Waiting for opponent…
                  </div>
                )}
                {!iAmReady && peerReady && (
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Opponent is ready. Place your ships!
                  </div>
                )}
              </div>
            )}
            {phase === "play" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BoardGrid
                  title="Your Board"
                  grid={playerGrid}
                  shots={playerShots}
                  revealShips
                  greenEllipseOnly
                  disabled
                />
                <BoardGrid
                  title="Enemy Board"
                  grid={enemyGrid}
                  shots={enemyShots}
                  revealShips={false}
                  onCellClick={onEnemyClick}
                  disabled={turn !== "player"}
                />
              </div>
            )}
            {phase === "over" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BoardGrid
                  title="Your Board"
                  grid={playerGrid}
                  shots={playerShots}
                  revealShips
                  greenEllipseOnly
                  disabled
                />
                <BoardGrid
                  title="Enemy Board"
                  grid={enemyGrid}
                  shots={enemyShots}
                  revealShips={enemyRevealed}
                  onCellClick={() => {}}
                  disabled
                />
              </div>
            )}
          </>
        )}

        {/* Bottom bar */}
        <div className="flex items-center justify-between">
          {mode === "bot" ? (
            <button
              onClick={resetLocal}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
            >
              Reset
            </button>
          ) : roomRef.current ? (
            phase === "over" ? (
              <button
                onClick={() => {
                  try { roomRef.current?.rematch("propose", roleRef.current); } catch {}
                  setMsg("Asked for a rematch…");
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
              >
                Rematch
              </button>
            ) : (
              <div />
            )
          ) : (
            <div />
          )}
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg}</div>
        </div>

        {rematchAskFromPeer && (
          <div className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
            Opponent wants a rematch. Accept?
            <button
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
              onClick={() => {
                try { roomRef.current?.rematch("accept", roleRef.current); } catch {}
                setRematchAskFromPeer(null);
                resetLocal();
                setMsg("Rematch starting. Place your ships.");
              }}
            >
              Yes
            </button>
            <button
              className="px-3 py-1.5 rounded-lg bg-gray-600 text-white"
              onClick={() => {
                try { roomRef.current?.rematch("decline", roleRef.current); } catch {}
                setRematchAskFromPeer(null);
                setMsg("Rematch declined.");
              }}
            >
              No
            </button>
          </div>
        )}

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

