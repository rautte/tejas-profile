// components/Resume.js
export default function Resume() {
  return (
    <section className="py-16 px-4 bg-gray-100 text-center">
      <h2 className="text-3xl font-bold text-purple-700 mb-6 font-epilogue">Resume</h2>
      
      <p className="text-gray-700 mb-8 font-epilogue">You can view or download my resume below 👇</p>

      {/* View Resume */}
      <div className="max-w-4xl mx-auto mb-6 border-2 border-purple-200 rounded-lg shadow-lg">
        <iframe
          src="./downloads/TejasRaut_Resume.pdf"
          className="w-full h-[600px] rounded-lg"
          title="Resume"
        ></iframe>
      </div>

      {/* Download Resume Button */}
      <a
        href="./downloads/TejasRaut_Resume.pdf"
        download
        className="inline-block px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow hover:bg-purple-700 transition"
      >
        ⬇️ Download Resume
      </a>
    </section>
  );
}

