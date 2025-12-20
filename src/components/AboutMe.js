// components/AboutMe.js
import React from "react";
import { FaUser } from 'react-icons/fa';
import profilePic from "../assets/images/LI_Profile.jpg"; // Replace with your image path

export default function AboutMe() {

  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Header with Title and Filter Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        {/* Title and divider */}
        <div>
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaUser className="text-3xl text-purple-700 dark:text-purple-300" />
            About Me
          </h2>
          <div
            // className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"
          ></div>
        </div>
      </div>

      {/* <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-2xl px-8 py-12 mx-auto max-w-5xl"> */}
      <div className="px-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-2xl px-8 py-12 w-full">

          {/* Picture + Quote */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-20 mb-12">
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
              “I like working on systems that make sense when you read them, run them, and debug them at 2 a.m.”
            </blockquote>
          </div>

          {/* Content */}
          <div className="text-gray-800 dark:text-gray-300 space-y-6 leading-relaxed text-md font-epilogue px-4 md:px-10">
            <p>
              I am a software engineer focused on data platforms and backend systems. Most of my experience has been in building and operating distributed pipelines, backend services, and cloud infrastructure that need to run reliably at scale. I spend a lot of time thinking about how systems behave in production and how to make them predictable, observable, and easy to operate.
            </p>
            <p>
              In my work, I have owned parts of data ingestion, processing, and orchestration pipelines across AWS and Azure. I am comfortable working close to storage, compute, and data flows, and I enjoy problems where performance, correctness, and system design all matter. I care about clean interfaces, clear ownership, and systems that fail in understandable ways.
            </p>
            <p>
              Outside of my day to day roles, I build systems to deepen my understanding of infrastructure and orchestration. These projects often start from real problems and turn into tools or platforms that emphasize automation, reliability, and end to end ownership. I enjoy taking ideas from a rough concept to something that feels production ready.
            </p>
            <p>
              I am drawn to teams that value thoughtful engineering, strong fundamentals, and long term system health. I am looking for roles where I can contribute to core data or infrastructure platforms while continuing to grow as an engineer alongside people who take their work seriously.
            </p>
          </div>
        </div>
      </div>

      {/* Know More Section
      <div className="mt-20 px-4 md:px-10 max-w-5xl mx-auto">
        <h3 className="text-2xl font-bold text-purple-700 dark:text-purple-300 mb-6 font-epilogue">
          💡 Know More
        </h3>

        {qaList.map((item, idx) => (
          <div key={idx} className="dark:bg-[#2a2a40] p-1.5 mb-2 rounded-2xl shadow-xl border border-white/10 dark:border-white/20 transition-transform transform-gpu hover:scale-[1.01] duration-200">
            <button
              className="w-full flex justify-between items-center text-left px-6 py-4 bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
              onClick={() => toggle(idx)}
            >
              <span className="font-semibold">{item.question}</span>
              <span className="text-xl">{expanded === idx ? "−" : "+"}</span>
            </button>
            {expanded === idx && (
              <div className="px-6 py-4 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div> */}

    </section>
  );
}

