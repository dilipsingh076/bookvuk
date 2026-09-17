import type { Metadata } from "next";

import AuthDialog from "@/components/auth/AuthDialog";

export const metadata: Metadata = {
  title: "Create account",
  // Renders as a dialog over the shopfront, so it has nothing of its own to
  // index and would compete with "/" if crawled.
  robots: { index: false, follow: false },
};

const Page = () => <AuthDialog view="register" />;

export default Page;
