import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Sell from "@/views/Sell";
import JsonLd from "@/components/JsonLd";
import { buybackServiceSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";


export const metadata: Metadata = pageMetadata({
  title: "Sell Old Books Online \u2014 Get an Instant Quote",
  description:
    "Tell us which book you have and see the price straight away \u2014 no account needed to look. Get 60\u201370% of cover price as store credit and spend it on your next read.",
  path: "/sell",
  keywords: [
    "sell old books online",
    "sell used books india",
    "sell textbooks online",
    "book resale value",
    "exchange old books",
  ],
});

const Page = () => (
  <>
    <JsonLd data={buybackServiceSchema({ siteUrl: SITE_URL })} />
    <Sell />
  </>
);

export default Page;
