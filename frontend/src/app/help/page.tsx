import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Help from "@/views/Help";

export const metadata: Metadata = pageMetadata({
  title: "Help & Support \u2014 Browsing, Cart, Wishlist and Your Account",
  description:
    "Quick answers for using BookVuk: finding books by title or author, filtering by category, saving to your wishlist, and managing your cart and account.",
  path: "/help",
});

const Page = () => (
  <Help />
);

export default Page;
