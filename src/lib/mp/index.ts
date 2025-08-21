// src/lib/mp/index.ts
export type Role = "host" | "guest";
export type MPMode = "bot" | "mp";

/** Optional shape – keep generic to avoid UI/logic coupling */
export type StatePayload = unknown;

export type MPEvent =
  | { t: "hello"; by: Role; at: number }
  | { t: "bye"; by: Role; at: number }
  | { t: "shot"; by: Role; r: number; c: number; at: number }
  | { t: "result"; to: Role; result: "miss" | "hit" | "sunk"; r: number; c: number; at: number }
  | { t: "phase"; phase: "place" | "play" | "over"; at: number }
  /** Legacy rematch (kept for back-compat) */
  | { t: "rematch"; at: number }
  /** Structured rematch */
  | { t: "rematch2"; action: "propose" | "accept" | "decline"; by: Role; at: number }
  | { t: "ready"; by: Role; ready: boolean; at: number }
  | { t: "quit"; by: Role; at: number }
  | { t: "reveal"; by: Role; grid: number[][]; fleet: Record<string, unknown>; at: number }
  | { t: "epoch"; n: number; at: number }
  /** NEW: host-to-guest resume snapshot */
  | { t: "state"; by: Role; state: StatePayload; at: number };

export type RoomHandlers = {
  onShot?: (args: { by: Role; r: number; c: number }) => void;
  onResult?: (args: { to: Role; result: "miss" | "hit" | "sunk"; r: number; c: number }) => void;
  onPhase?: (phase: "place" | "play" | "over") => void;
  onRematch?: () => void; // legacy
  onRematchSignal?: (args: { action: "propose" | "accept" | "decline"; by: Role }) => void;
  onQuit?: (by: Role) => void;
  onEpoch?: (n: number) => void;
  onPeerHello?: (by: Role) => void;
  onPeerBye?: (by: Role) => void;
  onReady?: (args: { by: Role; ready: boolean }) => void;
  onReveal?: (args: { by: Role; grid: number[][]; fleet: Record<string, unknown> }) => void;
  /** NEW */
  onState?: (args: { by: Role; state: StatePayload }) => void;
};

export interface MPAdapter {
  /** Start listening/sending for a given epoch; returns current epoch number */
  connect(code: string, role: Role, onEvent: (e: MPEvent) => void): Promise<number>;
  send(ev: MPEvent): Promise<void>;
  /** Increments epoch and emits an {t:'epoch'} in the new stream */
  bumpEpoch(): Promise<number>;
  leave(): Promise<void>;
}

/** 4-char room code (A-Z0-9) */
export function generateCode(len = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

/** Hash router uses '#/fun-zone/battleship-ABCD' */
export function buildInviteHash(code: string): string {
  return `#/fun-zone/battleship-${code.toUpperCase()}`;
}

/** Parse code from current hash if present (Battleship route only) */
export function parseRoomCodeFromHash(): string | null {
  try {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    const m = raw.match(/fun-zone\/battleship-([A-Za-z0-9]{4})/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Lazy-load the Firebase adapter */
export async function createFirebaseAdapter(): Promise<MPAdapter> {
  const mod: any = await import("./adapters/firebase");
  if (typeof mod.createFirebaseAdapter === "function") return mod.createFirebaseAdapter();
  if (typeof mod.default === "function") return mod.default();
  throw new Error("Firebase adapter must export createFirebaseAdapter() or default()");
}
