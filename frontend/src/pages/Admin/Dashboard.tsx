import useFetch from "../../hooks/useFetch";
import Loader from "../../components/ui/Loader";
import {
  fetchAdminDashboardOverview,
  type AdminDashboardOverviewCard,
} from "../../api/admin";
import AdminLayout from "../../components/admin/AdminLayout";

const Dashboard = () => {
  const {
    data: overview,
    loading,
    error,
  } = useFetch<AdminDashboardOverviewCard[]>(
    () => fetchAdminDashboardOverview(),
    [],
  );

  return (
    <AdminLayout active="dashboard">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-white p-5 ring-1 ring-booknest-navy/[0.06]">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-xl font-extrabold text-booknest-navy">
                BookNest admin panel
              </div>
              <div className="mt-1 text-sm text-booknest-muted">
                Manage books, authors, and inventory from a single dashboard.
                This screen is for the admin after login, not for regular users
                browsing the bookstore.
              </div>
            </div>

            <div className="flex items-center gap-3 whitespace-nowrap">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-booknest-border bg-white px-4 py-2 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
              >
                <span aria-hidden>⤓</span> Export report
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
              >
                <span aria-hidden>+</span> Add book
              </button>
            </div>
          </div>
        </div>

        {/* Store overview cards */}
        <div className="rounded-2xl bg-white p-5 ring-1 ring-booknest-navy/[0.06]">
          <div className="text-sm font-extrabold text-booknest-navy">
            Store overview
          </div>
          <div className="mt-1 text-sm text-booknest-muted">
            Monitor inventory health, author count, and active orders at a
            glance.
          </div>

          {loading ? (
            <div className="mt-6 flex justify-center">
              <Loader />
            </div>
          ) : error ? (
            <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              {(error as { message?: string } | undefined)?.message ||
                "Failed to load overview"}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(overview || []).map((o) => (
                <div key={o.title} className="rounded-xl bg-booknest-lilac p-4">
                  <div className="text-sm font-semibold text-booknest-navy">
                    {o.title}
                  </div>
                  <div className="mt-2 text-3xl font-extrabold text-booknest-navy">
                    {o.value}
                  </div>
                  <div className="mt-1 text-xs text-booknest-muted">
                    {o.sub}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Books management */}
        <div className="rounded-2xl bg-white p-5 ring-1 ring-booknest-navy/[0.06]">
          <div className="text-sm font-extrabold text-booknest-navy">
            Books management
          </div>
          <div className="mt-1 text-sm text-booknest-muted">
            Add, edit, delete, and manage inventory for books available in the
            store.
          </div>

          <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-booknest-navy/[0.06]">
            <input
              placeholder="Search by title or author"
              className="w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-booknest-lilac px-3 py-2 font-semibold text-booknest-navy">
                Category: Fiction
              </span>
              <span className="rounded-full bg-booknest-lilac px-3 py-2 font-semibold text-booknest-navy">
                Stock: All
              </span>
              <span className="rounded-full bg-booknest-lilac px-3 py-2 font-semibold text-booknest-navy">
                Rating: 4.0+
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-booknest-navy/[0.06]">
            <div className="grid grid-cols-12 bg-booknest-lilac px-5 py-3 text-xs font-semibold text-booknest-muted">
              <div className="col-span-6">Book</div>
              <div className="col-span-3">Price</div>
              <div className="col-span-3">Stock</div>
            </div>
            <div className="divide-y">
              {[
                {
                  title: "The Silent Library",
                  author: "Emma Clark",
                  cat: "Fiction",
                  price: "$24.99",
                  stock: "16",
                },
                {
                  title: "Build Faster with GraphQL",
                  author: "Daniel Reed",
                  cat: "Technology",
                  price: "$32.00",
                  stock: "5",
                },
                {
                  title: "Small Steps Every Day",
                  author: "Sophia Bennett",
                  cat: "Self Growth",
                  price: "$18.50",
                  stock: "48",
                },
              ].map((row) => (
                <div
                  key={row.title}
                  className="grid grid-cols-12 gap-2 px-5 py-4 text-sm"
                >
                  <div className="col-span-6">
                    <div className="font-semibold text-booknest-navy">
                      {row.title}
                    </div>
                    <div className="mt-1 text-xs text-booknest-muted">
                      by {row.author}
                    </div>
                  </div>
                  <div className="col-span-3 font-semibold text-booknest-navy">
                    {row.price}
                  </div>
                  <div className="col-span-3 text-xs text-booknest-muted">
                    <div className="font-semibold text-booknest-navy">
                      {row.stock}
                    </div>
                    <div>In stock</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom left CTA card (sits under books mgmt in the screenshot) */}
          <div className="mt-6 rounded-xl bg-booknest-lilac p-4">
            <div className="text-sm font-extrabold text-booknest-navy">
              Need to add a new title?
            </div>
            <div className="mt-1 text-xs text-booknest-muted">
              Quickly create books, assign authors, and update stock in one
              place.
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
            >
              <span aria-hidden>+</span> Add new book
            </button>
          </div>
        </div>
        </section>

        <aside className="space-y-6">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-booknest-navy/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-extrabold text-booknest-navy">
                Authors
              </div>
              <div className="mt-1 text-sm text-booknest-muted">
                Manage author profiles connected to your books.
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg bg-booknest-lilac px-3 py-2 text-sm font-semibold text-booknest-navy ring-1 ring-booknest-border hover:bg-booknest-lilac whitespace-nowrap"
            >
              Add author
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {[
              { name: "Emma Clark", books: "12", status: "Active" },
              { name: "Daniel Reed", books: "8", status: "Active" },
              { name: "Sophia Bennett", books: "5", status: "Draft" },
            ].map((a) => (
              <div
                key={a.name}
                className="flex items-center justify-between rounded-xl bg-booknest-lilac p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-booknest-navy">
                    {a.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-booknest-navy">
                      {a.name}
                    </div>
                    <div className="mt-1 text-xs text-booknest-muted">
                      {a.books} books published • Literature...
                    </div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    a.status === "Active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-booknest-navy/[0.06]">
          <div className="text-sm font-extrabold text-booknest-navy">
            Inventory trend
          </div>
          <div className="mt-1 text-sm text-booknest-muted">
            Weekly stock movement for top-selling books.
          </div>
          <div className="mt-4 flex h-[160px] items-end gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const heights = [64, 44, 58, 48, 62, 54, 70];
              const h = heights[i] ?? 50;
              const heightClass =
                h >= 70
                  ? "h-16"
                  : h >= 64
                    ? "h-14"
                    : h >= 58
                      ? "h-12"
                      : h >= 54
                        ? "h-11"
                        : h >= 48
                          ? "h-10"
                          : "h-9";
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-8 rounded ${heightClass} ${
                      i % 2 === 0 ? "bg-booknest-purple" : "bg-booknest-navy"
                    }`}
                  />
                  <div className="text-[11px] text-booknest-muted">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-booknest-navy/[0.06]">
          <div className="text-sm font-extrabold text-booknest-navy">
            Quick actions
          </div>
          <div className="mt-1 text-sm text-booknest-muted">
            Common admin tasks for daily inventory management.
          </div>

          <div className="mt-4 space-y-3">
            {[
              {
                title: "Update low-stock titles",
                sub: "Review books with fewer than 10 copies remaining and restock them.",
              },
              {
                title: "Create a new author profile",
                sub: "Add biography, profile photo, and link books to the selected author.",
              },
              {
                title: "Review recent orders",
                sub: "Check successful purchases and verify stock updates after checkout.",
              },
            ].map((x) => (
              <div
                key={x.title}
                className="rounded-xl bg-booknest-lilac px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-booknest-navy">
                      {x.title}
                    </div>
                    <div className="mt-1 text-xs text-booknest-muted">
                      {x.sub}
                    </div>
                  </div>
                  <span className="text-booknest-muted" aria-hidden>
                    →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        </aside>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
