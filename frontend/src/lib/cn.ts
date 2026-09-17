import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { backgroundImage, boxShadow } from "../theme/tokens";

/* Why this is not just `clsx`.
 *
 * Tailwind resolves `px-4 px-8` by stylesheet order, not by the order the class
 * names appear in the attribute. So a component that renders
 * `class="px-4 <caller's classes>"` does NOT reliably let the caller win — the
 * override silently loses whenever the variant's utility happens to be emitted
 * later. `twMerge` drops the earlier of any two conflicting utilities, which is
 * what makes `className` on these primitives a dependable escape hatch.
 *
 * The custom groups below are required for the same reason: without them
 * `shadow-bookvuk-card` is a class twMerge has never heard of, so it would be
 * kept alongside a later `shadow-none` instead of being replaced by it. Same for
 * the gradients — `bg-bookvuk-hero` sets a background *image*, and must not be
 * treated as conflicting with a background *colour* like `bg-white`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: Object.keys(boxShadow) }],
      "bg-image": [{ bg: Object.keys(backgroundImage) }],
    },
  },
});

/** Join class names, with later Tailwind utilities overriding earlier ones. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
