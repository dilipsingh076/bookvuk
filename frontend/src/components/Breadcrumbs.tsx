import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

/* A BreadcrumbList, rendered on the server.
 *
 * `BreadcrumbList` is what makes a search result read
 * "bookvuk.com › Authors › मुंशी प्रेमचंद" instead of a bare URL, and it tells a
 * crawler how the site nests. Two segment layouts had built the same graph by
 * hand; this is that, once.
 */
const Breadcrumbs = ({ trail }: { trail: Array<{ name: string; path: string }> }) => (
  <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, ...trail], SITE_URL)} />
);

export default Breadcrumbs;
