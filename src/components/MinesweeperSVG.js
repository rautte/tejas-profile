// src/components/MinesweeperSVG.js
import React from "react";

const MinesweeperSVG = () => {
  const handleDownload = () => {
    const svgElement = document.getElementById("ms-svg");
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "minesweeper.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div
      onDoubleClick={handleDownload}
      title="Double click to download SVG"
      style={{ cursor: "pointer", display: "inline-block" }}
    >
      <svg
        id="ms-svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 160"
        className="w-40 h-40 mx-auto block"
      >
        <defs>
        {/* These colors adapt to theme by reading currentColor and HSL vars */}
        <linearGradient id="msGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(265 90% 60%)" />
            <stop offset="100%" stopColor="hsl(265 85% 50%)" />
        </linearGradient>
        </defs>

        {/* Disc */}
        <circle
        cx="80"
        cy="80"
        r="64"
        fill="#9984ac71"
        stroke="currentColor"
        className="text-gray-500 dark:text-gray-500"
        strokeWidth="6"
        strokeOpacity="0.5"
        />
        {/* crosshair */}
        <g stroke="white" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round">
        <line x1="80" y1="30" x2="80" y2="130">
            <animate attributeName="y1" values="26;30;26" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="y2" values="134;130;134" dur="2.4s" repeatCount="indefinite" />
        </line>
        <line x1="30" y1="80" x2="130" y2="80">
            <animate attributeName="x1" values="26;30;26" dur="2s" repeatCount="indefinite" />
            <animate attributeName="x2" values="134;130;134" dur="2s" repeatCount="indefinite" />
        </line>
        </g>
        {/* center pip */}
        <circle cx="80" cy="80" r="11" fill="hsl(160 70% 45%)">
        <animate
            attributeName="r"
            values="9;12;9"
            dur="1.8s"
            repeatCount="indefinite"
        />
        </circle>
        {/* spinner “fuse” */}
        <g stroke="red" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round" transform="rotate(15 80 80)">
        {Array.from({ length: 4 }).map((_, i) => {
            const a = i * 90;
            const r1 = 30, r2 = 55;
            const x1 = 80 + r1 * Math.cos((a * Math.PI) / 180);
            const y1 = 80 + r1 * Math.sin((a * Math.PI) / 180);
            const x2 = 80 + r2 * Math.cos((a * Math.PI) / 180);
            const y2 = 80 + r2 * Math.sin((a * Math.PI) / 180);
            return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}>
                <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 80 80`}
                to={`360 80 80`}
                dur="6s"
                repeatCount="indefinite"
                />
            </line>
            );
        })}
        </g>
      </svg>
    </div>
  );
};

export default MinesweeperSVG;