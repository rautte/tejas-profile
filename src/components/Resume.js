import { HiDownload } from 'react-icons/hi';
import { FaBriefcase, FaFileAlt } from 'react-icons/fa';

export default function Resume() {
  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Title & Underline aligned left like Projects */}
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <FaFileAlt className="text-3xl text-purple-700 dark:text-purple-300" />
          Resume
        </h2>
        <div
          // className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"
        ></div>
      </div>

      {/* Subtitle */}
      {/* <p className="text-center text-gray-700 dark:text-gray-300 mb-10 font-epilogue">
        You can view or download my resume below 👇
      </p> */}

      {/* Resume Preview */}
      <div className="max-w-4xl mx-auto mb-8 border-2 border-purple-200 dark:border-purple-500 rounded-xl shadow-lg overflow-hidden">
        <iframe
          src="./downloads/TejasRaut_Resume.pdf"
          className="w-full h-[600px] rounded-xl"
          title="Tejas Raut Resume"
        ></iframe>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        {/* Download */}
        <a
          href="./downloads/TejasRaut_Resume.pdf"
          download
          className="flex items-center justify-center gap-2 text-sm px-6 py-3 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 transition font-medium"
        >
          <HiDownload className="text-lg" />
          Download Resume
        </a>

        {/* Hire Me */}
        <a
          href="mailto:raut.tejas@outlook.com"
          className="flex items-center justify-center gap-2 text-sm px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow hover:opacity-90 transition font-medium"
        >
          <FaBriefcase className="text-sm" />
          Hire Me
        </a>
      </div>
    </section>
  );
}




// // components/Resume.js
// export default function Resume() {
//   return (
//     <section className="py-16 px-4 bg-gray-100 text-center">
//       <h2 className="text-3xl font-bold text-purple-700 mb-6 font-epilogue">Resume</h2>
      
//       <p className="text-gray-700 mb-8 font-epilogue">You can view or download my resume below 👇</p>

//       {/* View Resume */}
//       <div className="max-w-4xl mx-auto mb-6 border-2 border-purple-200 rounded-lg shadow-lg">
//         <iframe
//           src="./downloads/TejasRaut_Resume.pdf"
//           className="w-full h-[600px] rounded-lg"
//           title="Resume"
//         ></iframe>
//       </div>

//       {/* Download Resume Button */}
//       <a
//         href="./downloads/TejasRaut_Resume.pdf"
//         download
//         className="inline-block px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow hover:bg-purple-700 transition"
//       >
//         ⬇️ Download Resume
//       </a>
//     </section>
//   );
// }

