/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        "sidebar-bg": "var(--sidebar-bg)",
        card: "var(--card)",
        accent: "var(--accent)",
        destructive: "var(--destructive)",
        success: "var(--success)",
        "border-hairline": "var(--border-hairline)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      backdropBlur: {
        glass: "20px",
      },
      backdropSaturate: {
        glass: "180%",
      },
    },
  },
  plugins: [],
}
