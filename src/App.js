import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Hi, I'm Tejas 👋</h1>
        <p className="text-lg mb-4">Welcome to my personal site!</p>
        <a
          href="https://github.com/rautte"
          target="_blank"
          rel="noreferrer"
          className="inline-block bg-white text-purple-700 px-4 py-2 rounded-full shadow hover:bg-purple-100 transition"
        >
          Visit my GitHub
        </a>
      </div>
    </div>
  );
}

export default App;

