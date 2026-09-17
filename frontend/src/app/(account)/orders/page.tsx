import type { Metadata } from "next";
import Orders from "@/views/Orders";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Your orders",
};

const Page = () => (
  <RoleRouteGuard variant="customerRoutes" signInPrompt="your orders">
    <Orders />
  </RoleRouteGuard>
);

export default Page;
