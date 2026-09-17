import Breadcrumbs from "@/components/Breadcrumbs";

/* `/browse` is the page every category link points at and the one a shopper is
 * most likely to reach from a search, so its place in the site is worth stating. */
const Layout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Breadcrumbs trail={[{ name: "Books", path: "/browse" }]} />
    {children}
  </>
);

export default Layout;
