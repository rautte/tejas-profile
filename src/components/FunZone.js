export default function Fun() {
  return (
    <section className="py-16 bg-white text-center">
      <h2 className="text-3xl font-bold mb-4 text-purple-700 font-epilogue">🎮 Fun Zone</h2>
      <p className="mb-10 text-gray-600 font-epilogue">If you've reached this far, you deserve to play some simple games I've coded just for fun!</p>

      <div className="flex flex-wrap justify-center gap-8 px-4">

        {/* Minesweeper */}
        <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
          <h3 className="text-xl font-semibold mb-4">Minesweeper</h3>
          <a
            href="/games/minesweeper.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
          >
            ▶️ Play Game
          </a>
        </div>

        {/* Tic Tac Toe (AI - Pygame) */}
        <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
          <h3 className="text-xl font-semibold mb-2">Tic Tac Toe (AI)</h3>
          <img
            src="./images/tictactoe_demo.gif"
            alt="Tic Tac Toe Demo"
            className="rounded mb-4"
          />
          <div className="space-y-2">
            <a
              href="./games/tictactoe-ai.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
            >
              ▶️ Play Game
            </a>
            <a
              href="https://github.com/rautte/TicTacToe_AI"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-800 text-white px-4 py-2 rounded-lg shadow hover:bg-gray-900 transition"
            >
              📁 View on GitHub
            </a>
            <a
              href="./downloads/TicTacToe_AI.zip"
              download
              className="block w-full bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 transition"
            >
              ⬇️ Download Game Code
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}


// export default function Fun() {
//   return (
//     <section className="py-16 bg-white text-center">
//       <h2 className="text-3xl font-bold mb-4 text-purple-700">🎮 Fun Zone</h2>
//       <p className="mb-8 text-gray-600">Play some simple games I've coded just for fun!</p>

//       <div className="flex flex-wrap justify-center gap-8 px-4">

//         {/* Minesweeper */}
//         <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
//           <h3 className="text-xl font-semibold mb-2">Minesweeper</h3>
//           <a
//             href="/games/minesweeper.html"
//             className="text-blue-600 underline"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Play Game
//           </a>
//         </div>

//         {/* Tic Tac Toe (AI - Pygame) */}
//         <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
//         <h3 className="text-xl font-semibold mb-2">Tic Tac Toe (AI)</h3>
//         <img
//           src="./images/tictactoe_demo.gif"
//           alt="Tic Tac Toe Demo"
//           className="rounded mb-2"
//         />
//         <a
//           href="./games/tictactoe-ai.html"
//           className="text-blue-600 underline block"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Play Game
//         </a>
//         <a
//           href="https://github.com/rautte/TicTacToe_AI"
//           className="text-blue-600 underline block"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           View on GitHub
//         </a>
//         <a
//           href="./downloads/TicTacToe_AI.zip"
//           className="text-blue-600 underline block"
//           download
//         >
//           Download Game Code
//         </a>
//       </div>
//       </div>
//     </section>
//   );
// }

