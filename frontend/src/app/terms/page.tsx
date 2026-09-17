import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Terms from "@/views/legal/Terms";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service \u2014 Buying, Selling and Cancellations",
  description:
    "The terms you agree to when you buy a book, sell one back to us, or cancel an order at BookVuk.",
  path: "/terms",
});

const Page = () => <Terms />;

export default Page;
