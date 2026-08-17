/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        booknest: {
          navy: "#1A1D2E",
          purple: "#6C47FF",
          "purple-hover": "#5a3ad4",
          muted: "#71717A",
          cream: "#FDF8F8",
          lilac: "#F5F3FF",
          border: "#E4E4E7",
          ring: "rgba(26, 29, 46, 0.06)"
        }
      },
      boxShadow: {
        "booknest-card": "0 4px 24px rgba(26, 29, 46, 0.06)"
      }
    }
  },
  plugins: []
};

