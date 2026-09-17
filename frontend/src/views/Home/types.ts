/** Types and tuning for the signed-in home page. */

import type { Book } from "../../api/index";

/** Six per slide fills the `lg:grid-cols-6` row exactly, so no slide is short. */
export const SPOTLIGHT_PER_SLIDE = 6;
/** Five slides is about twenty seconds of rotation — past that nobody is watching. */
export const MAX_SPOTLIGHT_SLIDES = 5;
export const SPOTLIGHT_AUTO_MS = 3400;

export type SpotlightCarouselProps = {
  slides: Book[][];
  onOpenBook: (book: Book) => void;
};

export const formatCount = (n: number) => n.toLocaleString("en-IN");
