import logo from './logo.svg';
import './App.css';
import Hero from "./components/Hero";
import About from "./components/About";
import Projects from "./components/Projects";
import Fun from "./components/Fun";
import Contact from "./components/Contact";

function App() {
  return (
    <div className="bg-gradient-to-br from-purple-100 to-blue-100 min-h-screen font-sans">
      <Hero />
      <About />
      <Projects />
      <Fun />         {/* 👈 New section for your games */}
      <Contact />
    </div>
  );
}

export default App;

