// components/AboutMe.js
import React from "react";
import profilePic from "../assets/LI_Profile.jpg"; // Replace with your image path

export default function AboutMe() {
  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Header with Title and Filter Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        {/* Title and divider */}
        <div>
          <h2
            className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md"
          >
            About Me
          </h2>
          <div
            className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"
          ></div>
        </div>
      </div>

      {/* Picture + Quote */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-40 mb-16">
        {/* Image */}
        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-purple-300 shadow-lg">
          <img
            src={profilePic}
            alt="Tejas Raut"
            className="w-60 h-60 rounded-full object-cover [object-position:70%_80%]"
          />
        </div>

        {/* Quote */}
        <blockquote className="text-xl italic text-gray-700 dark:text-gray-300 text-center md:text-left max-w-xl">
          “I am not a geek for coding as much as I am for developing.”
        </blockquote>
      </div>

      {/* Content */}
      <div className="text-gray-800 dark:text-gray-300 max-w-4xl mx-auto space-y-6 leading-relaxed text-lg">
        <p>
          I'm a curious and creative full-stack developer with a passion for crafting meaningful software experiences. Whether it's building cloud pipelines or designing sleek frontends, I enjoy blending logic with aesthetics.
        </p>
        <p>
          With a background in data engineering and cloud platforms, I love solving real-world problems and simplifying complexity. I believe the best tech solutions are both robust and beautiful.
        </p>
        <p>
          When I'm not coding, you’ll find me exploring new design trends, brewing the perfect matcha, or diving into story-driven video games.
        </p>
      </div>
    </section>
  );
}

