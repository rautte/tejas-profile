export default function Hero() {
  return (
    <section className="relative overflow-hidden py-12 text-white text-center transition-all">
      {/* Gradient Background with glass effect */}
      <div className="absolute inset-0 z-0">
        {/* Base gradient */}
        <div className="w-full h-full bg-gradient-to-br from-purple-800 via-purple-500 to-purple-900 dark:from-purple-900 dark:via-[#1e1e2f] dark:to-[#181826]"></div>

        {/* Glass overlay */}
        <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-2xl" />

        {/* Reflective shimmer animation */}
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-glow bg-gradient-radial from-purple-300/30 via-transparent to-transparent rounded-full opacity-60 blur-2xl mix-blend-lighten pointer-events-none" />
      </div>

      {/* Text Content */}
      <div className="relative z-10 px-4">
        <h1 className="text-5xl font-bold font-epilogue bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white dark:from-white dark:via-gray-200 dark:to-white drop-shadow-md">
          👋 I’m Tejas Raut
        </h1>
        <p className="mt-2 text-base text-purple-200 dark:text-gray-400 font-jakarta">
          Full-Stack Developer | Data Engineer | Business Intelligence Engineer
        </p>
      </div>
    </section>
  );
}
