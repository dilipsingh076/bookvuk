/**
 * The one image element.
 *
 * A plain `<img>`, not `next/image`. The optimiser is not the wrong tool in
 * general — it serves AVIF/WebP and emits a srcset — but it is the wrong tool on
 * the instance this deploys to: transforms run in-process through `sharp`, which
 * is memory-hungry on a 512MB box, and the cache it writes (`.next/cache/images`)
 * sits on an ephemeral filesystem, so all ~210 covers are re-encoded from scratch
 * after every deploy and restart.
 *
 * What the optimiser was doing for us, and what replaces it:
 *
 * | Was | Now |
 * | --- | --- |
 * | AVIF/WebP conversion | nothing — the covers ship as the JPEGs they are (~34KB each) |
 * | `srcset` + `sizes` | nothing — one file per cover, so there is no smaller one to pick |
 * | lazy by default | `loading="lazy"` here, because a bare `<img>` defaults to **eager** |
 *
 * That middle row is the real cost, and it is why this is a component rather
 * than a find-and-replace: the defaults have to live in one place. The last row
 * is the trap — dropping `next/image` without setting a default would make the
 * browse grid fetch every cover in the viewport at once.
 */
import type { ImgHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src: string;
  /**
   * Required, and `""` is a legitimate value — it marks the image decorative, so
   * a screen reader skips it instead of reading a filename. Making it optional
   * is how images end up announced as "1 7 5 dot j p g".
   */
  alt: string;
  /**
   * Fill the nearest positioned ancestor, which supplies the aspect ratio.
   * The parent must be `relative` — same contract `next/image`'s `fill` had.
   */
  fill?: boolean;
  /**
   * In the first paint. Loads eagerly and asks the browser to prioritise it.
   *
   * Note this is weaker than `next/image`'s `priority`, which also emitted a
   * `<link rel="preload">`. Stated rather than left as a silent gap: for the two
   * images using it (the hero and the product cover) they are discoverable in
   * the initial HTML anyway, so the preload was buying little.
   */
  priority?: boolean;
};

const Img = ({
  src,
  alt,
  fill = false,
  priority = false,
  loading,
  className,
  ...rest
}: ImgProps) => (
  <img
    src={src}
    alt={alt}
    /* A bare <img> is eager by default, which is the opposite of what a long
       grid wants. `priority` opts back in; an explicit `loading` still wins. */
    loading={loading ?? (priority ? "eager" : "lazy")}
    fetchPriority={priority ? "high" : undefined}
    decoding={priority ? "sync" : "async"}
    className={cn(fill && "absolute inset-0 h-full w-full", className)}
    {...rest}
  />
);

export default Img;
