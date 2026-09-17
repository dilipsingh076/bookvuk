"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import useActivePath from "../../hooks/useActivePath";
import useFetch from "../../hooks/useFetch";
import { fetchAdminQueue, type AdminQueueCounts } from "../../api/admin";

type AdminNavKey =
  | "dashboard"
  | "books"
  | "categories"
  | "authors"
  | "inventory"
  | "orders"
  | "customers"
  | "demand"
  | "returns"
  | "buyback"
  | "coupons"
  | "notifications"
  | "settings";

type AdminLayoutProps = {
  /** Optional now. Hoisted into `app/admin/layout.tsx`, which has no props from
   *  the route, so the active item is derived from the URL instead. Still
   *  accepted for the odd caller that wants to force it. */
  active?: AdminNavKey;
  children: ReactNode;
};

/** Which nav item the current URL belongs to. */
const activeFromPath = (pathname: string): AdminNavKey => {
  const seg = pathname.replace(/^\/admin\/?/, "").split("/")[0];
  const map: Record<string, AdminNavKey> = {
    "": "dashboard",
    books: "books",
    categories: "categories",
    authors: "authors",
    inventory: "inventory",
    orders: "orders",
    customers: "customers",
    demand: "demand",
    returns: "returns",
    buyback: "buyback",
    coupons: "coupons",
    notifications: "notifications",
    settings: "settings",
  };
  return map[seg] ?? "dashboard";
};

const IconBox = ({ children }: { children: ReactNode }) => {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-current">
      {children}
    </span>
  );
};

const SidebarIcon = ({ kind }: { kind: AdminNavKey }) => {
  if (kind === "dashboard") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2 4 4 6-6 2 2v10H3V12Z"
        />
      </svg>
    );
  }
  if (kind === "books") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 4h10v16H7a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20h10" />
      </svg>
    );
  }
  if (kind === "authors") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 11a4 4 0 1 0-8 0v2h8v-2Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 21c.7-3.6 3.5-6 8-6s7.3 2.4 8 6"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8l3 3-3 3" />
      </svg>
    );
  }
  if (kind === "categories") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 4h12v6H6V4Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 14h12v6H6v-6Z"
        />
      </svg>
    );
  }
  if (kind === "inventory") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7H4l8-4 8 4Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 7v10l8 4 8-4V7"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h8" />
      </svg>
    );
  }
  if (kind === "returns") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 9h11a5 5 0 0 1 0 10H8"
        />
      </svg>
    );
  }
  if (kind === "demand") {
    /* A magnifying glass over a gap — what was looked for and not found. */
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="6" />
        <path strokeLinecap="round" d="M20 20l-4.5-4.5" />
        <path strokeLinecap="round" d="M9 11h4" />
      </svg>
    );
  }
  if (kind === "customers") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 20c.6-3.2 3.4-5 8-5s7.4 1.8 8 5"
        />
      </svg>
    );
  }
  if (kind === "buyback") {
    /* A book with an arrow coming back in — stock returning to the shop, which
       is what buyback is. Distinct from Returns, whose arrow is about an order
       coming back to us. */
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V6a2 2 0 0 1 2-2h9v16H6a2 2 0 0 0-2 2Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 9l-3 3 3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 12h-3" />
      </svg>
    );
  }
  if (kind === "coupons") {
    /* A price tag. */
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
        <circle cx="7.5" cy="7.5" r="1.25" />
      </svg>
    );
  }
  if (kind === "settings") {
    /* Sliders, not a cog: these are values you set, not machinery. */
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="8" cy="17" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "notifications") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.73 21a2 2 0 0 1-3.46 0"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 6h13l-2 9H6L4 4h4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  );
};

const sidebarLinkClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${
    isActive ? "bg-bookvuk-purple text-white" : "text-bookvuk-navy hover:bg-bookvuk-lilac"
  }`;

/* Three groups, not one list of twelve.
 *
 * The sidebar said "Overview" above everything, including Store settings, which
 * is not an overview of anything. Twelve equal-weight links with one meaningless
 * heading is a list you read every time instead of a map you learn once.
 *
 * The split is by *when* you use them: the queues are today's work, the
 * catalogue is what you edit occasionally, and the rest is set up once and left.
 */
const SECTIONS: Array<{ title: string; items: Array<{ key: AdminNavKey; label: string; to: string }> }> = [
  {
    title: "Today",
    items: [
      { key: "dashboard", label: "Dashboard", to: "/admin" },
      { key: "orders", label: "Orders", to: "/admin/orders" },
      { key: "returns", label: "Returns", to: "/admin/returns" },
      { key: "buyback", label: "Buyback", to: "/admin/buyback" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { key: "books", label: "Books", to: "/admin/books" },
      { key: "inventory", label: "Inventory", to: "/admin/inventory" },
      { key: "demand", label: "What to buy", to: "/admin/demand" },
      { key: "categories", label: "Categories", to: "/admin/categories" },
      { key: "authors", label: "Authors", to: "/admin/authors" },
    ],
  },
  {
    title: "Shop",
    items: [
      { key: "customers", label: "Customers", to: "/admin/customers" },
      { key: "coupons", label: "Discount codes", to: "/admin/coupons" },
      { key: "notifications", label: "Notifications", to: "/admin/notifications" },
      { key: "settings", label: "Store settings", to: "/admin/settings" },
    ],
  },
];

/** Which queue each nav item is waiting on, so the badge is one lookup. */
const PENDING: Partial<Record<AdminNavKey, (q: AdminQueueCounts) => number>> = {
  orders: (q) => q.orders_to_fulfil + q.cash_to_collect,
  returns: (q) => q.returns_to_decide + q.returns_to_refund,
  buyback: (q) => q.buyback_to_review + q.buyback_to_pay,
};

const AdminLayout = ({ active, children }: AdminLayoutProps) => {
  const { pathname, isActive, activeProps } = useActivePath();
  const current = active ?? activeFromPath(pathname);

  /* How much work is waiting, on the nav itself.
   *
   * Without it the only way to learn that three returns need deciding is to open
   * Returns and look — so the queue that nobody thinks to check is the queue
   * that sits. 83 bytes, cached for a minute, shared with the dashboard.
   */
  const { data: queue } = useFetch<AdminQueueCounts>(() => fetchAdminQueue(), [pathname], {
    cacheKey: "admin-queue",
    ttlMs: 60_000,
  });

  return (
    <div className="mt-6 grid min-h-[calc(100vh-7.5rem)] grid-cols-1 gap-6 lg:grid-cols-[232px_1fr]">
      <aside className="min-w-0 self-start rounded-2xl bg-white p-3 ring-1 ring-bookvuk-navy/[0.06] lg:sticky lg:top-24">
        {/* One row, not two. "BookVuk" over "Admin workspace" spent the top of
            every screen restating where you already are. */}
        <div className="hidden items-center gap-2.5 px-2 py-1.5 lg:flex">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bookvuk-purple text-sm font-bold text-white">
            B
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-bookvuk-navy">
              BookVuk
            </div>
            <div className="text-[11px] font-semibold leading-tight text-bookvuk-purple">
              Admin
            </div>
          </div>
        </div>

        {/* One scrolling row below `lg`, a grouped column above it.
            Stacked, the twelve links pushed every page's content a screen and a
            half down — on a phone you scrolled past the whole nav to reach the
            thing you opened. The row is the same shape the storefront's own nav
            uses at that width. */}
        <nav
          className="mt-3 flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:mt-3 lg:block lg:space-y-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden"
          aria-label="Admin sections"
        >
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex shrink-0 gap-1 lg:block lg:shrink">
              <div className="hidden px-2 text-[11px] font-bold uppercase tracking-wider text-bookvuk-muted/70 lg:block">
                {section.title}
              </div>
              <div className="flex gap-1 lg:mt-1.5 lg:block lg:space-y-0.5">
                {section.items.map((item) => {
                  const on =
                    isActive(item.to, item.key === "dashboard") || current === item.key;
                  const waiting = queue ? PENDING[item.key]?.(queue) ?? 0 : 0;
                  return (
                    <Link
                      key={item.key}
                      href={item.to}
                      aria-current={
                        activeProps(item.to, { exact: item.key === "dashboard" })["aria-current"]
                      }
                      className={sidebarLinkClass(on)}
                    >
                      <IconBox>
                        <SidebarIcon kind={item.key} />
                      </IconBox>
                      <span className="whitespace-nowrap lg:min-w-0 lg:flex-1 lg:truncate">
                        {item.label}
                      </span>
                      {waiting > 0 ? (
                        <span
                          /* The count is the point, so it is not decorative —
                             it has to be read out too. */
                          aria-label={`${waiting} waiting`}
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                            on ? "bg-white/20 text-white" : "bg-bookvuk-purple/10 text-bookvuk-purple"
                          }`}
                        >
                          {waiting}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <section className="min-w-0">{children}</section>
    </div>
  );
};

export default AdminLayout;
