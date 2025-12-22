// components/AboutMe.js
import React from "react";
import { FaUser } from "react-icons/fa";
import profilePic from "../assets/images/LI_Profile.jpg";

export default function AboutMe() {
  return (
    <section className="w-full py-0 px-4 bg-transparent">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaUser className="text-3xl text-purple-700 dark:text-purple-300" />
            About Me
          </h2>
        </div>
      </div>

      {/* Content (NO CARD) */}
      <div className="px-6 max-w-6xl mx-auto">
        {/* Picture + Quote */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-16 mb-10">
          {/* Image */}
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-purple-400 dark:border-purple-300 shadow-lg">
            <img
              src={profilePic}
              alt="Tejas Raut"
              className="w-60 h-60 rounded-full object-cover [object-position:70%_80%]"
            />
          </div>

          {/* Quote */}
          <blockquote className="text-xl italic text-gray-700 dark:text-gray-300 text-center md:text-left max-w-xl">
            “I like working on systems that make sense when you read them, run them,
            and debug them at 2 a.m. XD”
          </blockquote>
        </div>

        {/* Text */}
        <div className="text-gray-800 dark:text-gray-300 space-y-5 leading-relaxed text-md font-epilogue"> {/* px-2 md:px-6 */}
          <p>
            I am a software engineer focused on data platforms and backend systems.
            Most of my experience has been in building and operating distributed
            pipelines, backend services, and cloud infrastructure that need to run
            reliably at scale. I spend a lot of time thinking about how systems behave
            in production and how to make them predictable, observable, and easy to operate.
          </p>

          <p>
            In my work, I have owned parts of data ingestion, processing, and
            orchestration pipelines across AWS and Azure. I am comfortable working
            close to storage, compute, and data flows, and I enjoy problems where
            performance, correctness, and system design all matter. I care about
            clean interfaces, clear ownership, and systems that fail in understandable ways.
          </p>

          <p>
            Outside of my day-to-day roles, I build systems to deepen my understanding
            of infrastructure and orchestration. These projects often start from real
            problems and turn into tools or platforms that emphasize automation,
            reliability, and end-to-end ownership. I enjoy taking ideas from a rough
            concept to something that feels production-ready.
          </p>

          <p>
            I am drawn to teams that value thoughtful engineering, strong fundamentals,
            and long-term system health. I am looking for roles where I can contribute
            to core data or infrastructure platforms while continuing to grow as an
            engineer alongside people who take their work seriously.
          </p>
        </div>
      </div>
    </section>
  );
}
