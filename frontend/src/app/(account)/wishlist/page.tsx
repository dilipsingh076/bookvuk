import type { Metadata } from "next";
import Wishlist from "@/views/Wishlist";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Your wishlist",
};

const Page = () => (
  <RoleRouteGuard variant="customerRoutes" signInPrompt="your wishlist">
    <Wishlist />
  </RoleRouteGuard>
);

export default Page;
