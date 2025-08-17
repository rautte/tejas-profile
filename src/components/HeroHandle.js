// src/components/HeroHandle.js

import React from "react";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";

/**
 * Abstract, glassy "plateau" handle:
 * - No outer rect, ends meet the hero bottom exactly.
 * - Light/Dark handled by dual gradients + Tailwind class swap.
 * - Reverses vertically when collapsed.
 */
export default function HeroHandle({
  collapsed,
  onToggle,
  placement = "bottom",
  width = 140,
  height = 28,
  showIcon = false, // set true if you want the chevron back
}) {
  const pos =
    placement === "bottom"
      ? "absolute left-1/2 -translate-x-1/2 bottom-1.5"  // 1.5 * 4px = 6px
      : "sticky top-1 z-30 flex justify-center pointer-events-none";

  return (
    // <div className={pos} style={{ height: placement === "top" ? 0 : height + 6 }}>
    <div className={`${pos} pointer-events-none`} style={{ height: placement === "top" ? 0 : height - 2 }}>
      <button
        onClick={onToggle}
        className="group relative pointer-events-auto p-0 bg-transparent border-0 focus:outline-none"
        aria-label={collapsed ? "Show header" : "Hide header"}
        title={collapsed ? "Show header" : "Hide header"}
        style={{ width, height }}
      >
        <svg
          width={width}
          height={height}
          viewBox="0 0 100 30"
          className={`absolute inset-0 transition-transform duration-300 ${
            collapsed ? "scale-y-[-1]" : "scale-y-[1]"
          }`}
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
          aria-hidden
        >
          <defs>
            {/* ---------- LIGHT THEME GRADIENTS ---------- */}
            <linearGradient id="mountain-fill-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0, 0, 0, 0.61)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0.43)" />
            </linearGradient>

            <linearGradient id="ridge-stroke-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(124, 124, 124, 0.9)" />
              <stop offset="100%" stopColor="rgba(52, 50, 50, 1)" />
            </linearGradient>

            {/* ---------- DARK THEME GRADIENTS ---------- */}
            <linearGradient id="mountain-fill-dark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.52)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.28)" />
            </linearGradient>

            <linearGradient id="ridge-stroke-dark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(119, 51, 246, 0.99)" />
              <stop offset="100%" stopColor="rgba(134, 36, 238, 0.53)" />
            </linearGradient>

            {/* Hover glow (unchanged) */}
            <filter id="hover-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#9333ea" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* MAIN SHAPE (ends touch baseline y=30; gentle slopes; soft plateau) */}
          <path
            d="
              M 0 30
              L 0 26
              C 12 26, 24 25.5, 36 24.0
              C 42 23.3, 46 21.8, 48.5 20.5
              L 51.5 20.5
              C 54 21.8, 58 23.3, 64 24.0
              C 76 25.5, 88 26, 100 26
              L 100 30
              Z
            "
            className="fill-[url(#mountain-fill-light)] dark:fill-[url(#mountain-fill-dark)] transition-all duration-200"
          />

          {/* RIDGE STROKE (subtle) */}
          <path
            d="
              M 0 26
              C 12 26, 24 25.5, 36 24.0
              C 42 23.3, 46 21.8, 48.5 20.5
              L 51.5 20.5
              C 54 21.8, 58 23.3, 64 24.0
              C 76 25.5, 88 26, 100 26
            "
            fill="none"
            className="stroke-[url(#ridge-stroke-light)] dark:stroke-[url(#ridge-stroke-dark)] opacity-70"
            strokeWidth="0.9"
          />

          {/* HOVER GLOW (soft) */}
          <g className="opacity-0 transition-opacity duration-200 group-hover:opacity-100" filter="url(#hover-glow)">
            <path
              d="
                M 0 30
                L 0 26
                C 12 26, 24 25.5, 36 24.0
                C 42 23.3, 46 21.8, 48.5 20.5
                L 51.5 20.5
                C 54 21.8, 58 23.3, 64 24.0
                C 76 25.5, 88 26, 100 26
                L 100 30
                Z
              "
              fill="rgba(147, 51, 234, 0.10)"
            />
          </g>
        </svg>

        {showIcon && (
          <span className="relative z-10 grid place-items-center w-full h-full pointer-events-none">
            {collapsed ? (
              <FaChevronDown className="text-[10px] opacity-85 text-gray-900 dark:text-gray-100" />
            ) : (
              <FaChevronUp className="text-[10px] opacity-85 text-gray-900 dark:text-gray-100" />
            )}
          </span>
        )}
      </button>
    </div>
  );
}
