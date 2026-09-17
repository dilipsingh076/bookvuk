import type { Metadata } from "next";
import Inventory from "@/views/Admin/Inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

const Page = () => (
    <Inventory />
);

export default Page;
