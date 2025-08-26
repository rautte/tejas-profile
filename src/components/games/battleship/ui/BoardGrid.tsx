// src/components/games/battleship/ui/BoardGrid.tsx
import React from "react";
import { SIZE } from "lib/battleship";
import type { Grid, Shots } from "lib/battleship";
import ShipTopView from "../dev/ShipTopView";
import { TOP_SPRITES } from "../../../../assets/ships/sprites/top";
import { computeSunkOverlays } from "../utils/overlays";

/** Marks */
const HitMark = () => (
  <svg
    viewBox="0 0 100 100"
    className="relative z-[30] w-2/3 h-2/3 text-rose-500 dark:text-rose-300"
  >
    <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
  </svg>
);

const MissMark = () => (
  <svg
    viewBox="0 0 100 100"
    className="relative z-[30] w-1/3 h-1/3 text-gray-500 dark:text-gray-400"
  >
    <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="8" fill="none" />
  </svg>
);

/** Styling */
const cellBase =
  "relative aspect-square transition select-none flex items-center justify-center " +
  "ring-0 bg-transparent rounded-[10px] hover:bg-black/[0.1] dark:hover:bg-white/[0.1]";

// How tightly the ship should fill its rect (compensates for transparent PNG padding).
// 0.82–0.9 works well. You can tune per ship id if needed.
const SPRITE_FILL_DEFAULT = 0.3;
const SPRITE_FILL_BY_ID: Record<number, number> = {
  // override per ship if one looks smaller/larger than others
  1: 0.3, 2: 0.18, 3: 0.25, 4: 0.25, 5: 0.25,
};

export const BoardGrid: React.FC<{
  title: React.ReactNode;
  grid: Grid;
  shots: Shots;
  revealShips?: boolean;
  onCellClick?: (r: number, c: number) => void;
  disabled?: boolean;
  greenEllipseOnly?: boolean;

  // Aim overlay props
  aimAssist?: boolean;
  aimColorClass?: string;
  aimAlsoOnShotCells?: boolean;
  confirmPulseMs?: number;
  shipTopSprites?: Record<number, string>;
  headingsById?: Record<number, "N" | "E" | "S" | "W">;
  topHeadingDeg?: 0 | 90 | 180 | 270;
}> = ({
  title, grid, shots, revealShips = false, onCellClick, disabled = false, greenEllipseOnly = false,
  aimAssist = false,
  aimColorClass = "text-rose-700 dark:text-rose-300",
  aimAlsoOnShotCells = true,
  confirmPulseMs = 350,
  topHeadingDeg = 0, 
  shipTopSprites,
  headingsById = {},
}) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = React.useState<{ cell: number; gap: number; padX: number; padY: number } | null>(null);

  // track hover cell
  const [hoverRC, setHoverRC] = React.useState<{ r: number; c: number } | null>(null);
  // show brief pulse where we clicked
  const [confirmAt, setConfirmAt] = React.useState<{ r: number; c: number } | null>(null);

  // === upsert 1: label refs + measurer for exact-sized axis holes ===
  const vLabelRef = React.useRef<HTMLDivElement>(null);
  const hLabelRef = React.useRef<HTMLDivElement>(null);
  const [labelHoleHalf, setLabelHoleHalf] = React.useState<{ v: number; h: number }>({ v: 10, h: 16 });

  React.useLayoutEffect(() => {
    const vb = vLabelRef.current?.getBoundingClientRect();
    const hb = hLabelRef.current?.getBoundingClientRect();
    if (vb || hb) {
      setLabelHoleHalf(prev => ({
        v: vb ? vb.height / 2 : prev.v, // vertical label uses its *height*
        h: hb ? hb.width  / 2 : prev.h, // horizontal label uses its *width*
      }));
    }
  }, [hoverRC, metrics]);

  const sunkOverlays = React.useMemo(() => computeSunkOverlays(grid, shots), [grid, shots]);
  const sunkCells = React.useMemo(() => {
    const s = new Set<string>();
    sunkOverlays.forEach(o => o.cells.forEach(k => s.add(k)));
    return s;
  }, [sunkOverlays]);

  // can we shoot this cell?
  const canShootAt = React.useCallback(
    (r: number, c: number) => !!onCellClick && !disabled && shots[r][c] === 0,
    [onCellClick, disabled, shots]
  );

//   function computeShipRects(grid: number[][]) {
//     const seen = new Set<number>();
//     const rects: Array<{ id:number; r0:number; c0:number; r1:number; c1:number }> = [];
//     const N = grid.length;
//     for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
//         const id = grid[r][c];
//         if (id <= 0 || seen.has(id)) continue;
//         seen.add(id);
//         let r0 = r, c0 = c, r1 = r, c1 = c;
//         for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) {
//         if (grid[rr][cc] === id) {
//             if (rr < r0) r0 = rr; if (cc < c0) c0 = cc;
//             if (rr > r1) r1 = rr; if (cc > c1) c1 = cc;
//         }
//         }
//         rects.push({ id, r0, c0, r1, c1 });
//     }
//     return rects;
//     }

  // === boxes of placed ships (in grid units) ===
  const shipBoxes = React.useMemo(() => {
    const boxes = new Map<number, { r0:number; c0:number; r1:number; c1:number }>();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const id = grid[r][c];
        if (id > 0) {
        const b = boxes.get(id) || { r0:r, c0:c, r1:r, c1:c };
        if (r < b.r0) b.r0 = r; if (c < b.c0) b.c0 = c;
        if (r > b.r1) b.r1 = r; if (c > b.c1) b.c1 = c;
        boxes.set(id, b);
        }
    }
    return [...boxes.entries()].map(([id, b]) => ({ id, ...b }));
  }, [grid]);

  // === per-ship damage status (none / partial / sunk) during reveal ===
  const shipDamage = React.useMemo(() => {
    const status: Array<{ id:number; r0:number; c0:number; r1:number; c1:number; damage:"none"|"partial"|"sunk" }> = [];
    for (const b of shipBoxes) {
        let total = 0, hits = 0;
        for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) {
        if (grid[r][c] === b.id) {
            total++;
            if (shots[r][c] === 2) hits++;
        }
        }
        const damage = hits === 0 ? "none" : (hits >= total ? "sunk" : "partial");
        status.push({ ...b, damage });
    }
    return status;
  }, [shipBoxes, grid, shots]);

  // mouse tracking that snaps to actual cells (not the gaps)
  const onBoardMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!metrics) return;
    const { cell, gap, padX, padY } = metrics;
    const step = cell + gap;

    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - padX;
    const y = e.clientY - rect.top  - padY;

    if (x < 0 || y < 0) return setHoverRC(null);
    const c = Math.floor(x / step);
    const r = Math.floor(y / step);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return setHoverRC(null);

    const inCellX = (x % step) <= cell;
    const inCellY = (y % step) <= cell;
    if (!inCellX || !inCellY) return setHoverRC(null);

    setHoverRC({ r, c });
  }, [metrics]);

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
      const padX = a.left - wrapBox.left;
      const padY = a.top  - wrapBox.top;
      setMetrics({ cell, gap, padX, padY });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4 sm:mb-5 font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>

      <div
        ref={wrapRef}
        onMouseLeave={() => setHoverRC(null)}
        onMouseMove={onBoardMouseMove}
        className="
          relative w-full grid grid-cols-10 gap-1 p-2 rounded-xl
          bg-transparent ring-1 ring-black/10 dark:ring-white/10 shadow-2xl
        "
      >
        {/* === backdrop, contours, labels, ticks, corners === */}
        {metrics && (() => {
          const { cell, gap, padX, padY } = metrics;
          const total = SIZE * cell + (SIZE - 1) * gap;
          const lineX = (i: number) => padX - gap / 2 + i * (cell + gap);
          const lineY = (i: number) => padY - gap / 2 + i * (cell + gap);
          const isMajor = (i: number) => (i % 5 === 0);
          const minorLine = "bg-black/70 dark:bg-white/60";
          const majorLine = "bg-black dark:bg-white";
          const tickLine  = "bg-black/80 dark:bg-white/70";
          const labelC    = "text-[8px] font-semibold tracking-wide text-gray-900 dark:text-gray-100 opacity-95";

          const vLine = (i: number) => (
            <div key={`v-${i}`} className={`absolute w-px pointer-events-none ${isMajor(i) ? majorLine : minorLine} z-0`}
              style={{ left: lineX(i), top: lineY(0), height: total + gap }} aria-hidden />
          );
          const hLine = (i: number) => (
            <div key={`h-${i}`} className={`absolute h-px pointer-events-none ${isMajor(i) ? majorLine : minorLine} z-0`}
              style={{ top: lineY(i), left: lineX(0), width: total + gap }} aria-hidden />
          );

          const topTick = (i: number) => {
            const h = isMajor(i) ? 10 : 6;
            return <div key={`tt-${i}`} className={`absolute w-px pointer-events-none ${tickLine} z-0`} style={{ left: lineX(i), top: lineY(0) - h, height: h }} />;
          };
          const bottomTick = (i: number) => {
            const h = isMajor(i) ? 10 : 6;
            return <div key={`bt-${i}`} className={`absolute w-px pointer-events-none ${tickLine} z-0`} style={{ left: lineX(i), top: lineY(SIZE), height: h }} />;
          };
          const leftTick = (i: number) => {
            const w = isMajor(i) ? 10 : 6;
            return <div key={`lt-${i}`} className={`absolute h-px pointer-events-none ${tickLine} z-0`} style={{ top: lineY(i), left: lineX(0) - w, width: w }} />;
          };
          const rightTick = (i: number) => {
            const w = isMajor(i) ? 10 : 6;
            return <div key={`rt-${i}`} className={`absolute h-px pointer-events-none ${tickLine} z-0`} style={{ top: lineY(i), left: lineX(SIZE), width: w }} />;
          };

          const nums2 = Array.from({ length: SIZE }, (_, i) => i.toString().padStart(2, "0"));
          const topLabel = (i: number) => (
            <div key={`tl-${i}`} className={`absolute ${labelC} z-0`} style={{ top: lineY(0) - 18, left: padX + i * (cell + gap) + cell / 2, transform: "translateX(-50%)" }}>
              {nums2[i]}
            </div>
          );
          const bottomLabel = (i: number) => (
            <div key={`bl-${i}`} className={`absolute ${labelC} z-0`} style={{ top: lineY(SIZE) + 8, left: padX + i * (cell + gap) + cell / 2, transform: "translateX(-50%)" }}>
              {nums2[i]}
            </div>
          );
          const leftLabel = (i: number) => (
            <div key={`ll-${i}`} className={`absolute ${labelC} z-0`} style={{ left: lineX(0) - 22, top: padY + i * (cell + gap) + cell / 2, transform: "translateY(-50%)" }}>
              {nums2[i]}
            </div>
          );
          const rightLabel = (i: number) => (
            <div key={`rl-${i}`} className={`absolute ${labelC} z-0`} style={{ left: lineX(SIZE) + 8, top: padY + i * (cell + gap) + cell / 2, transform: "translateY(-50%)" }}>
              {nums2[i]}
            </div>
          );

          return (
            <>
              {/* backdrop */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-0 block dark:hidden"
                style={{
                  backgroundColor: "rgba(14,165,233,0.28)",
                  backgroundImage: [
                    "radial-gradient(circle at 22% 28%, rgba(14,165,233,0.35), rgba(14,165,233,0) 46%)",
                    "radial-gradient(circle at 74% 26%, rgba(2,132,199,0.30), rgba(2,132,199,0) 52%)",
                    "radial-gradient(circle at 70% 72%, rgba(59,130,246,0.28), rgba(59,130,246,0) 50%)",
                    "radial-gradient(circle at 30% 74%, rgba(2,132,199,0.26), rgba(2,132,199,0) 52%)",
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 6px)",
                  ].join(", "),
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-0 hidden dark:block"
                style={{
                  backgroundColor: "rgba(2,6,23,0.75)",
                  backgroundImage: [
                    "radial-gradient(circle at 22% 28%, rgba(56,189,248,0.30), rgba(56,189,248,0) 46%)",
                    "radial-gradient(circle at 74% 26%, rgba(14,165,233,0.28), rgba(14,165,233,0) 50%)",
                    "radial-gradient(circle at 70% 72%, rgba(59,130,246,0.28), rgba(59,130,246,0) 48%)",
                    "radial-gradient(circle at 30% 74%, rgba(2,132,199,0.26), rgba(2,132,199,0) 52%)",
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)",
                  ].join(", "),
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-0
                           bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.11),transparent_72%)]
                           dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09),transparent_72%)]"
                aria-hidden
              />

              {/* contours (SVG) — reverted to previous behavior */}
              <svg
                className="absolute pointer-events-none z-0"
                style={{ left: padX, top: padY, width: total, height: total }}
                viewBox={`0 0 ${total} ${total}`}
              >
                <defs>
                  <filter id="ct-soft" x="-5%" y="-5%" width="110%" height="110%">
                    <feGaussianBlur stdDeviation="0.6" />
                  </filter>
                </defs>

                {/* group 1: light */}
                <g className="stroke-black/60 dark:stroke-white/60" filter="url(#ct-soft)">
                  {[
                    { seed: 11, base: total * 0.22, amp: total * 0.07, k1: 0.7, k2: 1.3, tilt: total * 0.04 },
                    { seed: 29, base: total * 0.48, amp: total * 0.06, k1: 1.0, k2: 1.9, tilt: -total * 0.02 },
                    { seed: 41, base: total * 0.72, amp: total * 0.05, k1: 0.9, k2: 1.5, tilt: total * 0.03 },
                    { seed: 57, base: total * 0.35, amp: total * 0.04, k1: 1.4, k2: 2.1, tilt: -total * 0.015 },
                  ].map((cfg, i) => {
                    const d = (function make(seed:number, base:number, amp:number, k1:number, k2:number, tilt:number){
                      const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                      const R=srnd(seed); const pts: Array<{x:number;y:number}> = []; const steps=14;
                      for(let j=0;j<=steps;j++){const t=j/steps; const x=t*total; const nx=t*Math.PI*2;
                        const y=base + amp*Math.sin(nx*k1 + seed*0.13) + amp*0.6*Math.cos(nx*k2 + seed*0.29 + R()*0.4) + (t-0.5)*tilt;
                        pts.push({x,y});
                      }
                      let path=`M ${pts[0].x} ${pts[0].y}`;
                      for(let j=1;j<pts.length;j++){const p0=pts[j-1], p1=pts[j]; const dx=(p1.x-p0.x)/2; path+=` C ${p0.x+dx} ${p0.y} ${p1.x-dx} ${p1.y} ${p1.x} ${p1.y}`;}
                      return path;
                    })(cfg.seed,cfg.base,cfg.amp,cfg.k1,cfg.k2,cfg.tilt);
                    return (
                      <path key={`wave-light-${i}`} d={d} className="fill-none" strokeWidth={1.0} strokeDasharray="4 6" />
                    );
                  })}

                  {(function makeBlobPaths(){
                    const makeBlob=(seed:number,cx:number,cy:number,r:number)=>{
                      const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                      const R=srnd(seed);
                      const segs=12; const pts:Array<{x:number;y:number}>=[];
                      for(let i=0;i<segs;i++){
                        const a=(i/segs)*Math.PI*2;
                        const jitter=0.75+R()*0.5;
                        const rr=r*jitter;
                        pts.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr});
                      }
                      let d=`M ${pts[0].x} ${pts[0].y}`;
                      for(let i=1;i<=segs;i++){
                        const p0=pts[(i-1)%segs], p1=pts[i%segs];
                        const dx=(p1.x-p0.x)/2, dy=(p1.y-p0.y)/2;
                        d+=` C ${p0.x+dx} ${p0.y+dy} ${p1.x-dx} ${p1.y-dy} ${p1.x} ${p1.y}`;
                      }
                      return d+" Z";
                    };
                    return (
                      <>
                        <path d={makeBlob(73, total * 0.22, total * 0.62, total * 0.08)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                        <path d={makeBlob(97, total * 0.78, total * 0.18, total * 0.06)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                      </>
                    );
                  })()}
                </g>

                {/* group 2: dark-only duplicate */}
                <g className="hidden dark:block stroke-white/55" filter="url(#ct-soft)">
                  {[
                    { seed: 11, base: total * 0.22, amp: total * 0.07, k1: 0.7, k2: 1.3, tilt: total * 0.04 },
                    { seed: 29, base: total * 0.48, amp: total * 0.06, k1: 1.0, k2: 1.9, tilt: -total * 0.02 },
                    { seed: 41, base: total * 0.72, amp: total * 0.05, k1: 0.9, k2: 1.5, tilt: total * 0.03 },
                    { seed: 57, base: total * 0.35, amp: total * 0.04, k1: 1.4, k2: 2.1, tilt: -total * 0.015 },
                  ].map((cfg, i) => {
                    const d = (function make(seed:number, base:number, amp:number, k1:number, k2:number, tilt:number){
                      const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                      const R=srnd(seed); const pts: Array<{x:number;y:number}> = []; const steps=14;
                      for(let j=0;j<=steps;j++){const t=j/steps; const x=t*total; const nx=t*Math.PI*2;
                        const y=base + amp*Math.sin(nx*k1 + seed*0.13) + amp*0.6*Math.cos(nx*k2 + seed*0.29 + R()*0.4) + (t-0.5)*tilt;
                        pts.push({x,y});
                      }
                      let path=`M ${pts[0].x} ${pts[0].y}`;
                      for(let j=1;j<pts.length;j++){const p0=pts[j-1], p1=pts[j]; const dx=(p1.x-p0.x)/2; path+=` C ${p0.x+dx} ${p0.y} ${p1.x-dx} ${p1.y} ${p1.x} ${p1.y}`;}
                      return path;
                    })(cfg.seed,cfg.base,cfg.amp,cfg.k1,cfg.k2,cfg.tilt);
                    return (
                      <path key={`wave-dark-${i}`} d={d} className="fill-none" strokeWidth={1.0} strokeDasharray="4 6" />
                    );
                  })}

                  {(function makeBlobPaths(){
                    const makeBlob=(seed:number,cx:number,cy:number,r:number)=>{
                      const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                      const R=srnd(seed);
                      const segs=12; const pts:Array<{x:number;y:number}>=[];
                      for(let i=0;i<segs;i++){
                        const a=(i/segs)*Math.PI*2;
                        const jitter=0.75+R()*0.5;
                        const rr=r*jitter;
                        pts.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr});
                      }
                      let d=`M ${pts[0].x} ${pts[0].y}`;
                      for(let i=1;i<=segs;i++){
                        const p0=pts[(i-1)%segs], p1=pts[i%segs];
                        const dx=(p1.x-p0.x)/2, dy=(p1.y-p0.y)/2;
                        d+=` C ${p0.x+dx} ${p0.y+dy} ${p1.x-dx} ${p1.y-dy} ${p1.x} ${p1.y}`;
                      }
                      return d+" Z";
                    };
                    return (
                      <>
                        <path d={makeBlob(73, total * 0.22, total * 0.62, total * 0.08)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                        <path d={makeBlob(97, total * 0.78, total * 0.18, total * 0.06)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                      </>
                    );
                  })()}
                </g>
              </svg>

              {/* lines — nudge the whole grid line system 2px left & 2px up */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                aria-hidden
                style={{ transform: "translate(-0.5px, -0.5px)" }}  // tweak here
              >
                {Array.from({ length: SIZE + 1 }, (_, i) => vLine(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => hLine(i))}
              </div>

              {/* ticks */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                aria-hidden
                style={{ transform: "translate(-0.5px, -0.5px)" }}  // tweak here
              >
                {Array.from({ length: SIZE + 1 }, (_, i) => topTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => bottomTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => leftTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => rightTick(i))}
              </div>

              {/* labels */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                aria-hidden
                style={{ transform: "translate(-0.5px, -0.5px)" }}  // tweak here
              >
                {Array.from({ length: SIZE }, (_, i) => topLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => bottomLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => leftLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => rightLabel(i))}
              </div>

              {/* corners */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                aria-hidden
                style={{ transform: "translate(-0.5px, -0.5px)" }}  // tweak here
              >
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(0) - 3,  top: lineY(0) - 3 }} />
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(SIZE) - 3, top: lineY(0) - 3 }} />
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(0) - 3,  top: lineY(SIZE) - 3 }} />
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(SIZE) - 3, top: lineY(SIZE) - 3 }} />
              </div>
            </>
          );
        })()}

        {/* Cells */}
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE), c = i % SIZE;
          const shipId = grid[r][c];
          const shot = shots[r][c];

          const canClick = !disabled && !!onCellClick && shot === 0;
          const classes = cellBase + (canClick ? " cursor-pointer" : " cursor-default");

          const inSunk = sunkCells.has(`${r},${c}`);
          const showGreen = revealShips && shipId > 0 && !shipTopSprites;

          return (
            <button
              key={`cell-${title}-${r}-${c}`}
              data-rc={`${r},${c}`}
              className={`${classes} w-full z-20`}
              onMouseEnter={() => setHoverRC({ r, c })}
              onMouseLeave={() => setHoverRC(null)}
              onClick={
                canClick
                  ? () => {
                      setConfirmAt({ r, c });
                      if (confirmPulseMs) setTimeout(() => setConfirmAt(null), confirmPulseMs);
                      onCellClick!(r, c);
                      setHoverRC(null);
                    }
                  : undefined
              }
              disabled={!canClick}
              aria-label={`${title} ${r},${c}`}
            >
              {showGreen && greenEllipseOnly && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {showGreen && !greenEllipseOnly && false && (
                <span className="absolute inset-0 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
            </button>
          );
        })}

        {/* Ship top-view sprites (replace green cells) */}
        {metrics && revealShips && (() => {
        const { cell, gap, padX, padY } = metrics;

        // derive heading from each box if caller didn't supply one
        const headingOf = (b: { r0:number; r1:number; c0:number; c1:number }) =>
            (b.c1 - b.c0 + 1) >= (b.r1 - b.r0 + 1) ? "E" : "N";

        return shipBoxes.map((b) => {
            const atlas = shipTopSprites ?? TOP_SPRITES;
            const src = atlas[b.id];
            // or, if you import TOP_SPRITES here: const src = TOP_SPRITES[b.id];
            if (!src) return null;

            // grid → pixels
            const spanCols = b.c1 - b.c0 + 1;
            const spanRows = b.r1 - b.r0 + 1;
            const w = spanCols * cell + (spanCols - 1) * gap;
            const h = spanRows * cell + (spanRows - 1) * gap;
            const x = padX + b.c0 * (cell + gap);
            const y = padY + b.r0 * (cell + gap);

            // scale inside the rect to compensate for PNG padding
            const fill = SPRITE_FILL_BY_ID[b.id] ?? SPRITE_FILL_DEFAULT;
            const scale = 1 / fill;

            const heading = (headingsById?.[b.id] ?? headingOf(b)) as any;

            return (
            <ShipTopView
                key={`spr-${b.id}`}
                src={src}
                rect={{ x, y, w, h }}
                heading={heading}
                scale={scale}
            />
            );
        });
        })()}

        {/* Reveal overlays for intact/partial ships (green) — match red geometry & layer */}
        {metrics && revealShips && (() => {
          const { cell, gap, padX, padY } = metrics;
          return shipDamage.map(({ r0, c0, r1, c1, damage }, idx) => {
            if (damage === "sunk") return null; // red pill handles sunk
            // Use the SAME bbox math as red overlays so it never bleeds outside cells
            const x = padX + c0 * (cell + gap);
            const y = padY + r0 * (cell + gap);
            const w = (c1 - c0 + 1) * cell + (c1 - c0) * gap;
            const h = (r1 - r0 + 1) * cell + (r1 - r0) * gap;
            const radius = Math.min(w, h) / 2;
            return (
              <div
                key={`rev-green-${idx}`}
                className="absolute pointer-events-none z-22 bg-emerald-500/30 ring-1 ring-emerald-600/60"
                style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
                aria-hidden
                title={damage === "none" ? "Undamaged ship" : "Damaged ship"}
              />
            );
          });
        })()}

        {/* Sunk overlays */}
        {metrics &&
          sunkOverlays.map((o, idx) => {
            const { cell, gap, padX, padY } = metrics;
            const x = padX + o.c0 * (cell + gap);
            const y = padY + o.r0 * (cell + gap);
            const w = (o.c1 - o.c0 + 1) * cell + (o.c1 - o.c0) * gap;
            const h = (o.r1 - o.r0 + 1) * cell + (o.r1 - o.r0) * gap;
            const radius = Math.min(w, h) / 2;
            return (
              <div
                key={`sunk-${idx}`}
                className="absolute pointer-events-none z-[12] bg-rose-500/30 ring-1 ring-rose-600/40"
                style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
                aria-hidden
                title="Sunk vessel"
              />
            );
          })}

        {/* Reveal overlays for intact/partial ships (green) */}
        {/* {metrics && revealShips && (() => {
        const { cell, gap, padX, padY } = metrics;
        return shipDamage.map(({ r0, c0, r1, c1, damage }, idx) => {
            if (damage === "sunk") return null; // red overlay handles sunk
            const x = padX + c0 * (cell + gap);
            const y = padY + r0 * (cell + gap);
            const w = (c1 - c0 + 1) * cell + (c1 - c0) * gap;
            const h = (r1 - r0 + 1) * cell + (r1 - r0) * gap;
            const radius = Math.min(w, h) / 2;
            return (
            <div
                key={`rev-green-${idx}`}
                className="absolute pointer-events-none z-[18] bg-emerald-400/28 ring-1 ring-emerald-400/45"
                style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
                aria-hidden
                title={damage === "none" ? "Undamaged ship" : "Damaged ship"}
            />
            );
        });
        })()} */}

        {/* === upsert 2: AIM OVERLAY (crosshair axes + animated reticle + edge-aware lat/lon labels) === */}
        {metrics && aimAssist && !disabled && hoverRC && (aimAlsoOnShotCells || canShootAt(hoverRC.r, hoverRC.c)) && (() => {
          const { cell, gap, padX, padY } = metrics;
          const { r: hr, c: hc } = hoverRC;

          const total = SIZE * cell + (SIZE - 1) * gap;
          const boardLeft = padX - gap / 2;
          const boardTop  = padY - gap / 2;
          const boardW    = total + gap;
          const boardH    = total + gap;

          const cx = padX + hc * (cell + gap) + cell / 2;
          const cy = padY + hr * (cell + gap) + cell / 2;

          // reticle geometry
          const d  = cell * 0.68;
          const rr = d / 2;

          const shootable = canShootAt(hr, hc);
          const lineOpacity    = shootable ? 0.9  : 0.5;
          const reticleOpacity = shootable ? 0.95 : 0.55;

          // edge-aware sides: rows 0–1 => vertical label below, cols 8–9 => horizontal label left
          const vSide: "above" | "below" = hr <= 1 ? "below" : "above";
          const hSide: "left" | "right"  = hc >= SIZE - 2 ? "left" : "right";

          const labelGap = Math.max(6, Math.round(cell * 0.14));
          const ringPad  = Math.max(4, Math.round(cell * 0.10));

          const vCenterY = vSide === "above"
            ? (cy - rr) - labelGap - labelHoleHalf.v
            : (cy + rr) + labelGap + labelHoleHalf.v;
          const hCenterX = hSide === "right"
            ? (cx + rr) + labelGap + labelHoleHalf.h
            : (cx - rr) - labelGap - labelHoleHalf.h;

          const vRingTop = cy - (rr + ringPad), vRingBot = cy + (rr + ringPad);
          const hRingL   = cx - (rr + ringPad), hRingR   = cx + (rr + ringPad);

          const vHoleStart = vCenterY - labelHoleHalf.v, vHoleEnd = vCenterY + labelHoleHalf.v;
          const hHoleStart = hCenterX - labelHoleHalf.h, hHoleEnd = hCenterX + labelHoleHalf.h;

          function segmentsFromHoles(start: number, end: number, holes: Array<[number, number]>) {
            const hs = holes
              .map(([a, b]) => [Math.max(start, Math.min(a, b)), Math.min(end, Math.max(a, b))] as [number, number])
              .filter(([a, b]) => b > a)
              .sort((A, B) => A[0] - B[0]);

            const out: Array<[number, number]> = [];
            let cur = start;
            for (const [a, b] of hs) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
            if (cur < end) out.push([cur, end]);
            return out;
          }

          const vSegs = segmentsFromHoles(boardTop, boardTop + boardH, [[vRingTop, vRingBot], [vHoleStart, vHoleEnd]]);
          const hSegs = segmentsFromHoles(boardLeft, boardLeft + boardW, [[hRingL, hRingR],   [hHoleStart, hHoleEnd]]);

          const axisThicknessPx = 2.5;

          const VSeg: React.FC<{ y0: number; y1: number }> = ({ y0, y1 }) => (
          <div
            className="absolute"
            style={{
            left: cx,
            top: y0,
            height: y1 - y0,
            width: 0,
            borderLeft: `${axisThicknessPx}px dashed currentColor`,
            opacity: lineOpacity,
            transform: "translateX(-0.5px)",
            }}
          />
          );

          const HSeg: React.FC<{ x0: number; x1: number }> = ({ x0, x1 }) => (
          <div
            className="absolute"
            style={{
            top: cy,
            left: x0,
            width: x1 - x0,
            height: 0,
            borderTop: `${axisThicknessPx}px dashed currentColor`,
            opacity: lineOpacity,
            transform: "translateY(-0.5px)",
            }}
          />
          );

          const num2 = (n: number) => n.toString().padStart(2, "0");

          return (
            <div className={`absolute inset-0 pointer-events-none z-30 ${aimColorClass}`} aria-hidden>
              {/* axes with holes (reticle + labels) */}
              {vSegs.map(([y0, y1], i) => <VSeg key={`v-${i}`} y0={y0} y1={y1} />)}
              {hSegs.map(([x0, x1], i) => <HSeg key={`h-${i}`} x0={x0} x1={x1} />)}

              {/* rotating reticle */}
              <svg
                className={`absolute ${shootable ? "animate-[spin_2.5s_linear_infinite]" : ""}`}
                style={{ left: cx - rr, top: cy - rr, width: d, height: d, opacity: reticleOpacity }}
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="55" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.9" />
                <line x1="50" y1="12" x2="50" y2="24" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <line x1="88" y1="50" x2="76" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <line x1="50" y1="76" x2="50" y2="88" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <line x1="24" y1="50" x2="12" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <circle cx="50" cy="50" r="8" fill="currentColor" />
              </svg>

              {/* click pulse */}
              {confirmAt && confirmAt.r === hr && confirmAt.c === hc && (
                <span
                  className="absolute rounded-full border-2 border-current animate-ping"
                  style={{ left: cx - rr, top: cy - rr, width: d, height: d, opacity: 0.8 }}
                />
              )}

              {/* edge-aware, center-anchored label cards */}
              {/* vertical (lat) — rotates 90°, flips below for rows 0–1 */}
              <div
                ref={vLabelRef}
                className="
                  absolute px-1.5 py-[2px] rounded
                  font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em]
                  bg-black/5 dark:bg-white/5 shadow-sm backdrop-blur-[1px]
                  transform -translate-x-1/2 -translate-y-1/2 -rotate-90
                "
                style={{
                  left: cx,
                  top: vCenterY,
                  transformOrigin: "50% 50%",
                  opacity: reticleOpacity,
                }}
              >
                {`N${num2(hr)}°`}
              </div>

              {/* horizontal (lon) — flips to left for cols 8–9 */}
              <div
                ref={hLabelRef}
                className="
                  absolute px-1.5 py-[2px] rounded
                  font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em]
                  bg-black/5 dark:bg-white/5 shadow-sm backdrop-blur-[1px]
                  transform -translate-x-1/2 -translate-y-1/2
                "
                style={{
                  left: hCenterX,
                  top: cy,
                  opacity: reticleOpacity,
                }}
              >
                {`E${num2(hc)}°`}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
