import type { Config } from "tailwindcss";
import { backgroundImage, boxShadow, colors, fontFamily } from "./src/theme/tokens";

/* The theme is assembled from `src/theme/tokens.ts` rather than written out
 * here, so the components and this config cannot disagree about what the brand
 * purple is. Replaces the previous `tailwind.config.cjs`; it is TypeScript so
 * the token import is type-checked.
 */
export default {
  // index.html is gone — Next builds the document from app/layout.tsx. Every
  // class the app can emit lives under src/ now.
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: { bookvuk: colors },
      // Previously only in `body { font-family: ... }`. Declaring it here means
      // `font-sans` and Tailwind's own preflight resolve to the same stack.
      fontFamily: { sans: [...fontFamily.sans] },
      boxShadow,
      backgroundImage,
    },
  },
  plugins: [],
} satisfies Config;
