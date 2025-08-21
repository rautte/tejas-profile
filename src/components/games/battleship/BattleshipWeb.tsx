// src/components/games/battleship/BattleshipWeb.tsx

import { ReactComponent as AnchorCrest } from "../../../assets/anchor-crest.svg";
import { ReactComponent as LifebuoyRope } from "../../../assets/lifebuoy-rope.svg";
import { ReactComponent as CompassShield } from "../../../assets/compass-shield.svg";
import { ReactComponent as TridentWaves } from "../../../assets/trident-waves.svg";
import { ReactComponent as HelmStar } from "../../../assets/helm-star.svg";

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

// Controls the width of the *single* placement grid (MP only)
const PLACE_GRID_WIDTH = "min(92vw, 520px)"; // tweak freely (e.g., "min(90vw, 460px)")

// --- Emblem pool (ordered list) ---
const EMBLEMS = [AnchorCrest, LifebuoyRope, CompassShield, TridentWaves, HelmStar] as const;

// --- Deterministic hash (FNV-1a-ish) to keep picks stable per session ---
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

// simple, crisp line icons that inherit currentColor
const IconSignal: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
    <path d="M2 20a10 10 0 0 1 20 0" />
    <path d="M6 20a6 6 0 0 1 12 0" />
    <path d="M10 20a2 2 0 0 1 4 0" />
  </svg>
);

const IconLink: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l1.17-1.17a5 5 0 0 0-7.07-7.07L9.9 5"/>
    <path d="M14 11a5 5 0 0 0-7.07 0L5.76 12.2a5 5 0 0 0 7.07 7.07L14.1 19"/>
  </svg>
);

const IconCpu: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2"/>
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>
  </svg>
);

// --- Team emblem badge (SVG from assets; accepts a chosen Icon) ---
const TeamEmblem: React.FC<{
  role: Role;
  Icon?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  size?: number;
  title?: string;
}> = ({ role, Icon, size = 40, title }) => {
  const bubble =
    role === "host"
      ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
      : "bg-emerald-600/10 text-emerald-600 dark:text-emerald-300";

  const iconSize = Math.max(10, size - 4);
  // Fallback: if no Icon passed, default to basic role icons
  const Fallback = role === "host" ? AnchorCrest : LifebuoyRope;
  const IconToUse = Icon ?? Fallback;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 ${bubble}`}
      style={{ width: size, height: size }}
      aria-label={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
      title={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
    >
      <IconToUse width={iconSize} height={iconSize} aria-hidden="true" />
    </span>
  );
};

// --- Whole-emblem watermark (badge + exact colors) ---
type Anchor = Partial<Record<"top" | "right" | "bottom" | "left", number | string>>;
type WMPos =
  | "center"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  | "top" | "bottom" | "left" | "right";

const WATERMARK_SAFE_INSET = 4; // ← tweak this: 48..96 works well

const WatermarkEmblem: React.FC<{
  role: Role;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  size?: number | string;    // px number or CSS string (e.g., "56vw")
  opacity?: number;          // overall fade (0..1)
  ring?: boolean;            // keep subtle ring
}> = ({ role, Icon, size = 520, opacity = 1, ring = true }) => {
  // EXACT same palette as TeamEmblem
  const bubbleBgClass = role === "host" ? "bg-blue-600/10" : "bg-emerald-600/10";
  const iconColorClass = role === "host"
    ? "text-blue-700 dark:text-blue-300"
    : "text-emerald-600 dark:text-emerald-300";
  const ringClass = ring ? "ring-1 ring-black/10 dark:ring-white/10" : "";

  const dim = typeof size === "number" ? `${size}px` : size;

  return (
    // sized box; parent flex will center this in the viewport
    <div className="relative pointer-events-none" style={{ width: dim, height: dim, opacity }}>
      {/* badge (big circle) */}
      <div className={`absolute inset-0 rounded-full ${bubbleBgClass} ${ringClass}`} aria-hidden />
      {/* emblem icon tinted exactly like TeamEmblem */}
      <Icon
        className={`absolute ${iconColorClass}`}
        style={{ top: 12, right: 12, bottom: 12, left: 12, position: "absolute" }} // inner padding
        aria-hidden="true"
      />
    </div>
  );
};


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
  title: React.ReactNode;
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

  // [FIX] Show emblem only after we've ever seen the peer at least once this session
  const everHadPeerRef = React.useRef(false);

  // Game state
  const [phase, setPhase] = React.useState<Phase>("place");
  const [orientation, setOrientation] = React.useState<Orientation>("H");

  // [FIX] session id for emblem seeding
  const [epoch, setEpoch] = React.useState<number>(0);

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

  const turnRef = React.useRef(turn);
  React.useEffect(() => { turnRef.current = turn; }, [turn]);

  // live refs for MP handlers
  const phaseRef = React.useRef(phase);
  const roleRef = React.useRef(role);
  const playerGridRef = React.useRef(playerGrid);
  const playerFleetRef = React.useRef(playerFleet);
  const playerShotsRef = React.useRef(playerShots);
  // presence ack bookkeeping
  const lastHelloFromPeerAtRef = React.useRef(0);
  const lastHelloAckSentAtRef = React.useRef(0);
  // [FIX] indicates a grace-resume is in progress (prevents resetting turn)
  const resumedWithinGraceRef = React.useRef(false);

  React.useEffect(() => { phaseRef.current = phase; }, [phase]);
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

  const peerReadyRef = React.useRef(peerReady);
  React.useEffect(() => { peerReadyRef.current = peerReady; }, [peerReady]);

  const iAmReadyRef = React.useRef(iAmReady);
  React.useEffect(() => { iAmReadyRef.current = iAmReady; }, [iAmReady]);

  // MP presence/status of the *opponent*
  const [peerPresent, setPeerPresent] = React.useState(false);
  const [peerState, setPeerState] = React.useState<"joining" | "placing" | "ready" | "quit" | "left">("joining");

  // Presence tracking for timers
  const peerPresentRef = React.useRef(peerPresent);
  React.useEffect(() => { peerPresentRef.current = peerPresent; }, [peerPresent]);
  const rejoinTimerRef = React.useRef<number | null>(null);
  const lastByeAtRef = React.useRef<number | null>(null);
  const RESUME_WINDOW_MS = 30_000;

  React.useEffect(() => {
    const onBeforeUnload = () => {
      if (!roomCode || !roomRef.current) return; // no active MP session
      try {
        saveLocalResume(roomCode, roleRef.current, {
          exp: Date.now() + RESUME_WINDOW_MS,
          playerGrid: playerGridRef.current,
          playerFleet: playerFleetRef.current,
          iAmReady: iAmReadyRef.current ?? false,
          turn: turnRef.current, // [FIX]
        });
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [roomCode]); // rebind when room changes

  // [ADD] sessionStorage key helpers for per-room, per-role resumes
  const resumeKey = (code: string, role: Role) => `bs:${code}:${role}:resume-v1` as const;

  type ResumeBlob = {
    exp: number;                  // expiry timestamp
    playerGrid: Grid;
    playerFleet: Fleet;
    iAmReady: boolean;
    turn: "player" | "ai";        // [FIX] preserve whose turn it was
  };

  // [FIX] use localStorage so new tabs (invite link) can resume within 30s
  function saveLocalResume(code: string, role: Role, blob: ResumeBlob) {
    try { localStorage.setItem(resumeKey(code, role), JSON.stringify(blob)); } catch {}
  }
  function loadLocalResume(code: string, role: Role): ResumeBlob | null {
    try {
      const raw = localStorage.getItem(resumeKey(code, role));
      if (!raw) return null;
      const data = JSON.parse(raw) as ResumeBlob;
      if (!data || Date.now() > data.exp) return null; // expired
      return data;
    } catch { return null; }
  }
  function clearLocalResume(code: string, role: Role) {
    try { localStorage.removeItem(resumeKey(code, role)); } catch {}
  }

  // Snapshot buffer for resume
  const lastSnapshotRef = React.useRef<any>(null);

  // helper: build a compact state snapshot to send to the peer
  const buildStateSnapshot = React.useCallback(() => ({
    phase,
    turn,
    playerGrid,
    playerFleet,
    playerShots,
    enemyGrid,
    enemyFleet,
    enemyShots,
    iAmReady,
    peerReady,
    msg,
  }), [
    phase, turn,
    playerGrid, playerFleet, playerShots,
    enemyGrid, enemyFleet, enemyShots,
    iAmReady, peerReady, msg
  ]);

  // apply a snapshot received from the peer (used when I rejoin)
  const applyStateSnapshot = React.useCallback((s: any) => {
    try {
      if (s.phase) setPhase(s.phase);
      if (s.turn) setTurn(s.turn);
      if (s.playerGrid) setPlayerGrid(s.playerGrid);
      if (s.playerFleet) setPlayerFleet(s.playerFleet);
      if (s.playerShots) setPlayerShots(s.playerShots);
      if (s.enemyGrid) setEnemyGrid(s.enemyGrid);
      if (s.enemyFleet) setEnemyFleet(s.enemyFleet);
      if (s.enemyShots) setEnemyShots(s.enemyShots);
      if (typeof s.iAmReady === "boolean") setIAmReady(s.iAmReady);
      if (typeof s.peerReady === "boolean") setPeerReady(s.peerReady);
      if (typeof s.msg === "string") setMsg(s.msg);
      setEnemyRevealed(false); // on resume, do NOT reveal
    } catch {}
  }, []);

  // keep snapshot fresh at key points (local only)
  const captureStateSnapshot = React.useCallback(() => {
    lastSnapshotRef.current = buildStateSnapshot();
  }, [buildStateSnapshot]);

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
    sentRevealRef.current = false;
    lastSnapshotRef.current = null;

    if (mode === "bot") {
      const { grid, fleet } = randomFleet(); setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode, peerPresent]);

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
          setEnemyRevealed(true);
          setMsg("Opponent wins!");
          roomRef.current?.phase("over");
        } else {
          setTurn("player");
          setMsg(res.result === "miss" ? "Opponent missed. Your turn!" : "Opponent hit you! Your turn.");
        }
        captureStateSnapshot();
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
        captureStateSnapshot();
      },

      onPhase: (ph) => {
        if (ph === "over" && !peerPresentRef.current) return;
        setPhase(ph);
        captureStateSnapshot();
      },

      onRematch: () => resetLocal(),

      onReady: ({ by, ready }) => {
        const me = roleRef.current;
        if (by === me) {
          setIAmReady(ready);
        } else {
          setPeerReady(ready);
        }

        // [FIX] If both are ready and we’re not in play, host authoritatively resumes play.
        // This covers rejoin where the leaver re-emits ready after restoring.
        const bothReady = (by === me ? ready : iAmReadyRef.current) && (by === me ? peerReadyRef.current : ready);
        if (bothReady && phaseRef.current !== "play" && me === "host") {
          try { roomRef.current?.phase("play"); } catch {}
        }
      },

      // 30s grace on disconnect — no reveal, no reset yet
      onPeerBye: async () => {
        lastByeAtRef.current = Date.now();
        setPeerPresent(false);
        setPeerState("left");
        setPeerReady(false);
        setMsg("Opponent left. Waiting up to 30s to rejoin…");

        if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
        rejoinTimerRef.current = window.setTimeout(async () => {
          rejoinTimerRef.current = null;
          if (peerPresentRef.current) return; // returned in time
          if (roleRef.current === "host") {
            try { await roomRef.current?.bumpEpoch(); } catch {}
          }
          resetLocal();
          setPeerState("joining");
          setMsg("Opponent did not return. Waiting for a new player…");
        }, RESUME_WINDOW_MS); // <— use constant
      },

      onPeerHello: (by) => {
        const now = Date.now();

        everHadPeerRef.current = true; // [FIX] we have seen the peer in this session
        setPeerPresent(true);
        setPeerState(phase === "place" ? "placing" : "present");
        setMsg(phase === "play" ? "Game resumed." : "Opponent joined.");

        if (rejoinTimerRef.current) {
          clearTimeout(rejoinTimerRef.current);
          rejoinTimerRef.current = null;
        }

        if (now - lastHelloAckSentAtRef.current > 2000) {
          try { roomRef.current?.hello(roleRef.current); } catch {}
          lastHelloAckSentAtRef.current = now;
        }
      },

      onQuit: () => {
        setPeerState("quit");
        setPhase("over");
        setMsg("Opponent quit. Revealing boards…");
        // reveal only on Quit (never on Leave)
        if (!sentRevealRef.current) {
          sentRevealRef.current = true;
          try {
            roomRef.current?.reveal(
              roleRef.current, playerGridRef.current as any, playerFleetRef.current as any
            );
          } catch {}
        }
      },

      onRematchSignal: ({ action, by }) => {
        const me = roleRef.current;
        if (action === "propose" && by !== me) {
          setRematchAskFromPeer(by);
          setMsg("Opponent wants a rematch. Accept?");
        } else if (action === "accept") {
          setRematchAskFromPeer(null);
          resetLocal();
          setMsg("Rematch starting. Place your ships.");
        } else if (action === "decline") {
          setRematchAskFromPeer(null);
          setMsg("Rematch declined.");
        }
      },

      onEpoch: (n) => {
        setEpoch(typeof n === "number" ? n : 0);
        everHadPeerRef.current = false; // [FIX] new session: no peer yet
        resetLocal();
        setMsg("New session started.");
      },

      onReveal: ({ by, grid, fleet }) => {
        const mine = roleRef.current;
        if (by === mine) return;
        setEnemyGrid(grid as unknown as Grid);
        setEnemyFleet(fleet as unknown as Fleet);
        setEnemyRevealed(true);
      },

      // Resume handler: apply peer’s snapshot if I’m the one who rejoined
      onState: ({ by, state }) => {
        const me = roleRef.current;
        if (by === me) return;
        applyStateSnapshot(state);
        setMsg("Resumed match.");
      },
    });

    roomRef.current = r;
    setRole(asHost ? "host" : "guest");

    if (asHost) {
      const e = (await (r.create() as unknown)) as number | void; // may return epoch
      setPeerPresent(false);
      setPeerState("joining");
      if (typeof e === "number") setEpoch(e); // [FIX] seed from connect

      const blobH = loadLocalResume(code, "host");
      if (blobH) {
        setPlayerGrid(blobH.playerGrid);
        setPlayerFleet(blobH.playerFleet);
        setIAmReady(!!blobH.iAmReady);
        setTurn(blobH.turn); // [FIX]
        try {
          if (blobH.iAmReady) { roomRef.current?.ready("host", true); }
        } catch {}
        clearLocalResume(code, "host");
        resumedWithinGraceRef.current = true; // [FIX]
        setMsg("Resumed your board. Waiting for guest…");
      }

    } else {
      const e = (await (r.join() as unknown)) as number | void; // may return epoch
      if (typeof e === "number") setEpoch(e); // [FIX] seed from connect

      // [ADD] Attempt local resume if within 30s and same room
      const blob = loadLocalResume(code, "guest");
      if (blob) {
        setPlayerGrid(blob.playerGrid);
        setPlayerFleet(blob.playerFleet);
        setIAmReady(!!blob.iAmReady);
        setTurn(blob.turn); // [FIX] keep the real turn
        try {
          if (blob.iAmReady) { roomRef.current?.ready("guest", true); }
        } catch {}
        clearLocalResume(code, "guest");
        resumedWithinGraceRef.current = true; // [FIX] don't reset turn in ready gate
        setMsg("Resumed your board. Waiting for opponent/status…");
      }
    }
    // proactively say hello once we’re connected (idempotent)
    try { roomRef.current?.hello(roleRef.current); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [ADD] if both ready but not in play (e.g., rejoin ordering), host asserts play once.
  React.useEffect(() => {
    if (iAmReady && peerReady && phase !== "play" && roleRef.current === "host" && roomRef.current) {
      try { roomRef.current.phase("play"); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iAmReady, peerReady, phase]);

  // nudge the peer if we still think they're absent shortly after connect
  React.useEffect(() => {
    if (!peerPresent && roomRef.current) {
      const id = window.setTimeout(() => {
        if (!peerPresent && roomRef.current) {
          try { roomRef.current.hello(roleRef.current); } catch {}
        }
      }, 1000); // 1s after mount/rejoin
      return () => clearTimeout(id);
    }
  }, [peerPresent]);

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

    captureStateSnapshot();

    if (remaining.length === 0) {
      if (mode === "bot") {
        setPhase("play"); setTurn("player"); setMsg("Start firing →");
      } else {
        setIAmReady(true);
        try { roomRef.current?.ready(roleRef.current, true); } catch {}
        setMsg("Waiting for opponent to finish placement…");
      }
      captureStateSnapshot();
    }
  };

  /* ---- Bot turn ---- */
  const aiTurn = () => {
    const ai = aiRef.current;
    const [rr, cc] = aiPick(playerShots, ai);
    const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
    setPlayerShots(res.shots); setPlayerFleet(res.fleet);
    if (res.result === "hit" || res.result === "sunk") aiOnHit(rr, cc, res.shots, ai);
    if (allSunk(res.fleet)) {
      setPhase("over");
      setEnemyRevealed(true);
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
    if (turn !== "player" || enemyShots[r][c] !== 0 || !peerPresent) return;
    roomRef.current?.shot(roleRef.current, r, c);
    setMsg("Fired. Waiting for result…");
  };

  /* ---- Ready gate ---- */
  React.useEffect(() => {
    if (mode !== "mp") return;
    if (phase !== "place") return;
    if (!iAmReady || !peerReady) return;

    setPhase("play");

    if (!resumedWithinGraceRef.current) {
      // [FIX] only set initial turn for fresh games
      const amHost = roleRef.current === "host";
      setTurn(amHost ? "player" : "ai");
      setMsg(amHost ? "You go first. Fire when ready." : "Host goes first. Waiting…");
    } else {
      // [FIX] resume path: keep existing turn, just update status
      setMsg(turnRef.current === "player" ? "Your turn. Resume firing." : "Opponent's turn. Waiting…");
    }

    try { roomRef.current?.phase("play"); } catch {}
    captureStateSnapshot();

    // clear the flag once we've transitioned
    resumedWithinGraceRef.current = false;
  }, [mode, phase, iAmReady, peerReady]);

  const inviteHash = roomCode ? buildInviteHash(roomCode) : "";

  // [FIX] Pick a stable emblem per role for this session (roomCode + epoch)
  const [HostEmblemIcon, GuestEmblemIcon] = React.useMemo(() => {
    if (!roomCode) return [EMBLEMS[0], EMBLEMS[1]] as const;
    const seed = hashSeed(`${roomCode}|${epoch}`);
    const hostIdx = seed % EMBLEMS.length;

    // derive a second index for guest; ensure distinct
    let guestIdx = ((seed * 1103515245 + 12345) >>> 0) % EMBLEMS.length;
    if (guestIdx === hostIdx) guestIdx = (guestIdx + 1) % EMBLEMS.length;

    return [EMBLEMS[hostIdx], EMBLEMS[guestIdx]] as const;
  }, [roomCode, epoch]);

  // [ADD] pick my own emblem icon for the watermark
  const MyEmblemIcon = role === "host" ? HostEmblemIcon : GuestEmblemIcon;

  // Compute opponent status (must be before any early returns so hooks are not conditional)
  const opponentStatus = React.useMemo(() => {
    const isHost = role === "host";

    if (!peerPresent) {
      if (isHost) {
        return peerState === "left" ? "Guest (signal lost)" : "Guest (making radio contact...)";
      }
      // Guest never shows "Host (making radio contact...)"
      return "";
    }

    if (isHost) {
      if (peerState === "quit") return "Guest (surrendered)";
      if (phase === "place")    return peerReady ? "Guest (battle ready)" : "Guest (charting the grid...)";
      return "Guest (at war)";
    } else {
      if (peerState === "quit") return "Host (surrendered)";
      if (phase === "place")    return peerReady ? "Host (battle ready)" : "Host (charting the grid...)";
      return "Host (at war)";
    }
  }, [role, peerPresent, peerReady, peerState, phase]);

  /* ---- Landing with inline Join ---- */
  if (entry === "landing") {
    return (
      <div className="w-full mt-16 flex justify-center">
        <div className="w-full max-w-sm mx-auto p-6 rounded-xl bg-gray-100 dark:bg-gray-800 shadow-md transition-all border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center gap-6">
            <button
              className="w-full max-w-[180px] px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 text-white"
              onClick={() => { setEntry("bot"); setMode("bot"); resetLocal(); }}
            >
              <span className="inline-flex items-center gap-2">
                <IconCpu className="w-4 h-4 opacity-90" aria-hidden="true" />
                Play with Bot
              </span>
            </button>

            <button
              className="w-full max-w-[180px] px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white"
              onClick={() => { setEntry("mp"); setMode("mp"); resetLocal(); ensureRoom(true); }}
            >
              <span className="inline-flex items-center gap-2">
                <IconSignal className="w-4 h-4 opacity-90" aria-hidden="true" />
                Create Room
              </span>
            </button>

            {!landingJoinOpen ? (
              <button
                className="w-full max-w-[180px] px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white"
                onClick={() => { setLandingJoinOpen(true); setJoinCode(""); }}
              >
                <span className="inline-flex items-center gap-2">
                  <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
                  Join Room
                </span>
              </button>
            ) : (
              <div className="w-full flex flex-col items-center gap-2">
                <div className="flex gap-4">
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

  const MPHeader = () => (
    <div className="p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          {opponentStatus ? (
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
              {/* [FIX] Opponent emblem:
                  - hidden initially (making radio contact) until we ever saw them
                  - visible during 30s grace (rejoinTimerRef.current != null)
                  - visible when present
              */}
              {(everHadPeerRef.current && (peerPresent || rejoinTimerRef.current != null)) && (
                <TeamEmblem
                  role={role === "host" ? "guest" : "host"}
                  Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon}
                  size={40}
                />
              )}

              {/* presence dot (red when not present; green when present) */}
              <span
                className={`inline-block ${peerPresent ? "bg-emerald-500" : "bg-rose-500"} w-3 h-3 rounded-full`}
                aria-hidden
              />

              <span>{opponentStatus}</span>
            </div>
          ) : null}
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
                  if (!sentRevealRef.current) {
                    sentRevealRef.current = true;
                    roomRef.current?.reveal(
                      roleRef.current,
                      playerGrid as unknown as number[][],
                      playerFleet as unknown as Record<string, any>
                    );
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
                // persist my local placement + ready so I can resume within 30s
                try {
                  if (roomCode) {
                    saveLocalResume(roomCode, roleRef.current, {
                      exp: Date.now() + RESUME_WINDOW_MS,
                      playerGrid: playerGridRef.current,
                      playerFleet: playerFleetRef.current,
                      iAmReady: iAmReadyRef.current ?? false,
                      turn: turnRef.current, // [FIX]
                    });
                  }
                } catch {}

                // tell the room we are leaving; do NOT call quit() or bumpEpoch() here
                try { await roomRef.current?.leave(); } catch {}

                // go back to landing or your default
                setEntry("landing");
                // (don’t resetLocal() if you want to keep single-player state; optional)
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
      {/* container with stacking context so watermark can sit behind content */}
      {/* <div className="w-full max-w-5xl mx-auto relative overflow-hidden"> */}
      <div className="w-full max-w-5xl mx-auto relative">
        {/* Watermark — your own emblem, faint and behind all cards/dialogs */}
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <WatermarkEmblem
            role={role}
            Icon={MyEmblemIcon}
            // max 1060px, but never wider than (container width - 2 × SAFE_INSET)
            size={`min(1060px, calc(100% - ${WATERMARK_SAFE_INSET * 2}px))`}
            opacity={0.1}
          />
        </div>

        {/* Foreground content sits above watermark */}
        <div className="flex flex-col gap-6 relative z-10">
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
                title={
                  <span className="inline-flex items-center gap-2">
                    <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
                    Your Board
                  </span>
                }
                grid={playerGrid}
                shots={playerShots}
                revealShips
                greenEllipseOnly
                onCellClick={phase === "place" ? onPlaceClick : undefined}
                disabled={phase !== "place"}
              />
              <BoardGrid
                title={
                  <span className="inline-flex items-center gap-2">
                    <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
                    Enemy Board
                  </span>
                }
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
                  <div className="mx-auto w-full" style={{ width: PLACE_GRID_WIDTH }}>
                    <BoardGrid
                      title="Your Board (place your ships)"
                      grid={playerGrid}
                      shots={playerShots}
                      revealShips
                      greenEllipseOnly
                      onCellClick={onPlaceClick}
                      disabled={toPlace.length === 0}
                    />
                  </div>

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
                    title={
                      <span className="inline-flex items-center gap-2">
                        <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
                        Your Board
                      </span>
                    }
                    grid={playerGrid}
                    shots={playerShots}
                    revealShips
                    greenEllipseOnly
                    disabled
                  />
                  <BoardGrid
                    title={
                      <span className="inline-flex items-center gap-2">
                        <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
                        Enemy Board
                      </span>
                    }
                    grid={enemyGrid}
                    shots={enemyShots}
                    revealShips={phase === "over" && enemyRevealed}
                    onCellClick={onEnemyClick}
                    disabled={!peerPresent || phase !== "play" || turn !== "player"} // [FIX]
                  />
                </div>
              )}
              {phase === "over" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <BoardGrid
                    title={
                      <span className="inline-flex items-center gap-2">
                        <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
                        Your Board
                      </span>
                    }
                    grid={playerGrid}
                    shots={playerShots}
                    revealShips
                    greenEllipseOnly
                    disabled
                  />
                  <BoardGrid
                    title={
                      <span className="inline-flex items-center gap-2">
                        <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
                        Enemy Board
                      </span>
                    }
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

        </div> {/* end: foreground content wrapper */}
      </div>   {/* end: max-w container with watermark */}
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

