import type { Metadata } from "next";
import SellRequests from "@/views/SellRequests";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "My sell requests",
};

const Page = () => (
  <RoleRouteGuard variant="customerRoutes" signInPrompt="your sell requests">
    <SellRequests />
  </RoleRouteGuard>
);

export default Page;
