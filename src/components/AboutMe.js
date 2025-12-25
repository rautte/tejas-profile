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
      <div className="px-6 max-w-6xl mx-auto">
        {/* Picture + Quote */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-16 mb-10">
          {/* Image */}
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-purple-400 dark:border-purple-300 shadow-lg shrink-0">
            <img
              src={profilePic}
              alt={ABOUT_ME.name}
              className="w-60 h-60 rounded-full object-cover [object-position:70%_80%]"
            />
          </div>

          {/* Quote */}
          <blockquote className="text-xl italic text-gray-700 dark:text-gray-300 text-center md:text-left max-w-xl">
            {ABOUT_ME.quote}
          </blockquote>
        </div>

        {/* Text */}
        <div className="text-gray-800 dark:text-gray-300 space-y-5 leading-relaxed text-md font-epilogue">
          {ABOUT_ME.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
