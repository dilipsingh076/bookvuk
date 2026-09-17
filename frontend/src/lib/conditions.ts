/**
 * What each grade means, in one place.
 *
 * The same three words appear on both sides of this business: a seller grading
 * their own book, and a buyer deciding whether to trust a second-hand copy. When
 * the two sides describe "Good" differently, every re-grade turns into an
 * argument nobody can settle — so they read from here.
 *
 * The guarantee matters more than the adjectives. "Good" is a judgement and
 * people's judgements differ; "nothing missing, nothing unreadable" is a promise
 * that can be held to, and it is what makes a used book buyable sight-unseen.
 */

type BookCondition = "like_new" | "good" | "fair";

export const CONDITION_LABELS: Record<BookCondition, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

export const CONDITION_BLURBS: Record<BookCondition, string> = {
  like_new: "Barely read — no marks or writing.",
  good: "Light wear, maybe a name inside. Nothing missing.",
  fair: "Well used, with notes or creases. Complete and readable.",
};

/** True of every used copy, whatever its grade. Returns are expensive on
 *  second-hand stock; an expectation set on the page is free. */
export const USED_GUARANTEE =
  "Every used copy is checked by hand: all pages present and readable, no water damage, binding intact. If it arrives otherwise, send it back.";

export const isCondition = (value: unknown): value is BookCondition =>
  value === "like_new" || value === "good" || value === "fair";
