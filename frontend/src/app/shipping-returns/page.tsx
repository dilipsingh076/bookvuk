import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import ShippingReturns from "@/views/legal/ShippingReturns";

export const metadata: Metadata = pageMetadata({
  title: "Shipping and Returns \u2014 Delivery, Charges and Refunds",
  description:
    "What shipping costs, when your order arrives, and how returns and refunds work at BookVuk. Flat per-order charge, shown at checkout before you pay.",
  path: "/shipping-returns",
});

const Page = () => <ShippingReturns />;

export default Page;
