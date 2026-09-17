import type { Metadata } from "next";

import NotFound from "@/views/NotFound";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/* A real 404 with a real status code. The router this replaces sent unknown
 * paths to "/" with a 200, which hid broken links from us and told crawlers the
 * page existed. */
const Page = () => <NotFound />;

export default Page;
