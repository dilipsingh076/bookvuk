import type { Metadata } from "next";
import Settings from "@/views/Settings";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Settings",
};

const Page = () => (
  <RoleRouteGuard variant="authenticatedOnly" signInPrompt="your settings">
    <Settings />
  </RoleRouteGuard>
);

export default Page;
