import { cn } from "../../lib/cn";

/* The title block at the top of a page: eyebrow, h1, one line of description,
 * and optionally an action on the right.
 *
 * Eleven pages had spelled out `text-3xl font-bold tracking-tight
 * text-bookvuk-navy sm:text-4xl` by hand. Two of them had drifted off it, which
 * is the tell that this belongs in one place.
 */

type PageHeaderProps = {
  title: React.ReactNode;
  /** Small caps line above the title — "Your account", "Admin". */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or filters, right-aligned on wide screens. */
  actions?: React.ReactNode;
  className?: string;
  /** `h1` per page; drop to `h2` when a page shows two of these. */
  as?: "h1" | "h2";
  /** Space between the title block and the actions. */
  gap?: "sm" | "md";
  /** The `mt-2` most pages carry on the heading. Off for pages that space it
   *  themselves. */
  offsetTitle?: boolean;
  /** The app uses two description sizes: 17px next to a standalone title, 15px
   *  when the header shares its row with an action. */
  descriptionSize?: "sm" | "md";
  /** Extra classes for the description. `leading-relaxed` is deliberately not
   *  the default at the small size: it is a 4px-per-line difference, and the two
   *  pages using that size disagree about it. */
  descriptionClassName?: string;
};

const PageHeader = ({
  title,
  eyebrow,
  description,
  actions,
  className,
  as: Heading = "h1",
  gap = "md",
  offsetTitle = true,
  descriptionSize = "md",
  descriptionClassName,
}: PageHeaderProps) => {
  const block = (
    <>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading
        className={cn(
          offsetTitle && "mt-2",
          "text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "text-bookvuk-muted",
            descriptionSize === "md"
              ? "mt-3 text-base leading-relaxed sm:text-[17px]"
              : "mt-2 text-sm sm:text-[15px]",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </>
  );

  // Two layouts, because the app has two: a plain block when the header is just
  // a title, and a row that puts the actions opposite it — stacking on narrow
  // screens so a filter control never gets squeezed against the heading.
  if (!actions) return <div className={className}>{block}</div>;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between",
        gap === "sm" ? "gap-3" : "gap-4",
        className,
      )}
    >
      <div className="min-w-0">{block}</div>
      {actions}
    </div>
  );
};

/** The quiet all-caps line that labels a section. */
export const Eyebrow = ({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn("text-[11px] font-bold uppercase tracking-wider text-bookvuk-muted", className)}
    {...rest}
  />
);

type SectionHeadingProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** A heading inside a page — "Items", "1. Which book?", "We're here to help".
 *
 *  With nothing beside it this is just the `h2`, no wrapper. Most of the places
 *  that use it are a bare heading, and wrapping those in a flex row would add
 *  layout that has to be reasoned about for no benefit. */
export const SectionHeading = ({
  title,
  description,
  actions,
  className,
}: SectionHeadingProps) => {
  const heading = (
    <h2 className={cn("text-lg font-bold text-bookvuk-navy", !description && !actions && className)}>
      {title}
    </h2>
  );

  if (!description && !actions) return heading;

  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {heading}
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
};

export default PageHeader;
