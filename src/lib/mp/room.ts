// src/lib/mp/room.ts
import type { MPAdapter, MPEvent, Role, Snapshot } from "./index";

export type RoomHandlers = {
  onShot?: (payload: { by: Role; r: number; c: number }) => void;
  onResult?: (payload: { to: Role; result: "miss" | "hit" | "sunk"; r: number; c: number }) => void;
  onPhase?: (phase: "place" | "play" | "over") => void;
  onRematch?: () => void; // legacy support (no payload)
  onPeerHello?: (by: Role) => void;
  onReady?: (payload: { by: Role; ready: boolean }) => void;

  // already present in your latest:
  onPeerBye?: (by: Role) => void;
  onEpoch?: (n: number) => void;

  // NEW:
  onQuit?: (by: Role) => void;
  onRematchSignal?: (payload: { action: "propose" | "accept" | "decline"; by: Role }) => void;

  onReveal?: (payload: { by: Role; grid: number[][]; fleet: Record<string, any> }) => void;
};

export class Room {
  private unsub: null | (() => void) = null;

  constructor(
    private adapter: MPAdapter,
    private roomId: string,
    private role: Role,
    private handlers: RoomHandlers = {}
  ) {}

  async create() {
    await this.adapter.create(this.roomId);
    await this.adapter.append(this.roomId, { t: "hello", by: this.role, ts: Date.now() });
    this.watch();
  }

  async join() {
    await this.adapter.join(this.roomId);
    await this.adapter.append(this.roomId, { t: "hello", by: this.role, ts: Date.now() });
    this.watch();
  }

  leave() {
    if (this.unsub) this.unsub();
    this.unsub = null;
    return this.adapter.leave(this.roomId);
  }

  private watch() {
    if (this.unsub) this.unsub();
    this.unsub = this.adapter.onSnapshot(this.roomId, (snap: Snapshot) => {
      for (const ev of snap.events) this.dispatch(ev);
    });
  }

  private dispatch(ev: MPEvent) {
    switch (ev.t) {
      case "shot":
        this.handlers.onShot?.({ by: ev.by, r: ev.r, c: ev.c });
        break;
      case "result":
        this.handlers.onResult?.({ to: ev.to, result: ev.result, r: ev.r, c: ev.c });
        break;
      case "phase":
        this.handlers.onPhase?.(ev.phase);
        break;
      case "rematch":
        if ("action" in ev) this.handlers.onRematchSignal?.({ action: ev.action, by: ev.by });
        else this.handlers.onRematch?.(); // legacy
        break;
      case "quit":
        this.handlers.onQuit?.(ev.by);
        break;
      case "epoch":
        this.handlers.onEpoch?.(ev.n);
        break;
      case "hello":
        this.handlers.onPeerHello?.(ev.by);
        break;
      case "ready":
        this.handlers.onReady?.({ by: ev.by, ready: ev.ready });
        break;
      // (optional) if your adapter ever emits this
      case "bye":
        this.handlers.onPeerBye?.(ev.by);
        break;
      case "reveal":
        this.handlers.onReveal?.({ by: ev.by, grid: ev.grid, fleet: ev.fleet });
        break;
    }
  }

  // ----- actions -----
  shot(by: Role, r: number, c: number) {
    return this.adapter.append(this.roomId, { t: "shot", by, r, c, ts: Date.now() });
  }
  result(to: Role, result: "miss" | "hit" | "sunk", r: number, c: number) {
    return this.adapter.append(this.roomId, { t: "result", to, result, r, c, ts: Date.now() });
  }
  phase(phase: "place" | "play" | "over") {
    return this.adapter.append(this.roomId, { t: "phase", phase, ts: Date.now() });
  }

  // NEW: structured rematch handshake (propose/accept/decline)
  rematch(action?: "propose" | "accept" | "decline", by?: Role) {
    const ts = Date.now();
    if (action && by) {
      return this.adapter.append(this.roomId, { t: "rematch", action, by, ts });
    }
    // legacy fallback (no payload)
    return this.adapter.append(this.roomId, { t: "rematch", ts });
  }

  reveal(by: Role, grid: number[][], fleet: Record<string, any>) {
    return this.adapter.append(this.roomId, { t: "reveal", by, grid, fleet, ts: Date.now() });
  }

  // NEW: explicit quit event
  quit(by: Role) {
    return this.adapter.append(this.roomId, { t: "quit", by, ts: Date.now() });
  }

  // already added earlier in your code:
  ready(by: Role, ready: boolean) {
    return this.adapter.append(this.roomId, { t: "ready", by, ready, ts: Date.now() });
  }

  // already added earlier:
  bumpEpoch() {
    return this.adapter.append(this.roomId, { t: "epoch", n: Date.now(), ts: Date.now() });
  }
}
