import type { Metadata } from "next";
import Profile from "@/views/Profile";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

export const metadata: Metadata = {
  title: "Your profile",
};

const Page = () => (
  <RoleRouteGuard variant="authenticatedOnly" signInPrompt="your profile">
    <Profile />
  </RoleRouteGuard>
);

export default Page;
