import React from "react";

const TicTacToeSVG = () => {
  const handleDownload = () => {
    const svgElement = document.getElementById("ttt");
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);

    // Create blob
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // Create hidden link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = "tictactoe.svg";
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
        id="ttt"
        xmlns="http://www.w3.org/2000/svg"
        width="300"
        height="300"
        viewBox="0 0 300 300"
      >
        {/* board frame */}
        <rect x="20" y="0" width="120" height="120" rx="12" fill="transparent" />

        {/* grid */}
        <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="4">
            {/* verticals */}
            <line x1="60" y1="12" x2="60" y2="108" />
            <line x1="100" y1="12" x2="100" y2="108" />
            {/* horizontals */}
            <line x1="28" y1="40" x2="132" y2="40" />
            <line x1="28" y1="80" x2="132" y2="80" />
        </g>

        {/* Marks (centered in each 40×40 cell) */}
        <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
            {/* 1) X @ row 2, col 3 → (120,60) */}
            <g className="ttt-x x1" stroke="#F87171">
            <line x1="113" y1="53" x2="127" y2="67" />
            <line x1="127" y1="53" x2="113" y2="67" />
            </g>

            {/* 2) O @ row 2, col 2 → (80,60) */}
            <circle className="ttt-o o1" cx="80" cy="60" r="7" fill="none" stroke="#34D399" />

            {/* 3) X @ row 1, col 1 → (40,20) */}
            <g className="ttt-x x2" stroke="#F87171">
            <line x1="33" y1="13" x2="47" y2="27" />
            <line x1="47" y1="13" x2="33" y2="27" />
            </g>

            {/* 4) O @ row 3, col 1 → (40,100) */}
            <circle className="ttt-o o2" cx="40" cy="100" r="7" fill="none" stroke="#34D399" />

            {/* 5) X @ row 1, col 3 → (120,20) */}
            <g className="ttt-x x3" stroke="#F87171">
            <line x1="113" y1="13"  x2="127" y2="27" />
            <line x1="127" y1="13"  x2="113" y2="27" />
            </g>

            {/* 6) O @ row 3, col 3 → (120,100) */}
            <circle className="ttt-o o3" cx="120" cy="100" r="7" fill="none" stroke="#34D399" />

            {/* 7) X @ row 1, col 2 → (80,20) */}
            <g className="ttt-x x4" stroke="#F87171">
            <line x1="73" y1="13" x2="87" y2="27" />
            <line x1="87" y1="13" x2="73" y2="27" />
            </g>
        </g>

        {/* Win strike: top row (y = 20) from left to right */}
        <line
            className="ttt-strike"
            x1="28" y1="20" x2="132" y2="20"
            stroke="#5c5c5cff" strokeWidth="4" strokeLinecap="round"
        />

        <style>{`
            /* Scope */
            #ttt .ttt-x, #ttt .ttt-o, #ttt .ttt-strike { opacity: 0; }

            /* One animation per mark, cumulative visibility */
            #ttt .x1 { animation: ttt_x1 5s linear infinite both; }
            #ttt .o1 { animation: ttt_o1 5s linear infinite both; }
            #ttt .x2 { animation: ttt_x2 5s linear infinite both; }
            #ttt .o2 { animation: ttt_o2 5s linear infinite both; }
            #ttt .x3 { animation: ttt_x3 5s linear infinite both; }
            #ttt .o3 { animation: ttt_o3 5s linear infinite both; }
            #ttt .x4 { animation: ttt_x4 5s linear infinite both; }
            #ttt .ttt-strike { animation: ttt_strike 5s linear infinite both; }

            /* Timeline (same order you wanted)
            0–10%  x1
            12–22% o1
            24–34% x2
            36–46% o2
            48–58% x3
            60–70% o3
            72–84% x4
            86–98% strike
            100%   clear */

            /* Each mark: appear at its start and STAY visible until 98%, then clear at 100% */
            @keyframes ttt_x1     { 0%,  1.99%{opacity:0}  2%, 98%{opacity:1}  100%{opacity:0} }
            @keyframes ttt_o1     { 0%, 11.99%{opacity:0} 12%, 98%{opacity:1} 100%{opacity:0} }
            @keyframes ttt_x2     { 0%, 23.99%{opacity:0} 24%, 98%{opacity:1} 100%{opacity:0} }
            @keyframes ttt_o2     { 0%, 35.99%{opacity:0} 36%, 98%{opacity:1} 100%{opacity:0} }
            @keyframes ttt_x3     { 0%, 47.99%{opacity:0} 48%, 98%{opacity:1} 100%{opacity:0} }
            @keyframes ttt_o3     { 0%, 59.99%{opacity:0} 60%, 98%{opacity:1} 100%{opacity:0} }
            @keyframes ttt_x4     { 0%, 71.99%{opacity:0} 72%, 98%{opacity:1} 100%{opacity:0} }

            /* Strike appears near the end, then everything clears */
            @keyframes ttt_strike { 0%, 85.99%{opacity:0} 86%, 98%{opacity:1} 100%{opacity:0} }
        `}</style>
      </svg>
    </div>
  );
};

export default TicTacToeSVG;
