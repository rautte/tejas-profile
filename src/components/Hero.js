// export default function Hero() {
//     return (
//       <section className="py-20 bg-purple-600 text-white text-center">
//         <h1 className="text-5xl font-bold font-epilogue">Hi, I’m Tejas 👋</h1>
//         <p className="text-xl mt-4 font-epilogue">Welcome to my profile page</p>
//       </section>
//     );
//   }


export default function Hero() {
  return (
    <section className="relative overflow-hidden py-20 bg-gradient-to-br from-purple-700 via-purple-500 to-purple-800 text-white text-center">
      {/* Reflective background lights */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute w-72 h-72 bg-purple-300 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-indigo-400 rounded-full blur-2xl top-40 right-20 animate-pulse delay-200"></div>
      </div>

      {/* Text content */}
      <div className="relative z-10">
        <h1 className="text-5xl font-bold font-epilogue bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-white drop-shadow-md">
          👋 I’m Tejas Raut
        </h1>
        <p className="text-xl mt-4 font-epilogue text-purple-100 drop-shadow-sm">
          Welcome to my profile page
        </p>
      </div>
    </section>
  );
}
