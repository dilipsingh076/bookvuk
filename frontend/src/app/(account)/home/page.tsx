import type { Metadata } from "next";
import Home from "@/views/Home";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Home",
};

const Page = () => (
  <RoleRouteGuard variant="authenticatedOnly" signInPrompt="your home shelf">
    <Home />
  </RoleRouteGuard>
);

export default Page;
