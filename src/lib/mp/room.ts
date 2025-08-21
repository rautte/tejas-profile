// src/lib/mp/room.ts
import type { MPAdapter, MPEvent, Role, RoomHandlers } from "./index";

export class Room {
  private adapter: MPAdapter;
  private code: string;
  private role: Role;
  private handlers: RoomHandlers;

  constructor(adapter: MPAdapter, code: string, role: Role, handlers: RoomHandlers) {
    this.adapter = adapter;
    this.code = code;
    this.role = role;
    this.handlers = handlers;
  }

  async create() {
    await this.connect();
    // Host announces presence
    await this.adapter.send({ t: "hello", by: this.role, at: Date.now() });
  }

  async join() {
    await this.connect();
    // Guest announces presence
    await this.adapter.send({ t: "hello", by: this.role, at: Date.now() });
  }

  async leave() {
    try {
      await this.adapter.send({ t: "bye", by: this.role, at: Date.now() });
    } finally {
      await this.adapter.leave();
    }
  }

  private async connect() {
    await this.adapter.connect(this.code, this.role, (e) => this.onEvent(e));
  }

  // ---- Outbound (UI → adapter) ----
  shot(by: Role, r: number, c: number) {
    return this.adapter.send({ t: "shot", by, r, c, at: Date.now() });
  }
  result(to: Role, result: "miss" | "hit" | "sunk", r: number, c: number) {
    return this.adapter.send({ t: "result", to, result, r, c, at: Date.now() });
  }
  phase(p: "place" | "play" | "over") {
    return this.adapter.send({ t: "phase", phase: p, at: Date.now() });
  }
  /** Legacy ping */
  rematch() {
    return this.adapter.send({ t: "rematch", at: Date.now() });
  }
  rematchSignal(action: "propose" | "accept" | "decline", by: Role) {
    return this.adapter.send({ t: "rematch2", action, by, at: Date.now() });
  }
  ready(by: Role, ready: boolean) {
    return this.adapter.send({ t: "ready", by, ready, at: Date.now() });
  }
  hello(by: Role = this.role) {
    // [NOTE] explicit presence ping so peers can ACK on rejoin
    return this.adapter.send({ t: "hello", by, at: Date.now() });
  }
  quit(by: Role) {
    return this.adapter.send({ t: "quit", by, at: Date.now() });
  }
  reveal(by: Role, grid: number[][], fleet: Record<string, unknown>) {
    return this.adapter.send({ t: "reveal", by, grid, fleet, at: Date.now() });
  }
  /** NEW: host sends a snapshot to a rejoining guest */
  state(by: Role, state: unknown) {
    return this.adapter.send({ t: "state", by, state, at: Date.now() });
  }
  bumpEpoch() {
    return this.adapter.bumpEpoch();
  }

  // ---- Inbound (adapter → UI) ----
  private onEvent(e: MPEvent) {
    switch (e.t) {
      case "hello":
        if (e.by !== this.role) this.handlers.onPeerHello?.(e.by);
        break;
      case "bye":
        if (e.by !== this.role) this.handlers.onPeerBye?.(e.by);
        break;
      case "shot":
        this.handlers.onShot?.({ by: e.by, r: e.r, c: e.c });
        break;
      case "result":
        this.handlers.onResult?.({ to: e.to, result: e.result, r: e.r, c: e.c });
        break;
      case "phase":
        this.handlers.onPhase?.(e.phase);
        break;
      case "rematch":
        this.handlers.onRematch?.();
        break;
      case "rematch2":
        this.handlers.onRematchSignal?.({ action: e.action, by: e.by });
        break;
      case "ready":
        this.handlers.onReady?.({ by: e.by, ready: e.ready });
        break;
      case "quit":
        this.handlers.onQuit?.(e.by);
        break;
      case "reveal":
        this.handlers.onReveal?.({ by: e.by, grid: e.grid, fleet: e.fleet });
        break;
      case "epoch":
        this.handlers.onEpoch?.(e.n);
        break;
      case "state":
        this.handlers.onState?.({ by: e.by, state: e.state });
        break;
      default:
        // ignore unknown for forward-compat
        break;
    }
  }
}
