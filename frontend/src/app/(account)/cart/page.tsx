import type { Metadata } from "next";
import Cart from "@/views/Cart";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Your cart",
};

const Page = () => (
  <RoleRouteGuard variant="redirectAdminsOnUserRoutes">
    <Cart />
  </RoleRouteGuard>
);

export default Page;
