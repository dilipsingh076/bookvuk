import type { Metadata } from "next";
import Customers from "@/views/Admin/Customers";

export const metadata: Metadata = {
  title: "Customers",
};

const Page = () => <Customers />;

export default Page;
