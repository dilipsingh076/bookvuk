import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/* Vitest keeps its own config now that Vite no longer builds the app. The React
 * plugin is still needed to transform JSX for the tests, and tsconfigPaths so
 * `@/…` resolves the same way it does under Next.
 */
export default defineConfig({
  // Cast: vitest bundles its own Vite, so the plugin types come from a
  // different copy of the package than the one these are imported from.
  plugins: [react(), tsconfigPaths()] as never,
  test: {
    // jsdom because the code under test reaches for localStorage and the DOM
    // directly — the guest cart is stored in the browser.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
