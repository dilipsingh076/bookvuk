import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* Moved off the API and onto the storefront itself.
 *
 * It lived on FastAPI because the old frontend was a folder of static files with
 * no way to generate anything, so nginx proxied these two paths across. Next
 * serves them from the site's own origin directly, which removes the proxy hop
 * and the risk that the two hosts disagree about where the sitemap is.
 */

const robots = (): MetadataRoute.Robots => ({
  rules: {
    userAgent: "*",
    allow: "/",
    disallow: [
      "/admin",
      "/cart",
      "/checkout",
      "/orders",
      "/profile",
      "/settings",
      "/wishlist",
      "/reset-password",
      // `/sell` itself is public — the quote form is how a seller starts. Only
      // the list of what somebody has offered us is private.
      "/sell/requests",
      // Both render as a dialog over the shopfront, so they have nothing of
      // their own to index and would compete with "/" if crawled.
      "/login",
      "/register",
    ],
  },
  sitemap: `${SITE_URL}/sitemap.xml`,
});

export default robots;
