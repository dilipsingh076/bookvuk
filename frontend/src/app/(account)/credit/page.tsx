import type { Metadata } from "next";
import Credit from "@/views/Credit";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Store credit",
};

const Page = () => (
  <RoleRouteGuard variant="customerRoutes" signInPrompt="your store credit">
    <Credit />
  </RoleRouteGuard>
);

export default Page;
