/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // healwin: {
        //   50: "#FFF7ED",
        //   100: "#FFEDD5",
        //   200: "#FFD4A8",
        //   300: "#FFB366",
        //   400: "#FF9D3D",
        //   500: "#FF6B35",
        //   600: "#FF5722",
        //   700: "#F4511E",
        //   800: "#E64A19",
        //   900: "#D84315",
        // },
        healwin: {
          50: "#E3F2FD",
          100: "#BBDEFB",
          200: "#90CAF9",
          300: "#64B5F6",
          400: "#42A5F5",
          500: "#2196F3",
          600: "#1E88E5",
          700: "#1976D2",
          800: "#1565C0",
          900: "#0D47A1",
        },
      },
    },
  },
  plugins: [],
};
