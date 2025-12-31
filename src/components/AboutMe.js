// src/components/AboutMe.js
import React from "react";
import { FaUser } from "react-icons/fa";

import profilePic from "../assets/images/LI_Profile.jpg";
import { ABOUT_ME } from "../data/aboutMe";

import SectionHeader from "./shared/SectionHeader";

export default function AboutMe() {
  return (
    <section className="w-full py-0 px-4 transition-colors">
      <SectionHeader icon={FaUser} title="About Me" />

      {/* Content (NO CARD) */}
      <div className="px-0 sm:px-6 md:px-4 max-w-6xl mx-auto">
        {/* Image + Intro (mobile row, desktop unchanged) */}
        <div className="flex flex-row md:flex-row items-center justify-center gap-8 sm:gap-12 md:gap-28 mb-4 sm:mb-10">
          {/* Image */}
          <div className="w-32 h-32 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-purple-400 dark:border-purple-300 shadow-lg shrink-0">
            <img
              src={profilePic}
              alt={ABOUT_ME.name}
              className="w-full h-full rounded-full object-cover [object-position:40%_35%]"
              loading="lazy"
            />
          </div>

          {/* Mobile-only intro text */}
          <div className="md:hidden flex flex-col items-start text-left">
            {/* <div className="text-sm text-gray-600 dark:text-gray-400"></div> */}
            <div className="text-[16px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">
              👋 I’m {ABOUT_ME.name}
            </div>
          </div>

          {/* Desktop quote (ONLY desktop) */}
          <blockquote className="hidden md:block italic text-gray-700 dark:text-gray-300 text-left max-w-xl">
            <span className="block text-xl leading-relaxed">
              {ABOUT_ME.quote}
            </span>
          </blockquote>
        </div>

        {/* Mobile-only quote below (ONLY mobile) */}
        <blockquote className="md:hidden italic text-gray-700 dark:text-gray-300 text-center mb-6 px-4">
          <span className="block text-[12px] leading-relaxed">
            {ABOUT_ME.quote}
          </span>
        </blockquote>

        {/* Text */}
        <div className="text-gray-800 dark:text-gray-300 space-y-4 sm:space-y-5 leading-relaxed text-[11px] sm:text-md md:text-[15px] font-epilogue max-w-[68ch] md:max-w-none">
          {ABOUT_ME.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}



// // src/components/AboutMe.js
// import React from "react";
// import { FaUser } from "react-icons/fa";

// import profilePic from "../assets/images/LI_Profile.jpg";
// import { ABOUT_ME } from "../data/aboutMe";

// import SectionHeader from "./shared/SectionHeader";

// export default function AboutMe() {
//   return (
//     <section className="w-full py-0 px-4 transition-colors">
//       <SectionHeader icon={FaUser} title="About Me" />

//       {/* Content (NO CARD) */}
//       <div className="px-0 md:px-4 sm:px-6 max-w-6xl mx-auto">
//         {/* Picture + Quote */}
//         <div className="flex flex-row md:flex-row items-center justify-center px-6 md:px-0 gap-4 sm:gap-12 md:gap-16 mb-8 sm:mb-10">
//           {/* Image */}
//           <div className="w-32 h-32 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-purple-400 dark:border-purple-300 shadow-lg shrink-0">
//             <img
//               src={profilePic}
//               alt={ABOUT_ME.name}
//               className="w-full h-full rounded-full object-cover [object-position:40%_35%]"
//               loading="lazy"
//             />
//           </div>

//           {/* Quote */}
//           <blockquote className="italic text-gray-700 dark:text-gray-300 text-center md:text-left max-w-xl">
//             <span className="block text-[12px] sm:text-xl md:text-xl leading-relaxed">
//               {ABOUT_ME.quote}
//             </span>
//           </blockquote>
//         </div>

//         {/* Text */}
//         <div className="text-gray-800 dark:text-gray-300 space-y-4 sm:space-y-5 leading-relaxed text-[11px] sm:text-md md:text-[15px] font-epilogue max-w-[68ch] md:max-w-none">
//           {ABOUT_ME.paragraphs.map((p) => (
//             <p key={p}>{p}</p>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// }
