import type { Metadata } from "next";
import Demand from "@/views/Admin/Demand";

export const metadata: Metadata = {
  title: "What to buy",
};

const Page = () => <Demand />;

export default Page;
