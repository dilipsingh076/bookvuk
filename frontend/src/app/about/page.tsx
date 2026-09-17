import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import About from "@/views/About";

export const metadata: Metadata = pageMetadata({
  title: "About BookVuk \u2014 A Calmer Way to Buy and Sell Books",
  description:
    "Why BookVuk exists: a clear catalogue, honest pricing, a wishlist that sticks, and a checkout that waits until you are ready.",
  path: "/about",
});

const Page = () => (
  <About />
);

export default Page;
