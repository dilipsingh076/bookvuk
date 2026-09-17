import type { Metadata } from "next";
import Categories from "@/views/Admin/Categories";

export const metadata: Metadata = {
  title: "Categories",
};

const Page = () => (
    <Categories />
);

export default Page;
