// src/components/MinesweeperWeb.tsx
import React, { useMemo, useState } from "react";
import {
  Board, makeBoard, reveal, toggleFlag, isWin
} from "lib/minesweeper";

type CellProps = {
  cell: Board[number][number];
  onClick?: () => void;
  onRightClick?: () => void;
  size?: number;
};

function Cell({ cell, onClick, onRightClick, size = 36 }: CellProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onRightClick?.(); }}
      className={`
        relative rounded-lg flex items-center justify-center
        ring-1 ring-black/10 dark:ring-white/10
        transition
        ${cell.revealed
          ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
          : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-900/60 dark:hover:bg-gray-800/70 text-gray-700 dark:text-gray-200"}
      `}
      style={{ width: size, height: size }}
    >
      {!cell.revealed && cell.flagged && <span className="text-red-500">⚑</span>}
      {cell.revealed && (
        cell.mine
          ? <span className="text-red-500">●</span>
          : (cell.count > 0 ? <span className="font-semibold">{cell.count}</span> : null)
      )}
    </button>
  );
}

export default function MinesweeperWeb() {
  const rows = 9, cols = 9, mines = 10;
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [board, setBoard] = useState<Board>(() => makeBoard(rows, cols, mines, seed));
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  const reset = () => {
    const s = Date.now();
    setSeed(s);
    setBoard(makeBoard(rows, cols, mines, s));
    setOver(false);
    setStatus("playing");
  };

  const open = (r: number, c: number) => {
    if (over) return;
    const { board: nb, hitMine } = reveal(board, r, c);
    setBoard(nb);
    if (hitMine) {
      setOver(true);
      setStatus("lost");
    } else if (isWin(nb)) {
      setOver(true);
      setStatus("won");
    }
  };

  const flag = (r: number, c: number) => {
    if (over) return;
    setBoard(toggleFlag(board, r, c));
  };

  const message = useMemo(() => {
    if (status === "won") return "You win!";
    if (status === "lost") return "Boom! You lost.";
    return "Find all mines";
  }, [status]);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-md mx-auto flex flex-col gap-8">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{message}</div>

        <div
            className="inline-grid rounded-2xl p-3 gap-2 bg-gray-200 dark:bg-gray-900 ring-1 ring-black/10 dark:ring-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: rows * cols }).map((_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                return (
                <React.Fragment key={`cell-${r}-${c}`}>
                    <Cell
                    cell={board[r][c]}
                    onClick={() => open(r, c)}
                    onRightClick={() => flag(r, c)}
                    size={36}
                    />
                </React.Fragment>
                );
            })}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
