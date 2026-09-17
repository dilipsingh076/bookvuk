import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Contact from "@/views/Contact";

export const metadata: Metadata = pageMetadata({
  title: "Contact BookVuk \u2014 Order and Account Support",
  description:
    "Email or call the BookVuk team about an order, your account or selling your books. Typical reply within 1\u20132 business days.",
  path: "/contact",
});

const Page = () => (
  <Contact />
);

export default Page;
