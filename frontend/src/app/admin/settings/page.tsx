import type { Metadata } from "next";
import StoreSettings from "@/views/Admin/StoreSettings";

export const metadata: Metadata = {
  title: "Store settings",
};

const Page = () => <StoreSettings />;

export default Page;
