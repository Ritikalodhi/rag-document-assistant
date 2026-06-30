/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "#0A0A0B",
        "surface": "#15121b",
        "surface-container-low": "#1d1a24",
        "surface-container": "#221e28",
        "surface-container-high": "#2c2833",
        "surface-container-highest": "#37333e",
        "surface-container-lowest": "#100d16",
        "surface-variant": "#37333e",
        "on-surface": "#e8dfee",
        "on-surface-variant": "#ccc3d8",
        "outline-variant": "#4a4455",
        "outline": "#958da1",
        "primary": "#d2bbff",
        "on-primary": "#3f008e",
        "primary-container": "#7c3aed",
        "on-primary-container": "#ede0ff",
        "secondary": "#c8c5cb",
        "tertiary": "#ffb784",
      },
      fontFamily: {
        sans: ["Geist", "sans-serif"],
      },
    },
  },
  plugins: [],
}
