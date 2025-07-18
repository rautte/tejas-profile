export default function Fun() {
    return (
      <section className="py-16 bg-white text-center">
        <h2 className="text-3xl font-bold mb-4 text-purple-700">🎮 Fun Zone</h2>
        <p className="mb-8 text-gray-600">Play some simple games I've coded just for fun!</p>
  
        <div className="flex flex-wrap justify-center gap-8 px-4">
          <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
            <h3 className="text-xl font-semibold mb-2">Tic Tac Toe</h3>
            <a
              href="/games/tic-tac-toe.html"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Game
            </a>
          </div>
  
          <div className="bg-gray-100 p-6 rounded-xl shadow-md w-72">
            <h3 className="text-xl font-semibold mb-2">Minesweeper</h3>
            <a
              href="/games/minesweeper.html"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Game
            </a>
          </div>
        </div>
      </section>
    );
  }
  