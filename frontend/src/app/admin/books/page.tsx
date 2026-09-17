import type { Metadata } from "next";
import ManageBooks from "@/views/Admin/ManageBooks";

export const metadata: Metadata = {
  title: "Books",
};

const Page = () => (
    <ManageBooks />
);

export default Page;
