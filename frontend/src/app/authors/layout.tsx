import Breadcrumbs from "@/components/Breadcrumbs";

/* Applies to the author list and all 97 author pages beneath it. The trail stops
 * here because a layout does not know which author is below it — the page appends
 * its own leaf. */
const Layout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Breadcrumbs trail={[{ name: "Authors", path: "/authors" }]} />
    {children}
  </>
);

export default Layout;
