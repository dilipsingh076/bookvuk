import type { Metadata } from "next";

/* Everything behind a sign-in.
 *
 * A route group — the folder name is in parentheses — so these keep their URLs:
 * `/cart`, `/orders`, `/profile`. It exists only to give them a shared server
 * component, which is where the one thing they all agree on belongs.
 *
 * Eight pages each declared the same `robots` directive. That is not repetition
 * for its own sake: it is eight chances to forget it on the ninth page, and a
 * signed-in page that leaks into an index exposes somebody's order history.
 * Declared once, inherited by every page under it.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export default Layout;
