import React, { useMemo, useState, useEffect } from "react";
import { Board, emptyBoard, HUMAN, AI, bestMove, isFull } from "lib/tictactoe";

type TicTacToeWebProps = {
  onRegisterReset?: (fn: () => void) => void;
  showInternalReset?: boolean; // default false when wrapped
};

type CellProps = {
  value: 0 | 1 | 2;
  onClick?: () => void;
  disabled?: boolean;
};

function CellView({ value, onClick, disabled }: CellProps) {
  // Each cell gets a neutral bg + ring that adapts to theme
  // The mark color comes from currentColor via className below
  const markClass =
    value === HUMAN
      ? "text-emerald-600 dark:text-emerald-400"
      : value === AI
      ? "text-rose-500 dark:text-rose-300"
      : "text-transparent";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        relative aspect-square rounded-xl
        bg-gray-100 hover:bg-gray-200
        dark:bg-gray-800/60 dark:hover:bg-gray-800
        ring-1 ring-gray-200 hover:ring-purple-400/40
        dark:ring-white/10
        transition
        flex items-center justify-center
      "
    >
      {/* Mark (uses currentColor) */}
      <svg viewBox="0 0 100 100" className={`w-2/3 h-2/3 ${markClass}`}>
        {value === HUMAN && (
          <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="10" fill="none" />
        )}
        {value === AI && (
          <>
            <line x1="30" y1="30" x2="70" y2="70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
            <line x1="70" y1="30" x2="30" y2="70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}

export default function TicTacToeWeb({ onRegisterReset, showInternalReset = false }: TicTacToeWebProps) {
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [turn, setTurn] = useState<0 | 1 | 2>(HUMAN);
  const [strike, setStrike] = useState<null | "r0" | "r1" | "r2" | "c0" | "c1" | "c2" | "d0" | "d1">(null);
  const [over, setOver] = useState(false);

  // NEW: who starts this game? null means “not chosen yet”
  const [starter, setStarter] = useState<null | "HUMAN" | "AI">(null);

  // (optional) winner message
  const winnerText = (() => {
    if (!over) return "";
    if (!strike) return "Draw";
    // If a strike exists, last mover is the winner.
    // turn is whose turn it WOULD be, so previous player made the winning move.
    const lastPlayer = turn === HUMAN ? AI : HUMAN;
    return lastPlayer === HUMAN ? "You win!" : "AI wins!";
  })();

  // Compute strike when game ends
  useEffect(() => {
    const w = [
      { k: "r0" as const, cells: [[0,0],[0,1],[0,2]] },
      { k: "r1" as const, cells: [[1,0],[1,1],[1,2]] },
      { k: "r2" as const, cells: [[2,0],[2,1],[2,2]] },
      { k: "c0" as const, cells: [[0,0],[1,0],[2,0]] },
      { k: "c1" as const, cells: [[0,1],[1,1],[2,1]] },
      { k: "c2" as const, cells: [[0,2],[1,2],[2,2]] },
      { k: "d0" as const, cells: [[0,0],[1,1],[2,2]] },
      { k: "d1" as const, cells: [[0,2],[1,1],[2,0]] },
    ];
    for (const { k, cells } of w) {
      const v = board[cells[0][0]][cells[0][1]];
      if (v !== 0 && cells.every(([r,c]) => board[r][c] === v)) {
        setStrike(k);
        setOver(true);
        return;
      }
    }
    if (isFull(board)) {
      setStrike(null);
      setOver(true);
    }
  }, [board]);

  // AI move after human
  useEffect(() => {
    if (over || turn !== AI) return;
    const move = bestMove(board);
    if (!move) return;
    const [r, c] = move;
    const t = setTimeout(() => {
      setBoard(prev => {
        if (prev[r][c] !== 0) return prev;
        const next = prev.map(row => [...row]) as Board;
        next[r][c] = AI;
        return next;
      });
      setTurn(HUMAN);
    }, 250);
    return () => clearTimeout(t);
  }, [turn, over, board]);

  const onCellClick = (r: number, c: number) => {
    if (over || turn !== HUMAN || board[r][c] !== 0) return;
    setBoard(prev => {
      const next = prev.map(row => [...row]) as Board;
      next[r][c] = HUMAN;
      return next;
    });
    setTurn(AI);
  };

  const reset = () => {
    // Return to chooser screen before each new game
    setBoard(emptyBoard());
    setStrike(null);
    setOver(false);
    setStarter(null);     // ← show chooser again
    setTurn(HUMAN);       // default, will be overwritten by chooser
  };

  useEffect(() => {
    if (onRegisterReset) onRegisterReset(reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onRegisterReset]);

  // Strike overlay SVG (uses currentColor + theme class below)
  const Strike = useMemo(() => {
    if (!strike) return null;
    const map: Record<string, { x1:number,y1:number,x2:number,y2:number }> = {
      r0:{x1:0,y1:50,x2:300,y2:50}, r1:{x1:0,y1:150,x2:300,y2:150}, r2:{x1:0,y1:250,x2:300,y2:250},
      c0:{x1:50,y1:0,x2:50,y2:300}, c1:{x1:150,y1:0,x2:150,y2:300}, c2:{x1:250,y1:0,x2:250,y2:300},
      d0:{x1:20,y1:20,x2:280,y2:280}, d1:{x1:280,y1:20,x2:20,y2:280},
    };
    const s = map[strike];
    return (
      <svg viewBox="0 0 300 300" className="absolute inset-0 pointer-events-none text-gray-600/60 dark:text-gray-300/60">
        <line {...s} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }, [strike]);

  return (
    <div className="w-full flex justify-center">
        {/* page stack */}
        <div className="w-full max-w-md mx-auto flex flex-col gap-8">

        {/* 1) Starter chooser — width matches board, centered */}
        {starter === null && (
            <div className="w-full rounded-2xl bg-gray-100 dark:bg-gray-800 ring-1 ring-black/10 dark:ring-white/10 p-5">
            <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100">
                Who starts first?
            </div>
            <div className="grid grid-cols-2 gap-3">
                <button
                onClick={() => {
                    setBoard(emptyBoard());
                    setStrike(null);
                    setOver(false);
                    setStarter("HUMAN");
                    setTurn(HUMAN);
                }}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                >
                Player starts
                </button>
                <button
                onClick={() => {
                    setBoard(emptyBoard());
                    setStrike(null);
                    setOver(false);
                    setStarter("AI");
                    setTurn(AI);
                }}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white shadow hover:opacity-90"
                >
                AI starts
                </button>
            </div>
            </div>
        )}

        {/* 2) Board card */}
        <div className={`w-full rounded-2xl p-4 ring-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]
                        ${starter === null ? "opacity-30 pointer-events-none" : ""}
                        bg-gray-200 dark:bg-gray-900 ring-black/10 dark:ring-white/10`}>
            <div className="relative grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => {
                    const r = Math.floor(i / 3);
                    const c = i % 3;
                    return (
                    <React.Fragment key={`cell-${r}-${c}`}>
                        <CellView
                        value={board[r][c]}
                        disabled={over || starter === null}
                        onClick={() => onCellClick(r, c)}
                        />
                    </React.Fragment>
                    );
                })}
                {Strike}
            </div>
        </div>

        {/* 3) Controls row */}
        <div className="w-full flex items-center justify-between">
            <button
                onClick={reset}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
            >
                Reset
            </button>

            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {starter === null
                ? "Choose who starts"
                : over
                ? winnerText
                : (turn === HUMAN ? "Your turn" : "AI thinking…")}
            </div>
        </div>

        </div>
    </div>
    );
}




// import React, { useMemo, useState, useEffect } from "react";
// import { Board, emptyBoard, HUMAN, AI, bestMove, isFull } from "../lib/tictactoe";

// type CellProps = {
//   value: 0 | 1 | 2;
//   onClick?: () => void;
//   disabled?: boolean;
// };

// function CellView({ value, onClick, disabled }: CellProps) {
//   // Each cell gets a neutral bg + ring that adapts to theme
//   // The mark color comes from currentColor via className below
//   const markClass =
//     value === HUMAN
//       ? "text-emerald-600 dark:text-emerald-400"
//       : value === AI
//       ? "text-rose-500 dark:text-rose-300"
//       : "text-transparent";

//   return (
//     <button
//       onClick={onClick}
//       disabled={disabled}
//       className="
//         relative aspect-square rounded-xl
//         bg-gray-100 hover:bg-gray-200
//         dark:bg-gray-800/60 dark:hover:bg-gray-800
//         ring-1 ring-gray-200 hover:ring-purple-400/40
//         dark:ring-white/10
//         transition
//         flex items-center justify-center
//       "
//     >
//       {/* Mark (uses currentColor) */}
//       <svg viewBox="0 0 100 100" className={`w-2/3 h-2/3 ${markClass}`}>
//         {value === HUMAN && (
//           <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="10" fill="none" />
//         )}
//         {value === AI && (
//           <>
//             <line x1="30" y1="30" x2="70" y2="70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
//             <line x1="70" y1="30" x2="30" y2="70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
//           </>
//         )}
//       </svg>
//     </button>
//   );
// }

// export default function TicTacToeWeb() {
//   const [board, setBoard] = useState<Board>(() => emptyBoard());
//   const [turn, setTurn] = useState<0 | 1 | 2>(HUMAN);
//   const [strike, setStrike] = useState<null | "r0" | "r1" | "r2" | "c0" | "c1" | "c2" | "d0" | "d1">(null);
//   const [over, setOver] = useState(false);

//   // NEW: who starts this game? null means “not chosen yet”
//   const [starter, setStarter] = useState<null | "HUMAN" | "AI">(null);

//   // (optional) winner message
//   const winnerText = (() => {
//     if (!over) return "";
//     if (!strike) return "Draw";
//     // If a strike exists, last mover is the winner.
//     // turn is whose turn it WOULD be, so previous player made the winning move.
//     const lastPlayer = turn === HUMAN ? AI : HUMAN;
//     return lastPlayer === HUMAN ? "You win!" : "AI wins!";
//   })();

//   // Compute strike when game ends
//   useEffect(() => {
//     const w = [
//       { k: "r0" as const, cells: [[0,0],[0,1],[0,2]] },
//       { k: "r1" as const, cells: [[1,0],[1,1],[1,2]] },
//       { k: "r2" as const, cells: [[2,0],[2,1],[2,2]] },
//       { k: "c0" as const, cells: [[0,0],[1,0],[2,0]] },
//       { k: "c1" as const, cells: [[0,1],[1,1],[2,1]] },
//       { k: "c2" as const, cells: [[0,2],[1,2],[2,2]] },
//       { k: "d0" as const, cells: [[0,0],[1,1],[2,2]] },
//       { k: "d1" as const, cells: [[0,2],[1,1],[2,0]] },
//     ];
//     for (const { k, cells } of w) {
//       const v = board[cells[0][0]][cells[0][1]];
//       if (v !== 0 && cells.every(([r,c]) => board[r][c] === v)) {
//         setStrike(k);
//         setOver(true);
//         return;
//       }
//     }
//     if (isFull(board)) {
//       setStrike(null);
//       setOver(true);
//     }
//   }, [board]);

//   // AI move after human
//   useEffect(() => {
//     if (over || turn !== AI) return;
//     const move = bestMove(board);
//     if (!move) return;
//     const [r, c] = move;
//     const t = setTimeout(() => {
//       setBoard(prev => {
//         if (prev[r][c] !== 0) return prev;
//         const next = prev.map(row => [...row]) as Board;
//         next[r][c] = AI;
//         return next;
//       });
//       setTurn(HUMAN);
//     }, 250);
//     return () => clearTimeout(t);
//   }, [turn, over, board]);

//   const onCellClick = (r: number, c: number) => {
//     if (over || turn !== HUMAN || board[r][c] !== 0) return;
//     setBoard(prev => {
//       const next = prev.map(row => [...row]) as Board;
//       next[r][c] = HUMAN;
//       return next;
//     });
//     setTurn(AI);
//   };

//   const reset = () => {
//     // Return to chooser screen before each new game
//     setBoard(emptyBoard());
//     setStrike(null);
//     setOver(false);
//     setStarter(null);     // ← show chooser again
//     setTurn(HUMAN);       // default, will be overwritten by chooser
//   };

//   // Strike overlay SVG (uses currentColor + theme class below)
//   const Strike = useMemo(() => {
//     if (!strike) return null;
//     const map: Record<string, { x1:number,y1:number,x2:number,y2:number }> = {
//       r0:{x1:0,y1:50,x2:300,y2:50}, r1:{x1:0,y1:150,x2:300,y2:150}, r2:{x1:0,y1:250,x2:300,y2:250},
//       c0:{x1:50,y1:0,x2:50,y2:300}, c1:{x1:150,y1:0,x2:150,y2:300}, c2:{x1:250,y1:0,x2:250,y2:300},
//       d0:{x1:20,y1:20,x2:280,y2:280}, d1:{x1:280,y1:20,x2:20,y2:280},
//     };
//     const s = map[strike];
//     return (
//       <svg viewBox="0 0 300 300" className="absolute inset-0 pointer-events-none text-purple-600 dark:text-purple-300">
//         <line {...s} stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
//       </svg>
//     );
//   }, [strike]);

//   return (
//     <div className="w-full max-w-sm mx-auto text-gray-800 dark:text-gray-200">
//         {/* STARTER CHOOSER (shown before each game) */}
//         {starter === null && (
//         <div className="mb-6 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 ring-1 ring-black/10 dark:ring-white/10">
//             <div className="mb-3 font-semibold text-gray-700 dark:text-gray-200">
//             Who starts first?
//             </div>
//             <div className="flex gap-3">
//             <button
//                 onClick={() => {
//                 setBoard(emptyBoard());
//                 setStrike(null);
//                 setOver(false);
//                 setStarter("HUMAN");
//                 setTurn(HUMAN); // you go first
//                 }}
//                 className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
//             >
//                 Player starts
//             </button>
//             <button
//                 onClick={() => {
//                 setBoard(emptyBoard());
//                 setStrike(null);
//                 setOver(false);
//                 setStarter("AI");
//                 setTurn(AI); // AI goes first
//                 }}
//                 className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white shadow hover:opacity-90"
//             >
//                 AI starts
//             </button>
//             </div>
//         </div>
//         )}

//         {/* GRID (hidden until starter chosen) */}
//         <div className={starter === null ? "pointer-events-none opacity-40" : ""}>
//             <div
//                 className="
//                 relative grid grid-cols-3 gap-3 p-3 rounded-2xl
//                 bg-white/70 ring-1 ring-gray-200
//                 dark:bg-gray-900 dark:ring-white/10
//                 shadow-lg
//                 "
//                 style={{ width: 300 }}
//             >
//                 {Array.from({ length: 9 }).map((_, i) => {
//                     const r = Math.floor(i / 3);
//                     const c = i % 3;
//                     return (
//                     <React.Fragment key={`cell-${r}-${c}`}>
//                         <CellView
//                         value={board[r][c]}
//                         disabled={over || starter === null}
//                         onClick={() => onCellClick(r, c)}
//                         />
//                     </React.Fragment>
//                     );
//                 })}
//                 {Strike}
//             </div>
//         </div>

//         <div className="mt-4 flex items-center justify-between">
//             <button
//             onClick={reset}
//             className="
//                 px-4 py-2 rounded-lg
//                 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white
//                 dark:from-purple-600 dark:via-purple-700 dark:to-purple-800
//                 shadow hover:opacity-90
//             "
//             >
//             Reset
//             </button>
//             <div className="mb-3 flex justify-start text-left -ml-6 font-semibold text-base text-gray-700 dark:text-gray-300">
//                 {starter === null
//                     ? "Choose who starts"
//                     : over
//                     ? winnerText
//                     : (turn === HUMAN ? "Your turn" : "AI thinking…")}
//             </div>
//         </div>
//     </div>
//   );
// }