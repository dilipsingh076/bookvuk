import type { Metadata } from "next";
import Checkout from "@/views/Checkout";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Checkout",
};

const Page = () => (
  <RoleRouteGuard variant="customerRoutes" signInPrompt="your checkout">
    <Checkout />
  </RoleRouteGuard>
);

export default Page;
