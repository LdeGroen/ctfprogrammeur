/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ctf: {
          primary: '#9f4493',
          dark: '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
}
