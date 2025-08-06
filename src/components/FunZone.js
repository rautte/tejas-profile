import { FaPlay, FaGithub, FaDownload } from 'react-icons/fa';
import { GiConsoleController } from 'react-icons/gi';

export default function Fun() {
  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Title + Underline */}
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <GiConsoleController className="text-3xl text-purple-700 dark:text-purple-300" />
          Fun Zone
        </h2>
        <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]" />
      </div>

      {/* Subtitle */}
      <p className="text-gray-600 dark:text-gray-300 px-6 mb-10 font-epilogue">
        If you’ve reached this far, take a break and enjoy some simple games I built just for fun!
      </p>

      {/* Game Cards */}
      <div className="flex flex-wrap justify-center gap-28 px-4 h-96">
        {/* Minesweeper */}
        <div className="bg-gray-100 p-8 rounded-xl shadow-md w-72">
          <h3 className="text-xl font-semibold mb-6">Minesweeper</h3>
          <img
            src="./images/minesweeper_demo.gif"
            alt="Minesweeper Demo"
            className="rounded mb-8 object-contain h-42 w-full"
          />
          <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
            {/* ▶️ Play Game */}
            <a
              href="/games/minesweeper.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all flex-1 min-w-[30%] justify-center
                bg-gradient-to-r from-green-500 via-emerald-600 to-green-700 hover:opacity-90"
            >
              <FaPlay />
              Play
            </a>

            {/* 📁 GitHub */}
            <a
              href="https://github.com/rautte/Minesweeper"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all flex-1 min-w-[30%] justify-center
                bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:opacity-90"
            >
              <FaGithub />
              GitHub
            </a>

            {/* ⬇️ Download */}
            <a
              href="./downloads/Minesweeper.zip"
              download
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all flex-1 min-w-[30%] justify-center
                bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:opacity-90"
            >
              <FaDownload />
              Code
            </a>
          </div>
        </div>

        {/* Tic Tac Toe (AI - Pygame) */}
        <div className="bg-gray-100 p-8 rounded-xl shadow-md w-72">
          <h3 className="text-xl font-semibold mb-6">Tic Tac Toe (AI)</h3>
          <img
            src="./images/tictactoe_demo.gif"
            alt="Tic Tac Toe Demo"
            className="rounded mb-8 object-contain h-42 w-full"
          />
          <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
            {/* ▶️ Play Game */}
            <a
              href="./games/tictactoe-ai.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all flex-1 min-w-[30%] justify-center
                bg-gradient-to-r from-green-500 via-emerald-600 to-green-700 hover:opacity-90"
            >
              <FaPlay />
              Play
            </a>

            {/* 📁 GitHub */}
            <a
              href="https://github.com/rautte/TicTacToe_AI"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all flex-1 min-w-[30%] justify-center
                bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:opacity-90"
            >
              <FaGithub />
              GitHub
            </a>

            {/* ⬇️ Download */}
            <a
              href="./downloads/TicTacToe_AI.zip"
              download
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all flex-1 min-w-[30%] justify-center
                bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:opacity-90"
            >
              <FaDownload />
              Code
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// export default function Fun() {
//   return (
//     <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
//       {/* Title + Underline */}
//       <div className="text-left px-6 mb-10">
//         <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md">
//           🎮 Fun Zone
//         </h2>
//         <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]" />
//       </div>

//       {/* Subtitle */}
//       <p className="text-gray-600 dark:text-gray-300 px-6 mb-10 font-epilogue">
//         If you’ve reached this far, take a break and enjoy some simple games I built just for fun!
//       </p>

//       {/* Game Cards */}
//       <div className="flex flex-wrap justify-center gap-28 px-4">

//         {/* Minesweeper */}
//         <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
//           <h3 className="text-xl font-semibold mb-4">Minesweeper</h3>
//           <a
//             href="/games/minesweeper.html"
//             target="_blank"
//             rel="noopener noreferrer"
//             className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
//           >
//             ▶️ Play Game
//           </a>
//         </div>

//         {/* Tic Tac Toe (AI - Pygame) */}
//         <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
//           <h3 className="text-xl font-semibold mb-2">Tic Tac Toe (AI)</h3>
//           <img
//             src="./images/tictactoe_demo.gif"
//             alt="Tic Tac Toe Demo"
//             className="rounded mb-4"
//           />
//           <div className="space-y-2">
//             <a
//               href="./games/tictactoe-ai.html"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="block w-full bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
//             >
//               ▶️ Play Game
//             </a>
//             <a
//               href="https://github.com/rautte/TicTacToe_AI"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="block w-full bg-gray-800 text-white px-4 py-2 rounded-lg shadow hover:bg-gray-900 transition"
//             >
//               📁 View on GitHub
//             </a>
//             <a
//               href="./downloads/TicTacToe_AI.zip"
//               download
//               className="block w-full bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 transition"
//             >
//               ⬇️ Download Game Code
//             </a>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }

