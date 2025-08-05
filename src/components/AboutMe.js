export default function AboutMe() {
  return (
    <section className="py-16 px-4 text-center bg-gray-50 dark:bg-[#181826] transition-colors">
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-[#26263a] border border-gray-200 dark:border-[#31314a] rounded-xl p-10 shadow-sm transition-all">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 mb-4 font-epilogue">
          About Me
        </h2>
        <p className="text-gray-700 dark:text-gray-300 font-epilogue">
          This section will tell visitors about who I am, what I love, and what I’m working on.
        </p>
      </div>
    </section>
  );
}
