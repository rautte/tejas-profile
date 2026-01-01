// src/components/AboutMe.js
import React from "react";
import { FaUser } from "react-icons/fa";

import profilePic from "../assets/images/LI_Profile.jpg";
import { ABOUT_ME } from "../data/aboutMe";

import SectionHeader from "./shared/SectionHeader";

import { SECTION_SHELL, SECTION_CONTAINER, BODY_TEXT } from "../utils/ui";

export default function AboutMe() {
  const content = {
    quote: {
      mobile: ABOUT_ME.mobile?.quote ?? ABOUT_ME.quote,
      desktop: ABOUT_ME.desktop?.quote ?? ABOUT_ME.quote,
    },
    paragraphs: {
      mobile: ABOUT_ME.mobile?.paragraphs ?? ABOUT_ME.paragraphs ?? [],
      desktop: ABOUT_ME.desktop?.paragraphs ?? ABOUT_ME.paragraphs ?? [],
    },
  };

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader icon={FaUser} title="About Me" />

      {/* Content (NO CARD) */}
      <div className={SECTION_CONTAINER}>
        {/* Image + Intro (mobile row, desktop unchanged) */}
        <div className="flex flex-row md:flex-row items-center justify-center gap-10 sm:gap-16 md:gap-28 mb-4 sm:mb-10">
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
            <div className="text-[17px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">
              👋 I’m {ABOUT_ME.name}
            </div>
          </div>

          {/* Desktop quote (ONLY desktop) */}
          <blockquote className="hidden md:block italic text-left max-w-xl">
            <div className="relative pl-4">
              {/* accent bar */}
              <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-purple-800/70 dark:bg-purple-300/60" />

              {/* soft wash (not a card) - bigger than text */}
              <span className="absolute -inset-3 -z-10 rounded-[22px] bg-gradient-to-br from-purple-900/10 via-purple-400/10 to-transparent dark:from-purple-300/20" />
              {/* subtle secondary haze to make it feel more “washy” */}
              <span className="absolute -inset-5 -z-20 rounded-[28px] bg-purple-500/5 dark:bg-white/5 blur-[2px]" />

              {/* quote text (UNCHANGED styling) */}
              <span className="block text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {content.quote.desktop}
              </span>
            </div>
          </blockquote>
        </div>

        {/* Mobile-only quote below (ONLY mobile) */}
        <blockquote className="md:hidden italic text-gray-700 dark:text-gray-300 text-center mb-6">
          <span className="block text-[12px] leading-relaxed">
            {content.quote.mobile}
          </span>
        </blockquote>

        {/* Text */}
        <div className={`${BODY_TEXT} max-w-[68ch] md:max-w-none`}>
          {/* Mobile: all 4 paragraphs (with proper spacing) */}
          <div className="md:hidden space-y-4">
            {content.paragraphs.mobile.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          {/* Desktop: 3 vertical columns in a single row */}
          <div
            className="
              hidden md:grid md:grid-cols-3 md:gap-10
              text-[14px] lg:text-[15px]
              leading-[1.7]
              text-gray-800 dark:text-gray-300
            "
          >
            {content.paragraphs.desktop.slice(0, 3).map((p) => (
              <p
                key={p}
                className="
                  text-justify
                  hyphens-auto
                "
              >
                {p}
              </p>
            ))}
          </div>
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

// import { SECTION_SHELL, SECTION_CONTAINER, BODY_TEXT } from "../utils/ui";

// export default function AboutMe() {
//   return (
//     <section className={SECTION_SHELL}>
//       <SectionHeader icon={FaUser} title="About Me" />

//       {/* Content (NO CARD) */}
//       <div className={SECTION_CONTAINER}>
//         {/* Image + Intro (mobile row, desktop unchanged) */}
//         <div className="flex flex-row md:flex-row items-center justify-center gap-10 sm:gap-16 md:gap-28 mb-4 sm:mb-10">
//           {/* Image */}
//           <div className="w-32 h-32 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-purple-400 dark:border-purple-300 shadow-lg shrink-0">
//             <img
//               src={profilePic}
//               alt={ABOUT_ME.name}
//               className="w-full h-full rounded-full object-cover [object-position:40%_35%]"
//               loading="lazy"
//             />
//           </div>

//           {/* Mobile-only intro text */}
//           <div className="md:hidden flex flex-col items-start text-left">
//             <div className="text-[17px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">
//               👋 I’m {ABOUT_ME.name}
//             </div>
//           </div>

//           {/* Desktop quote (ONLY desktop) */}
//           <blockquote className="hidden md:block italic text-gray-700 dark:text-gray-300 text-left max-w-xl">
//             <span className="block text-md leading-relaxed">{ABOUT_ME.quote}</span>
//           </blockquote>
//         </div>

//         {/* Mobile-only quote below (ONLY mobile) */}
//         <blockquote className="md:hidden italic text-gray-700 dark:text-gray-300 text-center mb-6">
//           <span className="block text-[12px] leading-relaxed">{ABOUT_ME.quote}</span>
//         </blockquote>

//         {/* Text */}
//         <div className={`${BODY_TEXT} space-y-4 sm:space-y-5 max-w-[68ch] md:max-w-none`}>
//           {ABOUT_ME.paragraphs.map((p) => (
//             <p key={p}>{p}</p>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// }

