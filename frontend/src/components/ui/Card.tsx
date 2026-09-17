import { forwardRef } from "react";

import { cn } from "../../lib/cn";

/* The white content panel the app is built out of. Defaults are the shape that
 * appears most often: `rounded-3xl border border-bookvuk-border/80 bg-white p-6
 * shadow-bookvuk-card`. Panels that differ set a prop rather than restating the
 * whole class list.
 */

type CardProps = {
  radius?: "2xl" | "3xl";
  padding?: "none" | "sm" | "md" | "lg";
  elevation?: "none" | "sm" | "card" | "panel" | "float";
  /** The faint inner outline that keeps a white card off a white background. */
  hairline?: false | "subtle" | "strong";
  bordered?: boolean;
  as?: "div" | "section" | "article" | "aside" | "li" | "form";
} & React.HTMLAttributes<HTMLElement>;

const PADDING = { none: "", sm: "p-5", md: "p-6", lg: "p-8" } as const;

const ELEVATION = {
  none: "",
  sm: "shadow-sm",
  card: "shadow-bookvuk-card",
  panel: "shadow-bookvuk-panel",
  float: "shadow-bookvuk-float",
} as const;

const HAIRLINE = {
  subtle: "ring-1 ring-bookvuk-navy/[0.04]",
  strong: "ring-1 ring-bookvuk-navy/[0.06]",
} as const;

const Card = forwardRef<HTMLElement, CardProps>(
  (
    {
      radius = "3xl",
      padding = "md",
      elevation = "card",
      hairline = false,
      bordered = true,
      as: Tag = "div",
      className,
      ...rest
    },
    ref,
  ) => (
    <Tag
      // @ts-expect-error -- one ref type per tag; they are all HTMLElement here.
      ref={ref}
      className={cn(
        radius === "3xl" ? "rounded-3xl" : "rounded-2xl",
        bordered && "border border-bookvuk-border/80",
        "bg-white",
        PADDING[padding],
        ELEVATION[elevation],
        hairline && HAIRLINE[hairline],
        className,
      )}
      {...rest}
    />
  ),
);
Card.displayName = "Card";

export default Card;
