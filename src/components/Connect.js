import { useEffect } from "react";

export default function Connect() {
  useEffect(() => {
    if (window.feather) {
      window.feather.replace(); // load feather icons after render
    }
  }, []);

  return (
    <section className="py-16 text-center bg-white">
      <h2 className="text-3xl font-bold text-purple-700 mb-4 font-epilogue">Connect</h2>
      <div className="flex justify-center gap-10 mt-6">
        {/* LinkedIn */}
        <a
          href="https://www.linkedin.com/in/tejas-raut/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-purple-700 transition"
        >
          <i data-feather="linkedin" className="w-8 h-8"></i>
        </a>

        {/* GitHub */}
        <a
          href="https://github.com/rautte/rautte.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-800 hover:text-purple-700 transition"
        >
          <i data-feather="github" className="w-8 h-8"></i>
        </a>

        {/* Email */}
        <a
          href="mailto:tjsrt@outlook.com"
          className="text-red-600 hover:text-purple-700 transition"
        >
          <i data-feather="mail" className="w-8 h-8"></i>
        </a>
      </div>
    </section>
  );
}
