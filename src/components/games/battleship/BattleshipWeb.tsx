// src/components/games/battleship/BattleshipWeb.tsx

import React from "react";
import ReactDOM from "react-dom";

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

import SideSpin from "./dev/SideSpin";
// CDN-backed side frames + warmer
import { getSideFrames, warmSideFrames } from "../../../assets/ships/sprites/side.cdn";

import { BoardGrid, NavalCompass, SignalDeck, TeamEmblem, WatermarkEmblem } from "./ui";
import { TOP_SPRITES } from "../../../assets/ships/sprites/top.cdn";
import { EMBLEMS, hashSeed } from "./utils";
import type { IntelLine } from "./ui";
import { Room } from "lib/mp/room";

/* ----------------- Icons & small UI helpers ----------------- */

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

/* ----------------- Styling constants ----------------- */

// width for the single placement grid (MP only)
const PLACE_GRID_WIDTH = "min(92vw, 520px)";
// left/right rail width (same on both sides) — tweak this to scale the center board
const SIDE_RAIL_PX = 350; // was 320
const RIGHT_FLEET_MAXW = 300; // px (try 260–320)
const SHELL_MAXW = "min(1360px, calc(100vw - 96px))";

// watermark: keep edges from touching cards
const WATERMARK_SAFE_INSET = -240;

/* ----------------- Main ----------------- */

type Phase = "place" | "play" | "over";
type Entry = "landing" | "bot" | "mp";
type Props = { onRegisterReset?: (fn: () => void) => void; };

export default function BattleshipWeb({ onRegisterReset }: Props) {
  // HashRouter-safe harbor path for your site:
  const HARBOR_HASH_PATH = "/fun-zone/battleship";
  const gotoHarbor = React.useCallback(() => {
    const finalHash = `#${HARBOR_HASH_PATH}`;
    // Changing location.hash triggers HashRouter + any title logic you have.
    if (window.location.hash !== finalHash) {
      window.location.hash = finalHash;
    } else {
      // If it already matches, manually poke listeners.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    try { document.title = "Battleship"; } catch {}
  }, []);

  // deep-link / invite detection
  const codeFromHash = parseRoomCodeFromHash() || "";
  const fromInvite = !!codeFromHash;

  // entry & MP mode
  const [entry, setEntry] = React.useState<Entry>(fromInvite ? "mp" : "landing");
  const [mode, setMode] = React.useState<MPMode>(() => (fromInvite ? "mp" : "bot"));
  const [role, setRole] = React.useState<Role>(fromInvite ? "guest" : "host");
  const [roomCode, setRoomCode] = React.useState<string>(() => codeFromHash);

  // Keep tab title in sync with room vs harbor
  React.useEffect(() => {
    const base = "Battleship";
    if (!roomRef.current || entry === "landing") {
      try { document.title = base; } catch {}
    } else if (roomCode) {
      try { document.title = `${base} — Room ${roomCode}`; } catch {}
    }
  }, [entry, roomCode]);

  // landing join UX
  const [landingJoinOpen, setLandingJoinOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState("");

  // room + presence
  const roomRef = React.useRef<Room | null>(null);
  const everHadPeerRef = React.useRef(false);
  const [peerPresent, setPeerPresent] = React.useState(false);
  const [peerState, setPeerState] = React.useState<"joining" | "placing" | "ready" | "quit" | "left">("joining");
  const peerPresentRef = React.useRef(peerPresent);
  React.useEffect(() => { peerPresentRef.current = peerPresent; }, [peerPresent]);
  const rejoinTimerRef = React.useRef<number | null>(null);

  // game state
  const [phase, setPhase] = React.useState<Phase>("place");
  const [orientation, setOrientation] = React.useState<Orientation>("H");
  const [epoch, setEpoch] = React.useState<number>(0);
  const [playerGrid, setPlayerGrid]   = React.useState<Grid>(() => makeGrid());
  const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
  const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots());
  const [enemyGrid, setEnemyGrid]     = React.useState<Grid>(() => makeGrid());
  const [enemyFleet, setEnemyFleet]   = React.useState<Fleet>({});
  const [enemyShots, setEnemyShots]   = React.useState<Shots>(() => makeShots());
  const [toPlace, setToPlace]         = React.useState<number[]>(() => [...FLEET_SIZES]);
  const [turn, setTurn]               = React.useState<"player" | "ai">("player");
  const [msg, setMsg]                 = React.useState("Deploy your fleet (press R to rotate)");
  const [rematchAskFromPeer, setRematchAskFromPeer] = React.useState<null | Role>(null);

  // -------- Side-spin perf tuning --------
  // ID of the next ship we’re placing (or null if none left)
  const nextShipId = React.useMemo(() => {
    const placed = Object.keys(playerFleet).length;
    return toPlace.length > 0 ? placed + 1 : null;
  }, [playerFleet, toPlace.length]);

  // Warm the next (and the one after) side frames so they’re cached/decode-ready
  React.useEffect(() => {
    if (!nextShipId) return;
    warmSideFrames(nextShipId);
    // pre-warm the one after too (nice-to-have)
    const after = nextShipId + 1;
    if (after <= FLEET_SIZES.length) warmSideFrames(after);
  }, [nextShipId]);

  // Lower FPS and optionally skip every other frame to keep UI snappy
  const SIDE_SPIN_FPS = 30;  // was 50
  const SIDE_SPIN_STEP = 2;  // 1 = use every frame; 2 = every other
  const sideSpinFrames = React.useMemo(() => {
    if (!nextShipId) return [];
    const urls = getSideFrames(nextShipId);
    return SIDE_SPIN_STEP > 1 ? urls.filter((_, i) => i % SIDE_SPIN_STEP === 0) : urls;
  }, [nextShipId]);
  
  // reverse countdown while waiting for peer to rejoin
  const [graceLeftMs, setGraceLeftMs] = React.useState<number | null>(null);
  const graceTimerRef = React.useRef<number | null>(null);
  const fmtMMSS = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  };

  // clear on unmount just in case
  React.useEffect(() => () => {
    if (graceTimerRef.current) clearInterval(graceTimerRef.current);
  }, []);

  // Compass heading (remembers last H and V picks)
  type CompassDir = "N" | "E" | "S" | "W";
  const [compassDir, setCompassDir] = React.useState<CompassDir>("E");
  const lastHDirRef = React.useRef<Extract<CompassDir,"E"|"W">>("E");
  const lastVDirRef = React.useRef<Extract<CompassDir,"N"|"S">>("N");

  const [headingsById, setHeadingsById] = React.useState<Record<number,"N"|"E"|"S"|"W">>({});


  const onCompassChoose = (d: CompassDir) => {
    setCompassDir(d);
    if (d === "N" || d === "S") {
      lastVDirRef.current = d;
      setOrientation("V");
    } else {
      lastHDirRef.current = d;
      setOrientation("H");
    }
  };

  // keep "toPlace" synced to what's already placed (only during placement)
  React.useEffect(() => {
    if (phase !== "place") return;
    const placed = Object.keys(playerFleet).length;
    setToPlace(FLEET_SIZES.slice(placed));
  }, [phase, playerFleet]);

  // keep compass in sync if orientation changes via keyboard (R) or other paths
  React.useEffect(() => {
    if (orientation === "H" && (compassDir !== "E" && compassDir !== "W")) {
      setCompassDir(lastHDirRef.current);
    }
    if (orientation === "V" && (compassDir !== "N" && compassDir !== "S")) {
      setCompassDir(lastVDirRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  // measure enemy board to cap Signal Deck to 50% of its height
  const enemyWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [enemyH, setEnemyH] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = enemyWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      setEnemyH(Math.max(0, Math.floor(box.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Signal Deck state & helpers ---
  const [intelLog, setIntelLog] = React.useState<IntelLine[]>([]);
  const nextIntelIdRef = React.useRef(0);
  const lastFlavorAtRef = React.useRef(0);

  function pushIntel(text: string, voice: IntelLine["voice"] = "CIC", flavor = false) {
    setIntelLog((prev) => {
      const id = ++nextIntelIdRef.current;
      const next = [...prev, { id, t: Date.now(), voice, text, flavor }];
      return next.length > 100 ? next.slice(next.length - 100) : next;
    });
  }

  // mirror every new `msg` into the Signal Deck
  const lastMsgRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!msg || msg === lastMsgRef.current) return;
    lastMsgRef.current = msg;
    pushIntel(msg, "CIC", false);
  }, [msg]);

  // small flavor engine (rare, throttled)
  const FLAVOR_COOLDOWN_MS = 12000;
  function maybeFlavor(lines: string[], voice: IntelLine["voice"] = "Ops", probability = 0.35) {
    const now = Date.now();
    if (now - lastFlavorAtRef.current < FLAVOR_COOLDOWN_MS) return;
    if (Math.random() > probability) return;
    lastFlavorAtRef.current = now;
    const pick = lines[(Math.random() * lines.length) | 0];
    pushIntel(pick, voice, true);
  }

  // remaining ship cells helper (for near-win/loss cues)
  function countRemainingCells(grid: Grid, shots: Shots): number {
    let n = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] > 0 && shots[r][c] !== 2) n++;
    }
    return n;
  }

  const turnRef = React.useRef(turn);
  React.useEffect(() => { turnRef.current = turn; }, [turn]);

  // mirrors (refs used inside socket handlers)
  const phaseRef = React.useRef(phase);
  const roleRef = React.useRef(role);
  const playerGridRef = React.useRef(playerGrid);
  const playerFleetRef = React.useRef(playerFleet);
  const playerShotsRef = React.useRef(playerShots);
  const enemyGridRef = React.useRef(enemyGrid);
  const enemyFleetRef = React.useRef(enemyFleet);
  const enemyShotsRef = React.useRef(enemyShots);
  const msgRef = React.useRef(msg);
  React.useEffect(() => { phaseRef.current = phase; }, [phase]);
  React.useEffect(() => { roleRef.current = role; }, [role]);
  React.useEffect(() => { playerGridRef.current = playerGrid; }, [playerGrid]);
  React.useEffect(() => { playerFleetRef.current = playerFleet; }, [playerFleet]);
  React.useEffect(() => { playerShotsRef.current = playerShots; }, [playerShots]);
  React.useEffect(() => { enemyGridRef.current = enemyGrid; }, [enemyGrid]);
  React.useEffect(() => { enemyFleetRef.current = enemyFleet; }, [enemyFleet]);
  React.useEffect(() => { enemyShotsRef.current = enemyShots; }, [enemyShots]);
  React.useEffect(() => { msgRef.current = msg; }, [msg]);

  // reveal + AI
  const [enemyRevealed, setEnemyRevealed] = React.useState(false);
  const sentRevealRef = React.useRef(false);
  const aiRef = React.useRef(makeAIState());

  // counts opponent ships confirmed sunk via `result` messages — the
  // attacker never learns the opponent's real fleet layout, but
  // FLEET_SIZES.length (total ship count) is always known, so counting
  // "sunk" results is enough to detect a multiplayer win on the attacker's
  // side without needing the opponent's fleet data.
  const enemyShipsSunkRef = React.useRef(0);

  const crisisWarnedRef = React.useRef<{ me: boolean; them: boolean }>({
    me: false,
    them: false,
  });

  // ready flags
  const [iAmReady, setIAmReady] = React.useState(false);
  const [peerReady, setPeerReady] = React.useState(false);
  const peerReadyRef = React.useRef(peerReady);
  React.useEffect(() => { peerReadyRef.current = peerReady; }, [peerReady]);
  const iAmReadyRef = React.useRef(iAmReady);
  React.useEffect(() => { iAmReadyRef.current = iAmReady; }, [iAmReady]);

  // resume window
  const RESUME_WINDOW_MS = 30_000;
  const lastSnapshotRef = React.useRef<any>(null);
  const resumedWithinGraceRef = React.useRef(false);
  const lastHelloAckSentAtRef = React.useRef(0);

  // local resume keys
  // v2: captures full match state (not just placement) so a self-refresh
  // mid-match doesn't drop the player back into ship placement or lose
  // their shot history — see resume restoration below.
  const resumeKey = (code: string, role: Role) => `bs:${code}:${role}:resume-v2` as const;
  type ResumeBlob = {
    exp: number;
    phase: Phase;
    playerGrid: Grid;
    playerFleet: Fleet;
    playerShots: Shots;
    enemyGrid: Grid;
    enemyFleet: Fleet;
    enemyShots: Shots;
    iAmReady: boolean;
    peerReady: boolean;
    turn: "player" | "ai";
    msg: string;
  };

  // resume helpers
  const saveLocalResume = React.useCallback((code: string, role: Role, blob: ResumeBlob) => {
    try { localStorage.setItem(resumeKey(code, role), JSON.stringify(blob)); } catch {}
  }, []);

  function loadLocalResume(code: string, role: Role): ResumeBlob | null {
    try {
      const raw = localStorage.getItem(resumeKey(code, role));
      if (!raw) return null;
      const data = JSON.parse(raw) as ResumeBlob;
      if (!data || Date.now() > data.exp) return null;
      return data;
    } catch { return null; }
  }
  function clearLocalResume(code: string, role: Role) {
    try { localStorage.removeItem(resumeKey(code, role)); } catch {}
  }

  // state snapshot (kept handy; adapter may pull it)
  const buildStateSnapshot = React.useCallback(() => ({
    phase, turn,
    playerGrid, playerFleet, playerShots,
    enemyGrid, enemyFleet, enemyShots,
    iAmReady, peerReady, msg,
  }), [
    phase, turn,
    playerGrid, playerFleet, playerShots,
    enemyGrid, enemyFleet, enemyShots,
    iAmReady, peerReady, msg
  ]);
  const captureStateSnapshot = React.useCallback(() => {
    lastSnapshotRef.current = buildStateSnapshot();
  }, [buildStateSnapshot]);

  // Only `phase` is safe to copy verbatim from a peer's pushed snapshot.
  // Every other field a snapshot could carry (playerGrid/playerFleet/
  // playerShots/enemyGrid/enemyFleet/enemyShots/turn/iAmReady/peerReady) is
  // perspective-relative — what the SENDER calls "my board" is the
  // RECEIVER's "opponent's board", so copying it as-is would silently
  // overwrite the receiver's own fleet/ready-state with the sender's,
  // rather than helping it resume. `phase` ("place"/"play"/"over") means
  // the same thing to both sides, so it's the only field actually pushed
  // (see onPeerHello's `roomRef.current?.state(...)` call).
  const applyStateSnapshot = React.useCallback((s: any) => {
    try {
      if (typeof s?.phase === "string") setPhase(s.phase);
      setEnemyRevealed(false);
    } catch {}
  }, []);

  // persist a quick-resume blob on tab close
  React.useEffect(() => {
    const onBeforeUnload = () => {
      if (!roomCode || !roomRef.current) return;
      try {
        saveLocalResume(roomCode, roleRef.current, {
          exp: Date.now() + RESUME_WINDOW_MS,
          phase: phaseRef.current,
          playerGrid: playerGridRef.current,
          playerFleet: playerFleetRef.current,
          playerShots: playerShotsRef.current,
          enemyGrid: enemyGridRef.current,
          enemyFleet: enemyFleetRef.current,
          enemyShots: enemyShotsRef.current,
          iAmReady: iAmReadyRef.current ?? false,
          peerReady: peerReadyRef.current ?? false,
          turn: turnRef.current,
          msg: msgRef.current,
        });
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [roomCode, saveLocalResume]);

  // seed bot enemy when needed
  React.useEffect(() => {
    if (mode === "bot") {
      const { grid, fleet } = randomFleet();
      setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode]);

  // local reset
  //
  // `modeOverride` lets a caller that is switching modes in the SAME click
  // handler (e.g. "Open Theater": setMode("mp") then resetLocal()) tell
  // resetLocal what mode it's switching TO. Without it, `mode` here would
  // still read the OLD value — setMode() doesn't take effect until the next
  // render — so a click on "Open Theater" or "Join Theater" would run this
  // with a stale mode === "bot" closure and wrongly seed a random AI fleet
  // into enemyGrid/enemyFleet even though we're entering a real MP room.
  // That stray fleet then never gets legitimately overwritten during play
  // (correctly — you shouldn't see the opponent's real layout mid-game),
  // so it's what silently gets shown once the board reveals ships.
  const resetLocal = React.useCallback((modeOverride?: MPMode) => {
    const effectiveMode = modeOverride ?? mode;
    setPeerState(prev => (prev === "quit" ? (peerPresent ? "present" : "left") : prev));
    setPhase("place"); setOrientation("H");
    setIntelLog([]);
    setHeadingsById({});
    setPlayerGrid(makeGrid()); setPlayerFleet({});
    setPlayerShots(makeShots());
    setEnemyGrid(makeGrid()); setEnemyFleet({});
    setEnemyShots(makeShots());
    setToPlace([...FLEET_SIZES]);
    setTurn("player");
    aiRef.current = makeAIState();
    enemyShipsSunkRef.current = 0;
    setMsg("Deploy your fleet (press R to rotate)");
    setIAmReady(false); setPeerReady(false);
    setEnemyRevealed(false);
    sentRevealRef.current = false;
    lastSnapshotRef.current = null;
    crisisWarnedRef.current = { me: false, them: false };

    if (effectiveMode === "bot") {
      const { grid, fleet } = randomFleet(); setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode, peerPresent]);

  // MP wiring
  const ensureRoom = React.useCallback(async (asHost: boolean) => {
    const adapter = await createFirebaseAdapter();
    const code = asHost ? (roomCode || generateCode()) : roomCode;
    if (!code) return;
    setRoomCode(code);

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

        try {
          const mineLeft = countRemainingCells(playerGridRef.current, res.shots);
          if (!crisisWarnedRef.current.me && mineLeft <= 3) {
            crisisWarnedRef.current.me = true;
            maybeFlavor([
              "Mayday, Mayday—bulkheads failing! Damage control to stations!",
              "We’re taking water—brace for further impact!",
            ], "Ops", 1.0);
          }
          if (res.result === "hit" || res.result === "sunk") {
            maybeFlavor([
              "Enemy has our range. Recommend evasive pattern Delta.",
              "Incoming plot corrected—expect follow-up salvos.",
            ], "CIC");
          }
        } catch {}

        roomRef.current?.result(by, (res.result === "hit" || res.result === "sunk") ? res.result : "miss", r, c);

        if (allSunk(res.fleet)) {
          setPhase("over");
          setEnemyRevealed(true);
          setMsg("Enemy fleet prevails—mission failed.");
          roomRef.current?.phase("over");
          // Natural game-over (not a surrender) previously never triggered a
          // reveal, so this side's "Enemy Waters" board stayed on whatever
          // placeholder grid it had (blank, or a leftover bot fleet) instead
          // of the real opponent layout. Reveal our own board now so the
          // winner can see it too.
          if (!sentRevealRef.current) {
            sentRevealRef.current = true;
            try {
              roomRef.current?.reveal(
                roleRef.current, playerGridRef.current as any, playerFleetRef.current as any
              );
            } catch {}
          }
        } else {
          setTurn("player");
          setMsg(res.result === "miss" ? "Their salvo splashed—your move!" : "We’re hit—return fire!");
        }
        captureStateSnapshot();
      },

      onResult: ({ to, result, r, c }) => {
        const myRole = roleRef.current;
        if (to !== myRole) return;

        // The attacker never learns the opponent's real fleet layout, so we
        // can't call allSunk() on it directly — but FLEET_SIZES.length (the
        // total ship count) is always known, so counting "sunk" results is
        // enough to detect a win here. Previously this handler never checked
        // for a win at all: the attacker who lands the final shot just sat
        // at "Passing initiative..." forever, waiting on a turn that would
        // never come, even though the defender's client had already ended
        // the match on its side.
        let justWon = false;
        if (result === "sunk") {
          enemyShipsSunkRef.current += 1;
          if (enemyShipsSunkRef.current >= FLEET_SIZES.length) {
            justWon = true;
          }
        }

        setEnemyShots(prev => {
          const next = prev.map(row => row.slice());
          next[r][c] = result === "miss" ? 1 : 2;

          // Flavor with UPDATED shots (use the ref, not the `enemyGrid`
          // state closure — this handler is created once and never
          // recreated, so the closed-over `enemyGrid` variable would
          // otherwise always be the initial empty grid).
          const enemyLeft = countRemainingCells(enemyGridRef.current, next);
          if (!justWon && !crisisWarnedRef.current.them && enemyLeft <= 3) {
            crisisWarnedRef.current.them = true;
            maybeFlavor([
              "They’re listing—press the advantage!",
              "Enemy frames buckling; recommend continuous fire.",
            ], "Gunnery", 1.0);
          }
          if (result === "sunk" && !justWon) {
            maybeFlavor([
              "Enemy hull breached—she’s going under.",
              "Target struck below the waterline—confirming loss.",
            ], "Gunnery");
          }

          return next;
        });

        if (justWon) {
          setPhase("over");
          setEnemyRevealed(true);
          setMsg("Enemy fleet sunk—victory! 🎖️");
          roomRef.current?.phase("over");
          if (!sentRevealRef.current) {
            sentRevealRef.current = true;
            try {
              roomRef.current?.reveal(
                roleRef.current, playerGridRef.current as any, playerFleetRef.current as any
              );
            } catch {}
          }
        } else {
          setMsg(
            result === "sunk" ? "Ship down! Passing initiative..." :
            result === "hit"  ? "Direct hit! Opponent’s turn..." :
                                "Shot wide—opponent’s turn..."
          );
          setTurn("ai");
        }
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
        const bothReady = (by === me ? ready : iAmReadyRef.current) && (by === me ? peerReadyRef.current : ready);
        if (bothReady && phaseRef.current !== "play" && me === "host") {
          try { roomRef.current?.phase("play"); } catch {}
        }
      },

      // 30s grace on disconnect
      onPeerBye: async () => {
        setPeerPresent(false);
        setPeerState("left");
        setPeerReady(false);
        setMsg("Contact lost—holding station for 30 s...");

        // start reverse countdown
        setGraceLeftMs(RESUME_WINDOW_MS);
        if (graceTimerRef.current) clearInterval(graceTimerRef.current);
        graceTimerRef.current = window.setInterval(() => {
          setGraceLeftMs(prev => {
            if (prev == null) return null;
            const next = prev - 1000;
            return next <= 0 ? 0 : next;
          });
        }, 1000);

        if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
        rejoinTimerRef.current = window.setTimeout(async () => {
          rejoinTimerRef.current = null;

          // stop countdown when grace ends
          if (graceTimerRef.current) { clearInterval(graceTimerRef.current); graceTimerRef.current = null; }
          setGraceLeftMs(null);

          if (peerPresentRef.current) return;
          if (roleRef.current === "host") {
            try { await roomRef.current?.bumpEpoch(); } catch {}
          }
          resetLocal();
          setPeerState("joining");
          setMsg("No contact—awaiting new vessel...");
        }, RESUME_WINDOW_MS);
      },

      onPeerHello: () => {
        const now = Date.now();

        everHadPeerRef.current = true;
        setPeerPresent(true);
        setPeerState(phase === "place" ? "placing" : "present");

        // if we were in grace, it’s a reconnection; otherwise it’s a fresh contact
        const wasInGrace = !!graceTimerRef.current;
        if (wasInGrace) {
          setMsg(phaseRef.current === "play"
            ? "Link re-established—engagement resumes."
            : "Link re-established—standing by."
          );
        } else {
          setMsg(phase === "play" ? "Comms restored—engagement resumes." : "New contact—battle stations.");
        }

        // stop grace countdown immediately on return
        if (graceTimerRef.current) { clearInterval(graceTimerRef.current); graceTimerRef.current = null; }
        setGraceLeftMs(null);

        if (rejoinTimerRef.current) {
          clearTimeout(rejoinTimerRef.current);
          rejoinTimerRef.current = null;
        }

        if (now - lastHelloAckSentAtRef.current > 2000) {
          try { roomRef.current?.hello(roleRef.current); } catch {}
          lastHelloAckSentAtRef.current = now;
        }

        // Nudge a reconnecting/rejoining guest onto the correct phase. A
        // guest whose own local resume expired (or was never saved, e.g. a
        // fresh tab) would otherwise get stuck re-placing ships in a match
        // that's already in "play" (or already "over") — this was
        // previously dead code: Room.state() was defined and onState/
        // applyStateSnapshot could receive it, but nothing ever called
        // roomRef.current?.state(...) to actually send one.
        if (roleRef.current === "host") {
          try { roomRef.current?.state("host", { phase: phaseRef.current }); } catch {}
        }
      },

      onQuit: () => {
        setPeerState("quit");
        setPhase("over");
        setMsg("Enemy struck colors. Revealing charts...");
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
          setMsg("Enemy requests re-engagement. Accept?");
        } else if (action === "accept") {
          setRematchAskFromPeer(null);
          resetLocal();
          setMsg("Rearm complete—deploy your fleet.");
        } else if (action === "decline") {
          setRematchAskFromPeer(null);
          setMsg("Re-engagement declined.");
        }
      },

      onEpoch: (n) => {
        setEpoch(typeof n === "number" ? n : 0);
        everHadPeerRef.current = false;
        resetLocal();
        setMsg("New operation initiated.");
      },

      onReveal: ({ by, grid, fleet }) => {
        const mine = roleRef.current;
        if (by === mine) return;
        setEnemyGrid(grid as unknown as Grid);
        setEnemyFleet(fleet as unknown as Fleet);
        setEnemyRevealed(true);
      },

      onState: ({ by, state }) => {
        const me = roleRef.current;
        if (by === me) return;
        applyStateSnapshot(state);
        setMsg("State synced—resume engagement.");
      },
    });

    roomRef.current = r;
    setRole(asHost ? "host" : "guest");

    if (asHost) {
      const e = (await (r.create() as unknown)) as number | void;
      setPeerPresent(false);
      setPeerState("joining");
      if (typeof e === "number") setEpoch(e);

      const blobH = loadLocalResume(code, "host");
      if (blobH) {
        setPhase(blobH.phase);
        setPlayerGrid(blobH.playerGrid);
        setPlayerFleet(blobH.playerFleet);
        setPlayerShots(blobH.playerShots);
        setEnemyGrid(blobH.enemyGrid);
        setEnemyFleet(blobH.enemyFleet);
        setEnemyShots(blobH.enemyShots);
        setToPlace(FLEET_SIZES.slice(Object.keys(blobH?.playerFleet ?? {}).length));
        setIAmReady(!!blobH.iAmReady);
        setPeerReady(!!blobH.peerReady);
        setTurn(blobH.turn);
        try { if (blobH.iAmReady) roomRef.current?.ready("host", true); } catch {}
        clearLocalResume(code, "host");
        resumedWithinGraceRef.current = true;
        setMsg(blobH.msg || "Your fleet restored—awaiting enemy.");
      }

    } else {
      const e = (await (r.join() as unknown)) as number | void;
      if (typeof e === "number") setEpoch(e);

      const blob = loadLocalResume(code, "guest");
      if (blob) {
        setPhase(blob.phase);
        setPlayerGrid(blob.playerGrid);
        setPlayerFleet(blob.playerFleet);
        setPlayerShots(blob.playerShots);
        setEnemyGrid(blob.enemyGrid);
        setEnemyFleet(blob.enemyFleet);
        setEnemyShots(blob.enemyShots);
        setToPlace(FLEET_SIZES.slice(Object.keys(blob?.playerFleet ?? {}).length));
        setIAmReady(!!blob.iAmReady);
        setPeerReady(!!blob.peerReady);
        setTurn(blob.turn);
        try { if (blob.iAmReady) roomRef.current?.ready("guest", true); } catch {}
        clearLocalResume(code, "guest");
        resumedWithinGraceRef.current = true;
        setMsg(blob.msg || "Your fleet restored—checking contact...");
      }
    }
    try { roomRef.current?.hello(roleRef.current); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // host nudges play if both ready but ordering was odd (rejoin etc.)
  React.useEffect(() => {
    if (iAmReady && peerReady && phase !== "play" && roleRef.current === "host" && roomRef.current) {
      try { roomRef.current.phase("play"); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iAmReady, peerReady, phase]);

  // nudge the peer shortly after connect if still absent
  React.useEffect(() => {
    if (!peerPresent && roomRef.current) {
      const id = window.setTimeout(() => {
        if (!peerPresent && roomRef.current) {
          try { roomRef.current.hello(roleRef.current); } catch {}
        }
      }, 1000);
      return () => clearTimeout(id);
    }
  }, [peerPresent]);

  // direct invite: auto-join
  React.useEffect(() => {
    if (!fromInvite) return;
    if (roomRef.current) return;
    setEntry("mp");
    setMode("mp");
    setRole("guest");
    setRoomCode(codeFromHash);
    ensureRoom(false);
    setMsg("Establishing comms...");
  }, [fromInvite, codeFromHash, ensureRoom]);

  /* ---- Handlers ---- */

  const onPlaceClick = (r: number, c: number) => {
    if (phase !== "place" || toPlace.length === 0) return;
    const length = toPlace[0];
    const width  = (length === 5) ? 2 : 1;
    if (!canPlace(playerGrid, r, c, length, orientation, width)) {
      setMsg("Negative—collision course.");
      return;
    }
    const nextId = Object.keys(playerFleet).length + 1;
    const res = placeShip(playerGrid, playerFleet, nextId, r, c, length, orientation, width);
    const headingNow = compassDir; // "N" | "E" | "S" | "W" from your compass
    setHeadingsById(prev => ({ ...prev, [nextId]: headingNow }));
    setPlayerGrid(res.grid);
    setPlayerFleet(res.fleet);

    const remaining = toPlace.slice(1);
    setToPlace(remaining);
    setMsg(remaining.length ? `Laid down ${length}-deck ship. Next: ${remaining[0]} (press R to rotate)` : "Fleet deployed—stand by.");

    captureStateSnapshot();

    if (remaining.length === 0) {
      if (mode === "bot") {
        setPhase("play"); setTurn("player"); setMsg("Fire for effect →");
      } else {
        setIAmReady(true);
        try { roomRef.current?.ready(roleRef.current, true); } catch {}
        setMsg("Standing by—awaiting enemy deployment...");
      }
      captureStateSnapshot();
    }
  };

  const aiTurn = () => {
    const ai = aiRef.current;
    const [rr, cc] = aiPick(playerShots, ai);
    const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
    setPlayerShots(res.shots); setPlayerFleet(res.fleet);
    if (res.result === "hit" || res.result === "sunk") aiOnHit(rr, cc, res.shots, ai);
    if (allSunk(res.fleet)) {
      setPhase("over");
      setEnemyRevealed(true);
      setMsg("Training Bot prevails—our fleet is sunk.");
      return;
    }
    setTurn("player"); setMsg(res.result === "miss" ? "Training salvo wide—your guns!" : "We’re hit—return fire!");
  };

  const onEnemyClick = (r: number, c: number) => {
    if (phase !== "play") return;

    if (mode === "bot") {
      if (turn !== "player" || enemyShots[r][c] !== 0) return;
      try {
        const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
        setEnemyShots(res.shots); setEnemyFleet(res.fleet);
        if (allSunk(res.fleet)) {
          setPhase("over"); setMsg("Enemy fleet sunk—victory! 🎖️");
          setEnemyRevealed(true);
          return;
        }
        setTurn("ai"); setMsg(res.result === "miss" ? "You missed. Bot's turn…" : "Hit! Bot's turn…");
        setTimeout(() => aiTurn(), 400);
      } catch {}
      return;
    }

    // MP
    if (turn !== "player" || enemyShots[r][c] !== 0 || !peerPresent) return;
    roomRef.current?.shot(roleRef.current, r, c);
    setMsg("Rounds away—awaiting splash...");
  };

  // ready gate (both players done placing)
  React.useEffect(() => {
    if (mode !== "mp") return;
    if (phase !== "place") return;
    if (!iAmReady || !peerReady) return;

    setPhase("play");

    if (!resumedWithinGraceRef.current) {
      const amHost = roleRef.current === "host";
      setTurn(amHost ? "player" : "ai");
      setMsg(amHost ? "You have initiative—open fire." : "Enemy has initiative—hold...");
    } else {
      setMsg(turnRef.current === "player" ? "Initiative retained—resume fire." : "Enemy’s move—hold fire...");
    }

    try { roomRef.current?.phase("play"); } catch {}
    captureStateSnapshot();
    resumedWithinGraceRef.current = false;
  }, [mode, phase, iAmReady, peerReady, captureStateSnapshot]);

  const inviteHash = roomCode ? buildInviteHash(roomCode) : "";

  // emblem picks (stable per room + epoch)
  const [HostEmblemIcon, GuestEmblemIcon] = React.useMemo(() => {
    if (!roomCode) return [EMBLEMS[0], EMBLEMS[1]] as const;
    const seed = hashSeed(`${roomCode}|${epoch}`);
    const hostIdx = seed % EMBLEMS.length;
    let guestIdx = ((seed * 1103515245 + 12345) >>> 0) % EMBLEMS.length;
    if (guestIdx === hostIdx) guestIdx = (guestIdx + 1) % EMBLEMS.length;
    return [EMBLEMS[hostIdx], EMBLEMS[guestIdx]] as const;
  }, [roomCode, epoch]);

  const MyEmblemIcon = role === "host" ? HostEmblemIcon : GuestEmblemIcon;

  // opponent status line
  const opponentStatus = React.useMemo(() => {
    const isHost = role === "host";
    if (!peerPresent) {
      if (isHost) {
        if (peerState === "left") {
          const tail = graceLeftMs != null ? ` ${fmtMMSS(graceLeftMs)}` : "";
          return `Guest (signal lost. waiting for...${tail ? " " + tail : ""})`;
        }
        return "Guest (raising radio contact...)";
      }
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
  }, [role, peerPresent, peerReady, peerState, phase, graceLeftMs]);

  /* ----------------- Landing ----------------- */

  if (entry === "landing") {
    return (
      <div className="w-full mt-16 flex justify-center">
        <div
          className="
            relative overflow-hidden
            w-full max-w-sm mx-auto p-6 rounded-2xl
            min-h-[220px] md:min-h-[260px]
            bg-white/[0.08] dark:bg-white/[0.045]
            backdrop-blur-xl backdrop-saturate-150
            border border-white/15 dark:border-white/[0.06]
            ring-1 ring-white/[0.06] dark:ring-black/[0.25]
            shadow-lg
            transition-all
          "
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-white/10 to-transparent dark:from-gray-800/60 dark:via-gray-900/40 dark:to-transparent" />

          <div className="relative z-10 flex flex-col items-center gap-1">
            {/* Local */}
            <div className="pl-0 md:pl-0">
              <div className="text-sm text-center mb-2 font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                Local Waters
              </div>
              <div className="mt-2 h-px w-40 sm:w-20 md:w-44 bg-gray-300 dark:bg-white/10 backdrop-blur-lg rounded-full mx-auto" />
            </div>

            <div className="mt-4 flex justify-center">
              <button
                className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 text-white"
                onClick={() => { setEntry("bot"); setMode("bot"); resetLocal("bot"); }}
              >
                <span className="inline-flex items-center gap-2">
                  <IconCpu className="w-4 h-4 opacity-90" aria-hidden="true" />
                  Drill with Bot
                </span>
              </button>
            </div>

            {/* Online */}
            <div className="mt-8 pl-0 md:pl-0">
              <div className="text-sm text-center mb-2 font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                Open Seas
              </div>
              <span className="text-xs italic font-normal text-gray-600 dark:text-gray-400">
                (Online rooms temporarily unavailable)
              </span>
              <div className="mt-2 h-px w-40 sm:w-20 md:w-44 bg-gray-300 dark:bg-white/10 backdrop-blur-sm rounded-full mx-auto" />
            </div>

            {!landingJoinOpen ? (
              <div className="mt-4 flex items-center justify-center gap-8">
                <button
                  className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white"
                  onClick={() => { setEntry("mp"); setMode("mp"); resetLocal("mp"); ensureRoom(true); }}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconSignal className="w-4 h-4 opacity-90" aria-hidden="true" />
                    Open Theater
                  </span>
                </button>

                <button
                  className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white"
                  onClick={() => { setLandingJoinOpen(true); setJoinCode(""); }}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
                    Join Theater
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="w-full flex items-center justify-center gap-3">
                  <input
                    autoFocus
                    inputMode="text"
                    pattern="[A-Za-z0-9]{4}"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
                      )
                    }
                    placeholder="Op Code (e.g., AX9G)"
                    className="w-44 px-3 py-2 rounded-md bg-white/90 dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 ring-1 ring-black/10 dark:ring-white/10 outline-none text-center tracking-widest"
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
                      resetLocal("mp");
                      ensureRoom(false);
                      setMsg("Directing comms...");
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
                      Join
                    </span>
                  </button>
                </div>
                <button
                  className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                  onClick={() => setLandingJoinOpen(false)}
                >
                  Stand down
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ----------------- MP header (narrow container) ----------------- */

  const MPHeader = () => (
    // <div className="p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 space-y-3 shadow-lg">
    <div className="relative overflow-hidden p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          {opponentStatus ? (
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
              {(everHadPeerRef.current && (peerPresent || rejoinTimerRef.current != null)) && (
                <TeamEmblem
                  role={role === "host" ? "guest" : "host"}
                  Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon}
                  size={25}
                />
              )}
              <span className={`inline-block ${peerPresent ? "bg-emerald-500" : "bg-rose-500"} w-3 h-3 rounded-full`} aria-hidden />
              <span>{opponentStatus}</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            onClick={async () => {
              try { roomRef.current?.leave(); } catch {}
              setEntry("landing"); setMode("bot"); resetLocal();
              gotoHarbor();
            }}
            title="Back"
          >
            ← Harbor
          </button>
          {roomRef.current && phase !== "over" && (
            <button
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 dark:hover:bg-rose-500"
              title="Quit Game"
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
                setMsg("You strike colors—revealing charts...");
              }}
            >
              Strike Colors
            </button>
          )}
          {roomRef.current && (
            <button
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600"
              onClick={async () => {
                try {
                  if (roomCode) {
                    saveLocalResume(roomCode, roleRef.current, {
                      exp: Date.now() + RESUME_WINDOW_MS,
                      playerGrid: playerGridRef.current,
                      playerFleet: playerFleetRef.current,
                      iAmReady: iAmReadyRef.current ?? false,
                      turn: turnRef.current,
                    });
                  }
                } catch {}
                try { await roomRef.current?.leave(); } catch {}
                resetLocal(); setMode("bot"); setEntry("landing");
                gotoHarbor();
              }}
              title="Leave room"
            >
              Leave Theater
            </button>
          )}
        </div>
      </div>

      {!roomRef.current ? (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {role === "host" ? "Creating room…" : "Joining room…"}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-200">
            Op Code: <b>{roomCode}</b>
          </span>
          <button
            className="px-3 py-1 rounded-lg text-sm bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600"
            onClick={() => {
              const { origin, pathname } = window.location;
              const isDark = document.documentElement.classList.contains("dark");
              const theme = isDark ? "dark" : "light";
              navigator.clipboard.writeText(`${origin}${pathname}?theme=${theme}${inviteHash}`);
            }}
          >
            Copy Signal Link
          </button>
        </div>
      )}

      {/* 360° side preview — only while there are ships left to place */}
      {phase === "place" && toPlace.length > 0 && sideSpinFrames.length > 0 && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
          style={{ zIndex: 0, transform: "translateZ(0)", backfaceVisibility: "hidden", contain: "layout paint size" }}
        >
          <div className="relative" style={{ width: 700, height: 420, left: "-6%", top: "-12%", opacity: 0.9 }}>
            <SideSpin frames={sideSpinFrames} fps={SIDE_SPIN_FPS} />
          </div>
        </div>
      )}
    </div>
  );

  /* ----------------- Title adornments via portal ----------------- */

  const hasDOM = typeof document !== "undefined";
  const inRoom = entry !== "landing" && !!roomRef.current;

  return (
    <div className="w-full">
      {/* title-left emblem (in-room only) */}
      {hasDOM && inRoom && (() => {
        const slot = document.getElementById("title-left-slot");
        return slot
          ? ReactDOM.createPortal(
              <span className="inline-flex items-center">
                <TeamEmblem
                  role={role}
                  Icon={MyEmblemIcon}
                  size={30}
                  title="Your fleet emblem"
                />
              </span>,
              slot
            )
          : null;
      })()}

      {/* title-right role label (in-room only) */}
      {hasDOM && inRoom && (() => {
        const slot = document.getElementById("title-right-slot");
        return slot
          ? ReactDOM.createPortal(
              <span className="text-xs sm:text-sm font-normal text-gray-600 dark:text-gray-300">
                ({role})
              </span>,
              slot
            )
          : null;
      })()}

      {/* ===== Header region (match battlefield shell) ===== */}
      <div
        className="w-full mx-auto px-4 md:px-6 overflow-x-clip"
        style={{ maxWidth: SHELL_MAXW }}
      >
        {mode === "mp" && <MPHeader />}

        {phase === "place" && (
          <div className="mt-6 flex items-center justify-between rounded-xl p-3 ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Vessels to deploy: <span className="tracking-wide">{toPlace.join(", ")}</span>
            </div>
            <div className="flex items-center gap-3" />
          </div>
        )}
      </div>

      {/* ===== Battlefield region (match header width) ===== */}
      <div className="w-full mt-6">
        {/* same width as header + small side padding */}
        <div
          className="relative mx-auto px-4 md:px-6 overflow-x-clip"
          style={{ maxWidth: SHELL_MAXW }}
        >
          {/* watermark now constrained to the same width */}
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
            <WatermarkEmblem
              role={role}
              Icon={MyEmblemIcon}
              size={`min(1060px, calc(100% - ${WATERMARK_SAFE_INSET * 2}px))`}
              opacity={0.1}
            />
          </div>

          {/* foreground battlefield */}
          <div className="relative z-10">
            {mode === "bot" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 2xl:gap-x-10">
                <BoardGrid
                  title={
                    <span className="inline-flex items-center gap-2">
                      <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={20} />
                      Your Fleet
                    </span>
                  }
                  grid={playerGrid}
                  shots={playerShots}
                  revealShips
                  // greenEllipseOnly
                  onCellClick={phase === "place" ? onPlaceClick : undefined}
                  disabled={phase !== "place"}
                />
                <BoardGrid
                  title={
                    <span className="inline-flex items-center gap-2">
                      <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={20} />
                      Enemy Waters
                    </span>
                  }
                  grid={enemyGrid}
                  shots={enemyShots}
                  revealShips={phase === "over" || enemyRevealed}
                  shipTopSprites={TOP_SPRITES}  
                  onCellClick={onEnemyClick}
                  disabled={phase !== "play" || turn !== "player"}
                  aimAssist
                  aimColorClass="text-green-200 dark:text-green-300"
                />
              </div>
            ) : (
              <>
                {/* Desktop and up: 3-column battlefield */}
                <div className="hidden md:block">
                  <div className="w-full">
                    <div 
                      className="grid gap-y-6 gap-x-10 xl:gap-x-12 2xl:gap-x-16"
                      style={{ gridTemplateColumns: `${SIDE_RAIL_PX}px minmax(0,1fr) ${SIDE_RAIL_PX}px`, columnGap: 80 }}
                    >
                      {/* LEFT RAIL — Compass (top) then Wardroom */}
                      <div className="mt-4" style={{ width: SIDE_RAIL_PX }}>
                        <div className="flex flex-col space-y-5">
                          <NavalCompass
                            dir={compassDir}
                            canInteract={phase === "place"}
                            onChoose={onCompassChoose}
                            Emblem={MyEmblemIcon}
                          />
                          {(phase === "play" || phase === "over") && (
                            <div className="w-full">
                              <div className="mx-auto w-full" style={{ maxWidth: RIGHT_FLEET_MAXW }}>
                                <BoardGrid
                                  title={
                                    <span className="inline-flex items-center gap-2">
                                      <TeamEmblem
                                        role={role}
                                        Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon}
                                        size={20}
                                      />
                                      Your Fleet
                                    </span>
                                  }
                                  grid={playerGrid}
                                  shots={playerShots}
                                  revealShips
                                  // greenEllipseOnly
                                  disabled
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CENTER (flexible; gets all extra width) */}
                      <div className="min-w-0" ref={enemyWrapRef}>
                        <div className="w-full">
                          {phase === "place" ? (
                            <div className="grid grid-cols-1 gap-6">
                              <div className="w-full">
                                <BoardGrid
                                  title="Deploy Your Fleet"
                                  grid={playerGrid}
                                  shots={playerShots}
                                  revealShips
                                  // greenEllipseOnly
                                  onCellClick={onPlaceClick}
                                  disabled={toPlace.length === 0}
                                  shipTopSprites={TOP_SPRITES}
                                  headingsById={headingsById}
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
                          ) : (
                            <BoardGrid
                              title={
                                <span className="inline-flex items-center gap-2">
                                  <TeamEmblem
                                    role={role === "host" ? "guest" : "host"}
                                    Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon}
                                    size={20}
                                  />
                                  Enemy Waters
                                </span>
                              }
                              grid={enemyGrid}
                              shots={enemyShots}
                              revealShips={phase === "over" || enemyRevealed}
                              shipTopSprites={TOP_SPRITES}  
                              onCellClick={phase === "play" ? onEnemyClick : undefined}
                              disabled={!peerPresent || phase !== "play" || turn !== "player"}
                              aimAssist
                              aimColorClass="text-green-200 dark:text-green-300"
                            />
                          )}
                        </div>
                      </div>

                      {/* RIGHT RAIL — Signal Deck (top) then Your Fleet */}
                      <div style={{ width: SIDE_RAIL_PX }}>
                        {phase === "play" || phase === "over" ? (
                          <div className="space-y-6">
                            {/* Signal Deck */}
                            {roomRef.current && (
                              <SignalDeck
                                role={role}
                                Icon={MyEmblemIcon}
                                roleLabel={role}
                                log={intelLog}
                                maxHeight={Math.round(enemyH * 0.5)} // cap to 50% of enemy board height
                              />
                            )}

                            {/* Shrunk board, centered within the rail */}
                            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 shadow-lg p-3 text-sm text-gray-800 dark:text-gray-100 backdrop-blur">
                              <div className="font-semibold mb-1">Wardroom</div>
                              <div className="text-xs text-gray-400">Chat docks here…</div>
                            </div>
                          </div>
                        ) : (
                          // Pre-match: Signal Deck + Wardroom (Wardroom always visible)
                          <div className="space-y-6">
                            {roomRef.current && (
                              <SignalDeck
                                role={role}
                                Icon={MyEmblemIcon}
                                roleLabel={role}
                                log={intelLog}
                                maxHeight={Math.round(enemyH * 0.5)} // cap to 50% of enemy board height
                              />
                            )}
                            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 shadow-lg p-3 text-sm text-gray-200 backdrop-blur">
                              <div className="font-semibold mb-1">Wardroom</div>
                              <div className="text-xs text-gray-400">Chat docks here…</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile / <md: stacked boards */}
                <div className="md:hidden">
                  {phase === "place" ? (
                    <div className="mx-auto" style={{ width: PLACE_GRID_WIDTH }}>
                      <BoardGrid
                        title="Deploy Your Fleet"
                        grid={playerGrid}
                        shots={playerShots}
                        revealShips
                        // greenEllipseOnly
                        shipTopSprites={TOP_SPRITES}
                        headingsById={headingsById}
                        onCellClick={onPlaceClick}
                        disabled={toPlace.length === 0}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      <BoardGrid
                        title="Your Fleet"
                        grid={playerGrid}
                        shots={playerShots}
                        revealShips
                        // greenEllipseOnly
                        shipTopSprites={TOP_SPRITES}
                        headingsById={headingsById}
                        disabled
                      />
                      <BoardGrid
                        title="Enemy Waters"
                        grid={enemyGrid}
                        shots={enemyShots}
                        revealShips={phase === "over" && enemyRevealed}
                        topHeadingDeg={0}
                        onCellClick={phase === "play" ? onEnemyClick : undefined}
                        disabled={!peerPresent || phase !== "play" || turn !== "player"}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Bottom bar */}
            <div className="mt-6 flex items-center justify-between">
              {mode === "bot" ? (
                <button
                  onClick={() => resetLocal("bot")}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                >
                  Refit
                </button>
              ) : roomRef.current ? (
                phase === "over" ? (
                  <button
                    onClick={() => {
                      try { roomRef.current?.rematchSignal("propose", roleRef.current); } catch {}
                      setMsg("Requesting re-engagement...");
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                  >
                    Rearm & Reengage
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
                    try { roomRef.current?.rematchSignal("accept", roleRef.current); } catch {}
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
                    try { roomRef.current?.rematchSignal("decline", roleRef.current); } catch {}
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
      </div>
    </div>
  );
}