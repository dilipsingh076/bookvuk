/* A barrel, so callers keep importing `@/views/Sell` while the files inside stay
   distinctly named — 23 files called `index.tsx` would make the editor's tabs
   and fuzzy-find useless. */
export { default } from "./Sell";
