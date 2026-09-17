import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Privacy from "@/views/legal/Privacy";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy \u2014 What We Store and Why",
  description:
    "What BookVuk keeps about you, why each item is needed to run the shop, and what we never store at all.",
  path: "/privacy",
});

const Page = () => <Privacy />;

export default Page;
