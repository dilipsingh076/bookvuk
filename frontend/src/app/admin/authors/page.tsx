import type { Metadata } from "next";
import ManageAuthors from "@/views/Admin/ManageAuthors";

export const metadata: Metadata = {
  title: "Authors",
};

const Page = () => (
    <ManageAuthors />
);

export default Page;
