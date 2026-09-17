import type { Metadata } from "next";
import Coupons from "@/views/Admin/Coupons";

export const metadata: Metadata = {
  title: "Discount codes",
};

const Page = () => <Coupons />;

export default Page;
