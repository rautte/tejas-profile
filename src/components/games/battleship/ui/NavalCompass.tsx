import React from "react";

type CompassDir = "N" | "E" | "S" | "W";

export const NavalCompass: React.FC<{
  dir: CompassDir;
  canInteract: boolean;
  onChoose: (d: CompassDir) => void;
  Emblem?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
}> = ({ dir, canInteract, onChoose, Emblem: EmblemIcon }) => {
  const [localDir, setLocalDir] = React.useState<CompassDir>(dir);
  const [tick, setTick] = React.useState(0);
  const uid = React.useId();
  const id = (s: string) => `${uid}-${s}`;

  // keyboard: R to rotate through N→E→S→W
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canInteract) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const order: CompassDir[] = ["N", "E", "S", "W"];
        const nd = order[(order.indexOf(localDir) + 1) % order.length];
        setLocalDir(nd);
        onChoose(nd);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canInteract, localDir, onChoose]);

  // gentle wobble when disabled
  React.useEffect(() => {
    if (canInteract) return;
    let raf: number | null = null;
    const loop = () => { setTick(Date.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [canInteract]);

  const baseAngle = localDir === "N" ? 0 : localDir === "E" ? 90 : localDir === "S" ? 180 : -90;
  const wobble = canInteract ? 0 : Math.sin(tick / 600) * 5;
  const angle = baseAngle + wobble;

  const ring  = "stroke-black/10 dark:stroke-white/10";
  const tickC = "stroke-gray-500 dark:stroke-gray-400";
  const textFill = "fill-gray-700 dark:fill-gray-200";

  const size = 200;
  const cx = size / 2, cy = size / 2, r = 80;
  const R_PCT = ((r + 18) / size) * 100;
  const BTN_GAP_PX = 6;

  const DirButton: React.FC<{
    d: CompassDir; style: React.CSSProperties; centerX?: boolean; centerY?: boolean;
  }> = ({ d, style, centerX, centerY }) => (
    <button
      type="button"
      onClick={canInteract ? () => { setLocalDir(d); onChoose(d); } : undefined}
      disabled={!canInteract}
      className={[
        "absolute px-2 py-1 rounded-md text-xs font-semibold",
        centerX ? "-translate-x-1/2" : "",
        centerY ? "-translate-y-1/2" : "",
        "ring-1 ring-black/10 dark:ring-white/10",
        localDir === d
          ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
          : "bg-white/80 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
        canInteract ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-70",
      ].join(" ")}
      style={style}
      aria-label={`Point ${d}`}
    >
      {d}
    </button>
  );

  return (
    <div className="relative mx-auto w-full max-w-[190px] mb-3 select-none bg-transparent" aria-label="Naval compass">
      <DirButton d="N" centerX centerY style={{ top: `calc(50% - ${R_PCT}% - ${BTN_GAP_PX}px)`, left: "50%" }} />
      <DirButton d="E" centerX centerY style={{ top: "50%", left: `calc(50% + ${R_PCT}% + ${BTN_GAP_PX}px)` }} />
      <DirButton d="S" centerX centerY style={{ top: `calc(50% + ${R_PCT}% + ${BTN_GAP_PX}px)`, left: "50%" }} />
      <DirButton d="W" centerX centerY style={{ top: "50%", left: `calc(50% - ${R_PCT}% - ${BTN_GAP_PX}px)` }} />

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={id("bezelLight")} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#f3f4f6"/><stop offset="25%"  stopColor="#e5e7eb"/>
            <stop offset="55%"  stopColor="#cdd3da"/><stop offset="80%"  stopColor="#b9c0c9"/>
            <stop offset="100%" stopColor="#98a2ad"/>
          </linearGradient>
          <linearGradient id={id("bezelDark")} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.25)"/>
            <stop offset="40%"  stopColor="rgba(255,255,255,0.12)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.06)"/>
          </linearGradient>
          <radialGradient id={id("bezelSheenL")} cx="30%" cy="28%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)"/><stop offset="35%" stopColor="rgba(255,255,255,0.20)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <radialGradient id={id("bezelSheenD")} cx="30%" cy="28%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)"/><stop offset="35%" stopColor="rgba(255,255,255,0.12)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>

          <radialGradient id={id("dialL")} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#f7f7f7"/><stop offset="55%" stopColor="#e5e7eb"/>
            <stop offset="100%" stopColor="#cbd5e1"/>
          </radialGradient>
          <radialGradient id={id("dialD")} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#2a2f36"/><stop offset="60%" stopColor="#20242a"/>
            <stop offset="100%" stopColor="#151922"/>
          </radialGradient>

          <filter id={id("brushed")} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8 0.03" numOctaves="1" seed="3" result="n"/>
            <feGaussianBlur in="n" stdDeviation="0.6" result="nb"/>
            <feColorMatrix in="nb" type="saturate" values="0.2" result="nbs"/>
            <feComponentTransfer in="nbs" result="na">
              <feFuncA type="table" tableValues="0 0.12"/>
            </feComponentTransfer>
            <feBlend mode="multiply" in="SourceGraphic" in2="na" result="mul"/>
            <feComposite in="mul" in2="SourceAlpha" operator="in"/>
          </filter>

          <linearGradient id={id("ringStrokeL")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bfc7d1"/><stop offset="50%" stopColor="#eef0f3"/><stop offset="100%" stopColor="#a1aab5"/>
          </linearGradient>
          <linearGradient id={id("ringStrokeD")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8"/><stop offset="50%" stopColor="#e5e7eb"/><stop offset="100%" stopColor="#64748b"/>
          </linearGradient>

          <linearGradient id={id("roseMetalL")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffd1d6"/><stop offset="45%" stopColor="#fb7185"/>
            <stop offset="75%"  stopColor="#dc3b52"/><stop offset="100%" stopColor="#a61935"/>
          </linearGradient>
          <linearGradient id={id("roseMetalD")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#fde2e4"/><stop offset="45%" stopColor="#f27386"/>
            <stop offset="75%"  stopColor="#b91c1c"/><stop offset="100%" stopColor="#5b0f19"/>
          </linearGradient>
          <linearGradient id={id("blueMetalL")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#dbeafe"/><stop offset="45%" stopColor="#93c5fd"/>
            <stop offset="75%"  stopColor="#3b82f6"/><stop offset="100%" stopColor="#1e3a8a"/>
          </linearGradient>
          <linearGradient id={id("blueMetalD")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#dbeafe"/><stop offset="45%" stopColor="#60a5fa"/>
            <stop offset="75%"  stopColor="#1d4ed8"/><stop offset="100%" stopColor="#0b255f"/>
          </linearGradient>

          <radialGradient id={id("hubL")} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffffff"/><stop offset="55%" stopColor="#e5e7eb"/>
            <stop offset="100%" stopColor="#cbd5e1"/>
          </radialGradient>
          <radialGradient id={id("hubD")} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#e5e7eb"/><stop offset="55%" stopColor="#9ca3af"/>
            <stop offset="100%" stopColor="#111827"/>
          </radialGradient>

          <filter id={id("printBleed")} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>
          <filter id={id("compassShadow")} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.35" />
          </filter>
        </defs>

        <g filter={`url(#${id("compassShadow")})`}>
          {/* Bezel */}
          <circle cx={cx} cy={cy} r={r + 18} className="dark:hidden" fill={`url(#${id("bezelLight")})`} />
          <circle cx={cx} cy={cy} r={r + 18} className="hidden dark:block" fill={`url(#${id("bezelDark")})`} />
          <circle cx={cx} cy={cy} r={r + 18} className="pointer-events-none dark:hidden" fill={`url(#${id("bezelSheenL")})`} />
          <circle cx={cx} cy={cy} r={r + 18} className="pointer-events-none hidden dark:block" fill={`url(#${id("bezelSheenD")})`} />

          {/* Dial */}
          <circle cx={cx} cy={cy} r={r + 6} className="dark:hidden" fill={`url(#${id("dialL")})`} filter={`url(#${id("brushed")})`} />
          <circle cx={cx} cy={cy} r={r + 6} className="hidden dark:block" fill={`url(#${id("dialD")})`} filter={`url(#${id("brushed")})`} />

          {/* Inner ring */}
          <circle cx={cx} cy={cy} r={r} className={ring} fill="none" strokeWidth={2.2} stroke={`url(#${id("ringStrokeL")})`} />
          <circle cx={cx} cy={cy} r={r} className={`hidden dark:inline ${ring}`} fill="none" strokeWidth={2.2} stroke={`url(#${id("ringStrokeD")})`} />

          {/* Ticks */}
          {[...Array(60)].map((_, i) => {
            const a = (i * 6) * Math.PI / 180;
            const isMajor = i % 5 === 0;
            const r1 = r - (isMajor ? 10 : 5);
            const r2 = r;
            const x1 = cx + r1 * Math.cos(a), y1 = cy + r1 * Math.sin(a);
            const x2 = cx + r2 * Math.cos(a), y2 = cy + r2 * Math.sin(a);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                className={tickC} strokeWidth={isMajor ? 2 : 1} opacity={isMajor ? 0.95 : 0.7} />
            );
          })}

          {/* Printed dial text */}
          <g filter={`url(#${id("printBleed")})`} textAnchor="middle" dominantBaseline="middle">
            <g className="dark:hidden" fill="rgba(31,41,55,0.75)">
              <text x={cx + 2} y={cy - 35} fontSize="10" fontWeight={800} style={{ letterSpacing: "0.25em" }}>
                HEADING
              </text>
              <text x={cx + 2} y={cy - 25} fontSize="8" fontWeight={700} style={{ letterSpacing: "0.06em" }}>
                Compass
              </text>
            </g>
            <g className="hidden dark:block" fill="rgba(229,231,235,0.75)">
              <text x={cx + 2} y={cy - 35} fontSize="10" fontWeight={800} style={{ letterSpacing: "0.25em" }}>
                HEADING
              </text>
              <text x={cx + 2} y={cy - 25} fontSize="8" fontWeight={700} style={{ letterSpacing: "0.06em" }}>
                Compass
              </text>
            </g>
          </g>

          {/* Team emblem — tint via currentColor so it matches HEADING */}
          <g filter={`url(#${id("printBleed")})`} aria-label="team-emblem">
            <g className="dark:hidden" fill="rgba(31,41,55,0.75)" stroke="rgba(31,41,55,0.75)">
              <g transform={`translate(${cx - 9}, ${cy + 20}) scale(0.85)`}>
                {EmblemIcon ? (
                  <EmblemIcon width={22} height={22} fill="currentColor" stroke="currentColor"
                    style={{ color: "rgba(31,41,55,0.75)" }} aria-hidden />
                ) : null}
              </g>
            </g>
            <g className="hidden dark:block" fill="rgba(229,231,235,0.75)" stroke="rgba(229,231,235,0.75)">
              <g transform={`translate(${cx - 9}, ${cy + 20}) scale(0.85)`}>
                {EmblemIcon ? (
                  <EmblemIcon width={22} height={22} fill="currentColor" stroke="currentColor"
                    style={{ color: "rgba(229,231,235,0.75)" }} aria-hidden />
                ) : null}
              </g>
            </g>
          </g>

          {/* NESW */}
          <g fontSize="13" fontWeight={700} className={textFill} textAnchor="middle" dominantBaseline="middle">
            <text x={cx} y={cy - r + 22}>N</text>
            <text x={cx + r - 18} y={cy}>E</text>
            <text x={cx} y={cy + r - 22}>S</text>
            <text x={cx - r + 18} y={cy}>W</text>
          </g>

          {/* Needle */}
          <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angle}deg)` }}>
            <polygon
              points={`${cx},${cy - (r - 12)} ${cx - 7},${cy + 11} ${cx + 7},${cy + 11}`}
              className="dark:hidden" fill={`url(#${id("roseMetalL")})`} opacity={0.98}
            />
            <polygon
              points={`${cx},${cy - (r - 12)} ${cx - 7},${cy + 11} ${cx + 7},${cy + 11}`}
              className="hidden dark:block" fill={`url(#${id("roseMetalD")})`} opacity={0.98}
            />
            <polygon
              points={`${cx},${cy + (r - 12)} ${cx - 7},${cy - 11} ${cx + 7},${cy - 11}`}
              className="dark:hidden" fill={`url(#${id("blueMetalL")})`} opacity={0.95}
            />
            <polygon
              points={`${cx},${cy + (r - 12)} ${cx - 7},${cy - 11} ${cx + 7},${cy - 11}`}
              className="hidden dark:block" fill={`url(#${id("blueMetalD")})`} opacity={0.95}
            />
            <circle cx={cx} cy={cy} r={9} className="dark:hidden" fill={`url(#${id("hubL")})`} stroke="rgba(0,0,0,0.15)" strokeWidth={1.2}/>
            <circle cx={cx} cy={cy} r={9} className="hidden dark:block" fill={`url(#${id("hubD")})`} stroke="rgba(255,255,255,0.20)" strokeWidth={1.2}/>
          </g>
        </g>
      </svg>
    </div>
  );
};
