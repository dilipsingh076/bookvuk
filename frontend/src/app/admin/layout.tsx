import type { Metadata } from "next";

import AdminLayout from "@/components/admin/AdminLayout";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";

/* The admin shell, hoisted out of the seven pages that each rendered it.
 *
 * This is what a segment layout is for, and it is not only tidier: a layout is
 * not remounted when you navigate within its segment, so the sidebar no longer
 * unmounts and rebuilds on every click between admin screens. The guard moves up
 * with it, so each page no longer restates who is allowed in.
 */
/* Metadata declared once for the whole segment.
 *
 * A layout is a server component, so it can own everything its pages share —
 * and `robots` is the clearest case: eight admin pages each repeated the same
 * directive, which is eight chances to forget it on the ninth. Titles stay
 * per-page; this only sets what they all agree on.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · BookVuk" },
  robots: { index: false, follow: false },
};

const Layout = ({ children }: { children: React.ReactNode }) => (
  <RoleRouteGuard variant="adminOnly">
    <AdminLayout>{children}</AdminLayout>
  </RoleRouteGuard>
);

export default Layout;
