import type { Metadata } from "next";

import OrderDetail from "@/views/OrderDetail";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Order",
};

const Page = () => (
  <RoleRouteGuard variant="customerRoutes" signInPrompt="this order">
    <OrderDetail />
  </RoleRouteGuard>
);

export default Page;
