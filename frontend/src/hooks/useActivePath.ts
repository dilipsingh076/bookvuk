"use client";

import { usePathname } from "next/navigation";

/* What `NavLink` did, which `next/link` does not.
 *
 * Two behaviours have to be reproduced, not one. The obvious half is the active
 * class. The half that is easy to lose is `aria-current="page"`, which NavLink
 * set for free — without it a screen reader cannot tell which item in the nav is
 * the page you are on, so `activeProps` returns both together and call sites
 * cannot take the styling and forget the semantics.
 *
 * `exact` is NavLink's `end`: by default a link is active for its own path and
 * everything under it (so /admin/books lights up /admin), and `exact` restricts
 * it to the path itself.
 */
type ActivePropsOptions = {
  /** Match this path only, not everything under it. NavLink's `end`. */
  exact?: boolean;
  /** Class applied when the link is the current page. */
  active?: string;
  /** Class applied otherwise. */
  inactive?: string;
};

export const useActivePath = () => {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) => {
    // Compare paths only; a link carrying a query string still points at its page.
    const path = href.split(/[?#]/)[0];
    if (exact || path === "/") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  /** Props to spread onto a nav link: `aria-current`, and the matching class.
   *
   * Everything returned here has to be a real DOM attribute, because call sites
   * spread it. It used to include `active: boolean`, which React then tried to
   * write to the `<a>` and warned about ("Received `false` for a non-boolean
   * attribute"). The caller needed that flag only to pick a class name — so the
   * class names come in instead and the flag never leaves the hook.
   *
   * Taking the classes also collapses the double call the old shape forced:
   * `{...activeProps(href)} className={activeProps(href).active ? … : …}`
   * evaluated the same match twice per link, which is two chances to disagree.
   */
  const activeProps = (
    href: string,
    { exact = false, active, inactive }: ActivePropsOptions = {},
  ) => {
    const on = isActive(href, exact);
    return {
      "aria-current": on ? ("page" as const) : undefined,
      className: on ? active : inactive,
    };
  };

  return { pathname, isActive, activeProps };
};

export default useActivePath;
