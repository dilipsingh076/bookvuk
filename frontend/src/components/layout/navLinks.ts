/**
 * The customer's main navigation, as data.
 *
 * One list, two presentations: the pill row on a wide screen and the drawer on a
 * phone. Written out twice they would drift — a link added to one and forgotten
 * in the other is invisible to exactly the half of visitors who use that layout.
 */

export type NavLink = {
  href: string;
  label: string;
  /** Match this path only, not everything under it. */
  exact?: boolean;
  /** Extra paths that should light this link up. `/books/<id>` is still "Shop". */
  alsoActiveUnder?: string[];
};

export const CUSTOMER_NAV: NavLink[] = [
  { href: "/home", label: "Home", exact: true },
  { href: "/about", label: "About us" },
  // A book's own page belongs to the shop, so the tab stays lit while reading one.
  { href: "/browse", label: "Shop", alsoActiveUnder: ["/books/"] },
  /* Top-level rather than buried in the account menu: selling is a reason to
     visit at all, not something you do once already signed in. */
  { href: "/sell", label: "Sell books" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
];

/** Whether `pathname` should light this link up. */
export const navLinkIsActive = (link: NavLink, pathname: string): boolean => {
  if (link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)) {
    return true;
  }
  return (link.alsoActiveUnder ?? []).some((prefix) => pathname.startsWith(prefix));
};
