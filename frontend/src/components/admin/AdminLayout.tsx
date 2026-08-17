import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

type AdminNavKey =
  | "dashboard"
  | "books"
  | "categories"
  | "authors"
  | "inventory"
  | "orders"
  | "notifications";

type AdminLayoutProps = {
  active: AdminNavKey;
  children: ReactNode;
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
    isActive ? "bg-booknest-purple text-white" : "text-booknest-navy hover:bg-booknest-lilac"
  }`;

const AdminLayout = ({ active, children }: AdminLayoutProps) => {
  const nav: Array<{ key: AdminNavKey; label: string; to: string }> = [
    { key: "dashboard", label: "Dashboard", to: "/admin" },
    { key: "books", label: "Books", to: "/admin/books" },
    { key: "categories", label: "Categories", to: "/admin/categories" },
    { key: "authors", label: "Authors", to: "/admin/authors" },
    { key: "inventory", label: "Inventory", to: "/admin/inventory" },
    { key: "orders", label: "Orders", to: "/admin/orders" },
    { key: "notifications", label: "Notifications", to: "/admin/notifications" },
  ];

  return (
    <div className="mt-6 grid min-h-[calc(100vh-7.5rem)] grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="self-stretch rounded-2xl bg-white p-4 ring-1 ring-booknest-navy/[0.06]">
        <div className="flex items-center gap-2 px-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-booknest-lilac text-booknest-navy">
            B
          </span>
          <div className="text-sm font-bold text-booknest-navy">BookNest</div>
        </div>
        <div className="mt-4 px-2">
          <div className="rounded-lg bg-booknest-lilac px-3 py-2 text-xs font-semibold text-booknest-purple">
            Admin workspace
          </div>
        </div>

        <div className="mt-6">
          <div className="px-2 text-xs font-semibold text-booknest-muted">Overview</div>
          <div className="mt-2 space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.key === "dashboard"}
                className={({ isActive }) => sidebarLinkClass(isActive || active === item.key)}
              >
                <IconBox>
                  <SidebarIcon kind={item.key} />
                </IconBox>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </aside>

      <section className="min-w-0">{children}</section>
    </div>
  );
};

export default AdminLayout;

