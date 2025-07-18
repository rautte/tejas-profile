/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx,html}",
      "./public/index.html"
    ],
    theme: {
      extend: {
        fontFamily: {
          space: ['Space Grotesk', 'sans-serif'],
          spline: ['Spline Sans', 'sans-serif'],
          cabinet: ['Cabinet Grotesk', 'sans-serif'],
          jakarta: ['Plus Jakarta Sans', 'sans-serif'],
          epilogue: ['Epilogue', 'sans-serif'],
          general: ['General Sans', 'sans-serif'],
          bevietnam: ['Be Vietnam Pro', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }