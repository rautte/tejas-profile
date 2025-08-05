export default function Hero() {
  return (
    <section className="relative overflow-hidden py-20 bg-gradient-to-br from-purple-700 via-purple-500 to-purple-800 dark:from-gray-900 dark:via-purple-900 dark:to-black text-white text-center transition-all duration-500">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute w-72 h-72 bg-purple-300 dark:bg-purple-800 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-indigo-400 dark:bg-indigo-800 rounded-full blur-2xl top-40 right-20 animate-pulse delay-200"></div>
      </div>

      <div className="relative z-10 px-4">
        <h1 className="text-5xl font-bold font-epilogue bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white dark:from-white dark:via-gray-200 dark:to-white drop-shadow-md">
          👋 I’m Tejas Raut
        </h1>
        <p className="text-xl mt-4 font-epilogue text-purple-100 dark:text-gray-300 drop-shadow-sm">
          Welcome to my profile page
        </p>
        <p className="mt-2 text-base text-purple-200 dark:text-gray-400 font-jakarta">
          Full-Stack Developer | React, Node.js, Python, AWS
        </p>
      </div>
    </section>

    // <section className="relative overflow-hidden py-20 bg-gradient-to-br from-purple-700 via-purple-500 to-purple-800 dark:from-gray-900 dark:via-gray-800 dark:to-black text-white text-center transition-all duration-500">
    //   {/* Reflective background lights */}
    //   <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
    //     <div className="absolute w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
    //     <div className="absolute w-96 h-96 bg-indigo-400 dark:bg-indigo-900 rounded-full blur-2xl top-40 right-20 animate-pulse delay-200"></div>
    //   </div>

    //   {/* Text content */}
    //   <div className="relative z-10 px-4">
    //     <h1 className="text-5xl font-bold font-epilogue bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white dark:from-white dark:via-gray-200 dark:to-white drop-shadow-md">
    //       👋 I’m Tejas Raut
    //     </h1>
    //     <p className="text-xl mt-4 font-epilogue text-purple-100 dark:text-gray-300 drop-shadow-sm">
    //       Welcome to my profile page
    //     </p>
    //     <p className="mt-2 text-base text-purple-200 dark:text-gray-400 font-jakarta">
    //       Full-Stack Developer | React, Node.js, Python, AWS
    //     </p>
    //   </div>
    // </section>
  );
}
