import type { Metadata } from "next";

import ResetPasswordDialog from "./ResetPasswordDialog";

export const metadata: Metadata = {
  title: "Reset password",
  // Reached from a link in an e-mail, not from search.
  robots: { index: false, follow: false },
};

const Page = () => <ResetPasswordDialog />;

export default Page;
