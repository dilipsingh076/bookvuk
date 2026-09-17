import type { Metadata } from "next";
import AdminNotifications from "@/views/Admin/Notifications";

export const metadata: Metadata = {
  title: "Notifications",
};

const Page = () => (
    <AdminNotifications />
);

export default Page;
