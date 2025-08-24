import React from "react";
import { SIZE } from "lib/battleship";
import type { Grid, Shots } from "lib/battleship";
import { computeSunkOverlays } from "../utils/overlays";

/** Marks */
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

/** Styling */
const cellBase =
  "relative aspect-square transition select-none flex items-center justify-center " +
  "ring-0 bg-transparent rounded-[10px] hover:bg-black/[0.1] dark:hover:bg-white/[0.1]";

export const BoardGrid: React.FC<{
  title: React.ReactNode;
  grid: Grid;
  shots: Shots;
  revealShips?: boolean;
  onCellClick?: (r: number, c: number) => void;
  disabled?: boolean;
  greenEllipseOnly?: boolean;
  aimAssist?: boolean;
  aimColorClass?: string;
  aimAlsoOnShotCells?: boolean;
  confirmPulseMs?: number;
}> = ({
  title, grid, shots, revealShips = false, onCellClick, disabled = false, greenEllipseOnly = false,
  aimAssist = false,
  aimColorClass = "text-rose-700 dark:text-rose-300",
  aimAlsoOnShotCells = true,
  confirmPulseMs = 350,
}) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = React.useState<{ cell: number; gap: number; padX: number; padY: number } | null>(null);

  // track hover cell
  const [hoverRC, setHoverRC] = React.useState<{ r: number; c: number } | null>(null);
  // show brief pulse where we clicked
  const [confirmAt, setConfirmAt] = React.useState<{ r: number; c: number } | null>(null);

  // measure label sizes so axis gaps fully cover the cards
  const vLabelRef = React.useRef<HTMLDivElement>(null);
  const hLabelRef = React.useRef<HTMLDivElement>(null);
  const [labelHoleHalf, setLabelHoleHalf] = React.useState<{ v: number; h: number }>({ v: 18, h: 18 });

  React.useLayoutEffect(() => {
  if (!hoverRC || !metrics) return;
  // wait one frame so labels render, then measure
  const raf = requestAnimationFrame(() => {
    const vb = vLabelRef.current?.getBoundingClientRect();
    const hb = hLabelRef.current?.getBoundingClientRect();
    if (vb && hb) {
    const vHalf = Math.ceil(vb.height / 2) + 2; // vertical axis gap uses label's *screen height*
    const hHalf = Math.ceil(hb.width  / 2) + 2; // horizontal axis gap uses label's *screen width*
    setLabelHoleHalf(prev => (prev.v !== vHalf || prev.h !== hHalf ? { v: vHalf, h: hHalf } : prev));
    }
  });
  return () => cancelAnimationFrame(raf);
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

  const onBoardMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!metrics) return;
    const { cell, gap, padX, padY } = metrics;
    const step = cell + gap;

    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - padX;
    const y = e.clientY - rect.top  - padY;

    // Outside the 10x10 area?
    if (x < 0 || y < 0) return setHoverRC(null);
    const c = Math.floor(x / step);
    const r = Math.floor(y / step);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return setHoverRC(null);

    // (Optional) only snap when actually over a cell, not the gaps:
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

                {/* group 1: light + (also visible in dark due to class), with wavy paths + blobs */}
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

                {/* group 2: dark-only duplicate (wavy + blobs) to match previous */}
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

              {/* lines */}
              <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                {Array.from({ length: SIZE + 1 }, (_, i) => vLine(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => hLine(i))}
              </div>

              {/* ticks */}
              <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                {Array.from({ length: SIZE + 1 }, (_, i) => topTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => bottomTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => leftTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => rightTick(i))}
              </div>

              {/* labels */}
              <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                {Array.from({ length: SIZE }, (_, i) => topLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => bottomLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => leftLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => rightLabel(i))}
              </div>

              {/* corners */}
              <div className="absolute pointer-events-none z-0" aria-hidden>
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
          const showGreen = revealShips && shipId > 0;

          return (
            <button
              key={`cell-${title}-${r}-${c}`}
              data-rc={`${r},${c}`}
              className={`${classes} w-full z-10`}
              onMouseEnter={() => setHoverRC({ r, c })}
              onMouseLeave={() => setHoverRC(null)}
              onClick={
                canClick
                ? () => {
                    setConfirmAt({ r, c });
                    if (confirmPulseMs) {
                        setTimeout(() => setConfirmAt(null), confirmPulseMs);
                    }
                    onCellClick!(r, c);
                    setHoverRC(null); // optional: hide overlay after shot
                    }
                : undefined
              }
              disabled={!canClick}
              aria-label={`${title} ${r},${c}`}
            >
              {showGreen && greenEllipseOnly && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {showGreen && !greenEllipseOnly && (
                <span className="absolute inset-0 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
            </button>
          );
        })}

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
                className="absolute pointer-events-none bg-rose-500/30 ring-1 ring-rose-500/40 z-20"
                style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
                aria-hidden
                title="Sunk vessel"
              />
            );
        })}

        {/* === AIM OVERLAY (crosshair axes + animated reticle + measured label holes) === */}
        {metrics && aimAssist && !disabled && hoverRC && (aimAlsoOnShotCells || canShootAt(hoverRC.r, hoverRC.c)) && (() => {
        const { cell, gap, padX, padY } = metrics;
        const { r: hr, c: hc } = hoverRC;

        const total     = SIZE * cell + (SIZE - 1) * gap;
        const boardLeft = padX - gap / 2;
        const boardTop  = padY - gap / 2;
        const boardW    = total + gap;
        const boardH    = total + gap;

        // center of hovered cell
        const cx = padX + hc * (cell + gap) + cell / 2;
        const cy = padY + hr * (cell + gap) + cell / 2;

        // reticle geometry (keep your current numbers)
        const d  = cell * 0.68;
        const rr = d / 2;

        const shootable       = canShootAt(hr, hc);
        const lineOpacity     = shootable ? 0.9 : 0.5;
        const reticleOpacity  = shootable ? 0.95 : 0.55;
        const axisThicknessPx = 2.5;

        // reticle hole
        const ringPad   = Math.max(6, Math.round(cell * 0.05));
        const holeTop   = cy - rr - ringPad;
        const holeBot   = cy + rr + ringPad;
        const holeLeft  = cx - rr - ringPad;
        const holeRight = cx + rr + ringPad;

        // lat/long texts
        const num2 = (n:number) => n.toString().padStart(2, "0");

        // equal spacing from ring for both labels
        const labelGap = Math.max(8, Math.round(cell * 0.08));

        // measured half-sizes (already set via useLayoutEffect)
        const vHalf = labelHoleHalf.v; // vertical label: uses its *rendered height* / 2
        const hHalf = labelHoleHalf.h; // horizontal label: uses its *rendered width*  / 2

        // === CENTER POSITIONS for labels (so they sit inside their holes) ===
        // vertical label hole center: above the ring by `labelGap`
        const vCenterY = (holeTop - labelGap) - vHalf; // center of the vertical label card
        // horizontal label hole center: right of the ring by `labelGap`
        const hCenterX = (holeRight + labelGap) + hHalf; // center of the horizontal label card

        // --- draw axes segments (unchanged) using vCenterY/vHalf and hCenterX/hHalf ---
        const vTopHoleStart = vCenterY - vHalf;
        const vTopHoleEnd   = vCenterY + vHalf;
        const hHoleStart    = hCenterX - hHalf;
        const hHoleEnd      = hCenterX + hHalf;

        // axis segment helpers
        const VSeg = (y1: number, y2: number, key: string) => {
            const top = Math.max(boardTop, Math.min(y1, y2));
            const bot = Math.min(boardTop + boardH, Math.max(y1, y2));
            if (bot - top <= 0) return null;
            return (
            <div
                key={key}
                className="absolute"
                style={{
                left: cx,
                top,
                height: bot - top,
                width: 0,
                borderLeft: `${axisThicknessPx}px dashed currentColor`,
                opacity: lineOpacity,
                transform: "translateX(-0.5px)",
                }}
            />
            );
        };
        const HSeg = (x1: number, x2: number, key: string) => {
            const left  = Math.max(boardLeft, Math.min(x1, x2));
            const right = Math.min(boardLeft + boardW, Math.max(x1, x2));
            if (right - left <= 0) return null;
            return (
            <div
                key={key}
                className="absolute"
                style={{
                top: cy,
                left,
                width: right - left,
                height: 0,
                borderTop: `${axisThicknessPx}px dashed currentColor`,
                opacity: lineOpacity,
                transform: "translateY(-0.5px)",
                }}
            />
            );
        };

        // vertical axis: draw with two holes (label, then reticle)
        const vSegs = [
            [boardTop, vTopHoleStart, "v-0"],
            [vTopHoleEnd, holeTop,    "v-1"],
            [holeBot,     boardTop + boardH, "v-2"],
        ] as const;

        // horizontal axis: draw with two holes (reticle, then label)
        const hSegs = [
            [boardLeft, holeLeft, "h-0"],
            [holeRight, hHoleStart, "h-1"],
            [hHoleEnd,  boardLeft + boardW, "h-2"],
        ] as const;

        return (
            <div className={`absolute inset-0 pointer-events-none z-30 ${aimColorClass}`} aria-hidden>
            {/* Vertical axis with measured label hole + reticle hole */}
            {vSegs.map(([a, b, k]) => VSeg(a, b, k))}
            {/* Horizontal axis with reticle hole + measured label hole */}
            {hSegs.map(([a, b, k]) => HSeg(a, b, k))}

            {/* Reticle (unchanged except for your spin speed) */}
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

            {/* Click pulse */}
            {confirmAt && confirmAt.r === hr && confirmAt.c === hc && (
                <span
                className="absolute rounded-full border-2 border-current animate-ping"
                style={{ left: cx - rr, top: cy - rr, width: d, height: d, opacity: 0.8 }}
                />
            )}

            {/* === Tactical labels (lat/long) === */}
            {/* LAT (row) — center on (cx, vCenterY), then rotate -90° */}
            <div
            ref={vLabelRef}
            className="
                absolute px-1.5 py-[2px] rounded
                font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em]
                bg-black/5 dark:bg-white/5 shadow-sm backdrop-blur-[1px]
                transform -translate-x-1/2 -translate-y-1/2 -rotate-90
            "
            style={{
                left: cx,           // anchor at center of the card
                top:  vCenterY,     // anchor at center of the card
                opacity: reticleOpacity,
                transformOrigin: "50% 50%",
            }}
            >
            {`N${num2(hr)}°`}
            </div>

            {/* LON (col) — center on (hCenterX, cy), no rotation */}
            <div
            ref={hLabelRef}
            className="
                absolute px-1.5 py-[2px] rounded
                font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em]
                bg-black/5 dark:bg-white/5 shadow-sm backdrop-blur-[1px]
                transform -translate-x-1/2 -translate-y-1/2
            "
            style={{
                left: hCenterX,     // anchor at center of the card
                top:  cy,           // anchor at center of the card
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

