import type { Metadata } from "next";
import Buyback from "@/views/Admin/Buyback";

export const metadata: Metadata = {
  title: "Buyback",
};

const Page = () => <Buyback />;

export default Page;
