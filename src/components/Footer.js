// src/components/Footer.js
import React from "react";
import { FaGithub, FaLinkedin, FaGlobe, FaEnvelope } from "react-icons/fa";

export default function Footer() {
  // X offset from center (px). 0 means centered like today.
  const [xOffset, setXOffset] = React.useState(0);

  const dragState = React.useRef({
    dragging: false,
    startClientX: 0,
    startOffset: 0,
    pillWidth: 0,
  });

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const getBounds = (pillWidth) => {
    // Allow dragging anywhere within viewport, leaving small margins
    const margin = 14; // px from both sides
    const halfViewport = window.innerWidth / 2;

    // With left-1/2 + -translate-x-1/2, the pill is centered.
    // xOffset moves it relative to that center.
    // Ensure pill stays within [margin, viewport - margin].
    const minOffset = -halfViewport + margin + pillWidth / 2;
    const maxOffset = halfViewport - margin - pillWidth / 2;

    return { minOffset, maxOffset };
  };

  const onPointerDown = (e) => {
    // Only start drag if the click is on the pill background,
    // not on links/icons inside it.
    const target = e.target;
    if (target.closest("a")) return;

    const pill = e.currentTarget;
    const rect = pill.getBoundingClientRect();

    dragState.current.dragging = true;
    dragState.current.startClientX = e.clientX;
    dragState.current.startOffset = xOffset;
    dragState.current.pillWidth = rect.width;

    // capture pointer so dragging keeps working even if pointer leaves the pill
    pill.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragState.current.dragging) return;

    const dx = e.clientX - dragState.current.startClientX;
    const next = dragState.current.startOffset + dx;

    const { minOffset, maxOffset } = getBounds(dragState.current.pillWidth);
    setXOffset(clamp(next, minOffset, maxOffset));
  };

  const stopDrag = () => {
    dragState.current.dragging = false;
  };

  // Re-clamp on resize so it never goes out of bounds
  React.useEffect(() => {
    const onResize = () => {
      const pillWidth = dragState.current.pillWidth || 320; // fallback guess
      const { minOffset, maxOffset } = getBounds(pillWidth);
      setXOffset((prev) => clamp(prev, minOffset, maxOffset));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <footer
      className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50"
      style={{ transform: `translateX(calc(-50% + ${xOffset}px))` }}
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
        aria-label="Draggable footer pill"
        role="group"
      >
        <a
          href="https://www.linkedin.com/in/tejas-raut/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-[#0A66C2] transition"
          aria-label="LinkedIn"
        >
          <FaLinkedin size={20} />
        </a>

        <a
          href="https://github.com/rautte/rautte.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition"
          aria-label="GitHub"
        >
          <FaGithub size={20} />
        </a>

        <a
          href="https://rautte.github.io/tejas-profile"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-500 hover:text-green-600 transition"
          aria-label="Portfolio"
        >
          <FaGlobe size={20} />
        </a>

        <a
          href="mailto:raut.tejas@outlook.com"
          className="text-red-400 hover:text-red-500 transition"
          aria-label="Email"
        >
          <FaEnvelope size={20} />
        </a>
      </div>
    </footer>
  );
}
