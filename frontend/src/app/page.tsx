import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import Landing from "@/views/Landing";
import JsonLd from "@/components/JsonLd";
import { LOGO_ICON_SRC } from "@/components/ui/BrandLogo";
import { storeSchema } from "@/lib/schema";
import { fetchCatalogFacets, fetchCategories, fetchTrending } from "@/api/index";
import { SITE_URL } from "@/lib/site";


export const metadata: Metadata = pageMetadata({
  title: "Buy & Sell Books Online in India \u2014 English & Hindi | BookVuk",
  description:
    "Buy new and second-hand books in English and Hindi, or sell your old books back for store credit. 200 titles in fiction, business, history and Hindi literature.",
  path: "/",
  // The shopfront names the brand itself; the template would read "BookVuk · BookVuk".
  absoluteTitle: true,
});

// The shelf and the counts change with the catalogue, not with the visitor.
export const revalidate = 1800;

// Keep in step with SHELF_SIZE in views/Landing.tsx, or the first paint shows a
// different number of books than the second.
const SHELF_SIZE = 8;

const Page = async () => {
  const [initialShelf, initialCategories, initialFacets] = await Promise.all([
    fetchTrending(SHELF_SIZE, 7).catch(() => null),
    fetchCategories().catch(() => null),
    fetchCatalogFacets().catch(() => null),
  ]);

  return (
  <>
    {/* The shop as an entity, plus the search box that can appear in results.
        Only the home page publishes this — one site-level graph per site. It is
        in the HTML now rather than appended by an effect, so the crawlers that do
        not run JavaScript can read it. */}
    <JsonLd
      data={storeSchema({
        siteUrl: SITE_URL,
        name: "BookVuk",
        /* This is the sentence a search engine attaches to "BookVuk" as an
           entity, so it should name the thing that distinguishes the shop:
           books go both ways here. The old wording described a bookshop like
           any other. */
        description:
          "An online bookshop for new and second-hand books in English and Hindi, which also buys books back from readers for store credit. Delivered across India.",
        logoPath: LOGO_ICON_SRC,
        supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bookvuk.com",
      })}
    />
    <Landing
      initialShelf={initialShelf}
      initialCategories={initialCategories}
      initialFacets={initialFacets}
    />
  </>
  );
};

export default Page;
