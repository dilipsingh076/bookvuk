import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import Authors from "@/views/Authors";
import { fetchAuthors } from "@/api/index";
import JsonLd from "@/components/JsonLd";
import { collectionSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";


export const metadata: Metadata = pageMetadata({
  title: "Books by Author \u2014 Browse Every Author We Stock",
  description:
    "Every one of the 97 authors in the BookVuk catalogue, English and Hindi, with all their titles in stock on one page.",
  path: "/authors",
  keywords: [
    "books by author",
    "hindi authors books",
    "indian authors books online",
  ],
});

// The author list changes only when the catalogue does.
export const revalidate = 1800;

const Page = async () => {
  const initialAuthors = await fetchAuthors().catch(() => null);
  return (
    <>
      {initialAuthors?.length ? (
        <JsonLd
          data={collectionSchema({
            siteUrl: SITE_URL,
            path: "/authors",
            name: "Books by author",
            description: "Every author stocked at BookVuk and how many titles we carry.",
            items: initialAuthors.map((a) => ({
              name: a.name,
              url: `/authors/${a.slug}`,
            })),
          })}
        />
      ) : null}
      <Authors initialAuthors={initialAuthors} />
    </>
  );
};

export default Page;
