/* The storefront's public origin, in one place.
 *
 * `SITE_URL` was written out in eleven files. Every canonical URL, link preview, sitemap entry and
 * schema.org id is built from it, so eleven copies is eleven chances for one of
 * them to keep pointing at localhost after a deploy — and that failure is
 * invisible until somebody shares a link.
 */
const CONFIGURED = process.env.NEXT_PUBLIC_SITE_URL;

export const SITE_URL = (CONFIGURED || "http://localhost:5173").replace(/\/+$/, "");

/* Shout if a production build still thinks it is localhost.
 *
 * Every canonical URL, Open Graph tag, sitemap entry and schema.org id is built
 * from this. Get it wrong and the site works perfectly while telling search
 * engines it lives on localhost — the one failure nobody notices until a shared
 * link is dead and the sitemap has been rejected for a fortnight.
 *
 * A build-time warning rather than a thrown error: refusing to build would stop
 * anyone running a production build locally, which is a normal thing to do. This
 * is printed once, during the build, where whoever is deploying will see it. */
if (
  process.env.NODE_ENV === "production" &&
  (!CONFIGURED || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(SITE_URL))
) {
  console.warn(
    `\n  ⚠ NEXT_PUBLIC_SITE_URL is ${CONFIGURED ? `"${CONFIGURED}"` : "unset"}, so this build will publish\n` +
      `    canonical URLs, link previews and a sitemap pointing at ${SITE_URL}.\n` +
      `    Set it to the real domain before deploying.\n`,
  );
}

/* Origin serving book covers, when they live in object storage rather than on
 * this host. Empty when covers are same-origin, in which case a preconnect would
 * be a wasted connection to ourselves.
 *
 * Read here rather than at each use so the `NEXT_PUBLIC_` name appears once —
 * these are inlined at build time, and a typo'd one silently becomes undefined.
 */
export const MEDIA_ORIGIN = (process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "").trim().replace(/\/+$/, "");
