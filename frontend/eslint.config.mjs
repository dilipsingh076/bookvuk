import { FlatCompat } from "@eslint/eslintrc";

/* ESLint's flat config, driven through FlatCompat because `eslint-config-next`
 * still ships the classic shape.
 *
 * `next lint` is deprecated in Next 15, so the `lint` script calls the ESLint CLI
 * directly. Without a config here the command prompts interactively, which in CI
 * means a job that hangs rather than fails.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // A plain <a> to an internal route skips client navigation and reloads the
      // whole app — an easy mistake to make and an easy one to miss.
      "@next/next/no-html-link-for-pages": "error",
      /* This project deliberately does not use `next/image`.
       *
       * The optimiser runs `sharp` in-process and caches to `.next/cache/images`,
       * which on the 512MB instance this deploys to means a memory spike and a
       * cache that every deploy wipes. `components/ui/Img.tsx` records the full
       * trade-off.
       *
       * So Next's own rule is off, and the two rules below enforce the decision
       * instead of leaving it to review: `next/image` cannot be imported, and a
       * bare <img> has exactly one sanctioned home.
       */
      "@next/next/no-img-element": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/image",
              message:
                "Use `Img` from components/ui instead — see components/ui/Img.tsx for why the optimiser is not used here.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='img']",
          message:
            "Use `Img` from components/ui rather than a bare <img>: it carries the lazy-loading default a plain <img> does not have.",
        },
      ],
    },
  },
  {
    // The one place the bare element is allowed — it *is* the wrapper.
    files: ["src/components/ui/Img.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
];

export default config;
