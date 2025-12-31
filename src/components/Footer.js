// src/components/Footer.js
import React from "react";
import { FaGithub, FaLinkedin, FaGlobe, FaEnvelope } from "react-icons/fa";

import { FOOTER_LINKS, FOOTER_DRAG } from "../data/footer";

const ICONS = {
  linkedin: FaLinkedin,
  github: FaGithub,
  portfolio: FaGlobe,
  email: FaEnvelope,
};

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

function getBounds(pillWidth, marginPx) {
  // With left-1/2 + -translate-x-1/2, the pill is visually centered.
  // xOffset shifts it relative to that center. Keep it inside the viewport.
  const halfViewport = window.innerWidth / 2;

  const minOffset = -halfViewport + marginPx + pillWidth / 2;
  const maxOffset = halfViewport - marginPx - pillWidth / 2;

  return { minOffset, maxOffset };
}

export default function Footer() {
  // X offset from center (px). 0 means centered.
  const [xOffset, setXOffset] = React.useState(FOOTER_DRAG.defaultOffsetPx);

  const dragRef = React.useRef({
    dragging: false,
    startClientX: 0,
    startOffset: 0,
    pillWidth: 0,
  });

  const stopDrag = React.useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const onPointerDown = React.useCallback(
    (e) => {
      // Don’t start a drag when clicking an actual link/icon.
      if (e.target.closest("a")) return;

      const pill = e.currentTarget;
      const rect = pill.getBoundingClientRect();

      dragRef.current.dragging = true;
      dragRef.current.startClientX = e.clientX;
      dragRef.current.startOffset = xOffset;
      dragRef.current.pillWidth = rect.width;

      // Keep pointer events stable even if cursor leaves the pill.
      pill.setPointerCapture?.(e.pointerId);
    },
    [xOffset]
  );

  const onPointerMove = React.useCallback((e) => {
    if (!dragRef.current.dragging) return;

    const dx = e.clientX - dragRef.current.startClientX;
    const nextOffset = dragRef.current.startOffset + dx;

    const { minOffset, maxOffset } = getBounds(
      dragRef.current.pillWidth,
      FOOTER_DRAG.marginPx
    );

    setXOffset(clamp(nextOffset, minOffset, maxOffset));
  }, []);

  // Re-clamp on resize so it never ends up off-screen.
  React.useEffect(() => {
    const onResize = () => {
      const pillWidth = dragRef.current.pillWidth || FOOTER_DRAG.fallbackPillWidthPx;
      const { minOffset, maxOffset } = getBounds(pillWidth, FOOTER_DRAG.marginPx);

      setXOffset((prev) => clamp(prev, minOffset, maxOffset));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <footer
      className="fixed md:block hidden bottom-2 left-1/2 -translate-x-1/2 z-50"
      // combine the base centering with the drag offset
      style={{ transform: `translateX(calc(-50% + ${xOffset}px))` }}
      aria-label="Footer quick links"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        className="
          flex items-center gap-8 px-6 h-10
          rounded-2xl sm:rounded-3xl
          bg-gray-400/40 dark:bg-gray-600/40
          backdrop-blur-md
          border border-white/40 dark:border-white/10
          shadow-[0_8px_30px_rgba(0,0,0,0.12)]
          ring-1 ring-white/30 dark:ring-white/10
          select-none
          cursor-grab active:cursor-grabbing
        "
        role="group"
      >
        {FOOTER_LINKS.map((l) => {
          const Icon = ICONS[l.key];
          return (
            <a
              key={l.key}
              href={l.href}
              target={l.href.startsWith("mailto:") ? undefined : "_blank"}
              rel={l.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
              className={`${l.colorClass} transition`}
              aria-label={l.label}
            >
              <Icon size={20} />
            </a>
          );
        })}
      </div>
    </footer>
  );
}
