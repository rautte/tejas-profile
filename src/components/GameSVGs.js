// components/GameSvgs.js

export function MinesweeperSVG({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`w-32 h-32 ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="32" cy="32" r="28" className="fill-purple-200 dark:fill-purple-800" />
      <line x1="32" y1="10" x2="32" y2="54" />
      <line x1="10" y1="32" x2="54" y2="32" />
      <circle cx="32" cy="32" r="6" className="fill-red-500" />
    </svg>
  );
}

export function TicTacToeSVG({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`w-32 h-32 ${className}`}
      viewBox="0 0 64 64"
      stroke="currentColor"
      strokeWidth="3"
    >
      <rect width="64" height="64" rx="8" className="fill-gray-200 dark:fill-gray-700" />
      <line x1="21" y1="5" x2="21" y2="59" />
      <line x1="43" y1="5" x2="43" y2="59" />
      <line x1="5" y1="21" x2="59" y2="21" />
      <line x1="5" y1="43" x2="59" y2="43" />
      <circle cx="32" cy="32" r="8" className="stroke-green-500" />
      <line x1="10" y1="10" x2="20" y2="20" className="stroke-red-500" />
      <line x1="20" y1="10" x2="10" y2="20" className="stroke-red-500" />
    </svg>
  );
}
