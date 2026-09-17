import type { Metadata } from "next";
import Orders from "@/views/Admin/Orders";

export const metadata: Metadata = {
  title: "Orders",
};

const Page = () => (
    <Orders />
);

export default Page;
