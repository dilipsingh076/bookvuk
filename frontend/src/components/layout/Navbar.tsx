import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAuthModal } from "../../context/AuthModalContext";
import BrandLogo from "../ui/BrandLogo";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useNotifications } from "../../context/NotificationsContext";

type BadgeProps = {
  value: number;
};

const Badge = ({ value }: BadgeProps) => {
  if (!value) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-booknest-purple px-1 text-[10px] font-bold tabular-nums text-white shadow-sm ring-2 ring-white"
      aria-hidden
    >
      {value > 99 ? "99+" : value}
    </span>
  );
};

const Navbar = () => {
  const { openLoginModal } = useAuthModal();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { totalQty } = useCart();
  const { wishlistCount } = useWishlist();
  const {
    items: notificationItems,
    unreadCount,
    markAsRead,
    markAllRead,
  } = useNotifications();
  const pathname = location.pathname;
  const isCustomer = user?.role !== "admin";
  const primaryHomePath = isAuthenticated
    ? isCustomer
      ? "/home"
      : "/admin"
    : "/";
  const onPrimaryHome =
    (isCustomer && pathname === "/home") ||
    (!isCustomer && pathname === "/admin");
  const shopActive =
    isCustomer && (pathname === "/browse" || pathname.startsWith("/books/"));
  const adminBooksActive = !isCustomer && pathname.startsWith("/admin/books");

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notifWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onMouseDown = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (profileMenuRef.current?.contains(target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [profileOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onMouseDown = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (notifWrapRef.current?.contains(target)) return;
      setNotifOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notifOpen]);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    navigate("/");
  };

  const settingsPath = user?.role === "admin" ? "/admin/settings" : "/settings";

  const sortedNotifications = useMemo(
    () =>
      [...notificationItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notificationItems],
  );

  const notificationsTarget = user?.role === "admin" ? "/admin/notifications" : "/orders";

  const navLinkBase =
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 ease-out";
  const navInactive = `${navLinkBase} text-zinc-600 hover:bg-white/95 hover:text-booknest-navy hover:shadow-sm`;
  const navActive = `${navLinkBase} bg-white text-booknest-purple shadow-md ring-1 ring-booknest-border/60`;

  const mainNav = isAuthenticated ? (
    <div
      className="flex max-w-full min-w-0 items-center justify-center gap-0.5 overflow-x-auto rounded-full bg-gradient-to-b from-booknest-lilac/70 to-booknest-lilac/40 p-1 ring-1 ring-booknest-purple/[0.08] [-ms-overflow-style:none] [scrollbar-width:none] md:gap-6 [&::-webkit-scrollbar]:hidden"
      aria-label="Main navigation"
    >
      {isCustomer ? (
        <>
          <NavLink
            to="/home"
            end
            className={({ isActive }) => (isActive ? navActive : navInactive)}
          >
            Home
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) => (isActive ? navActive : navInactive)}
          >
            About us
          </NavLink>
          <Link
            to="/browse"
            aria-current={shopActive ? "page" : undefined}
            className={shopActive ? navActive : navInactive}
          >
            Shop
          </Link>
          <NavLink
            to="/help"
            className={({ isActive }) => (isActive ? navActive : navInactive)}
          >
            Help
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) => (isActive ? navActive : navInactive)}
          >
            Contact
          </NavLink>
        </>
      ) : null}
    </div>
  ) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-booknest-border/80 bg-white/85 shadow-[0_1px_0_rgba(26,29,46,0.04)] backdrop-blur-xl backdrop-saturate-150">
      {isAuthenticated ? (
        <div className="mx-auto grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4 sm:px-5 sm:py-[1.125rem]">
          <div className="flex min-w-0 items-center justify-start">
            <div className="shrink-0">
              {onPrimaryHome ? (
                <button
                  type="button"
                  className="flex items-center font-bold"
                  aria-label="BookNest logo"
                >
                  <BrandLogo />
                </button>
              ) : (
                <Link
                  to={primaryHomePath}
                  className="flex items-center font-bold"
                >
                  <BrandLogo />
                </Link>
              )}
            </div>
          </div>

          <nav className="relative z-10 flex min-w-0 justify-center justify-self-center px-1">
            {mainNav}
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <>
              {user?.role !== "admin" ? (
                <div className="flex items-center gap-1.5">
                  <Link
                    to="/wishlist"
                    className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-booknest-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-booknest-purple/25 hover:bg-booknest-lilac/80 hover:text-booknest-purple hover:shadow-md"
                    aria-label="Wishlist"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      className="h-[1.15rem] w-[1.15rem] transition-transform group-hover:scale-105"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"
                      />
                    </svg>
                    <Badge value={wishlistCount} />
                  </Link>

                  <Link
                    to="/cart"
                    className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-booknest-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-booknest-purple/25 hover:bg-booknest-lilac/80 hover:text-booknest-purple hover:shadow-md"
                    aria-label="Shopping cart"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      className="h-[1.15rem] w-[1.15rem] transition-transform group-hover:scale-105"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                      />
                    </svg>
                    <Badge value={totalQty} />
                  </Link>
                </div>

              ) : null}

              {user?.role !== "admin" ? (
                <div className="sr-only" aria-live="polite" aria-atomic="true">
                  Shopping cart {totalQty} items, wishlist {wishlistCount} items
                </div>
              ) : null}

              <div className="relative" ref={notifWrapRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={notifOpen}
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-booknest-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-booknest-purple/25 hover:bg-booknest-lilac/80 hover:text-booknest-purple hover:shadow-md ${
                    notifOpen ? "border-booknest-purple/30 ring-2 ring-booknest-purple/15" : ""
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[1.2rem] w-[1.2rem]"
                    aria-hidden
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular-nums text-white shadow-sm ring-2 ring-white"
                      aria-hidden
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </button>
                {notifOpen ? (
                  <div
                    role="menu"
                    aria-label="Notifications list"
                    className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-2xl border border-booknest-border/80 bg-white/95 py-1 shadow-xl shadow-booknest-navy/[0.08] ring-1 ring-booknest-navy/[0.04] backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between border-b border-booknest-border/70 px-3 py-2.5">
                      <span className="text-sm font-bold text-booknest-navy">Notifications</span>
                      {unreadCount > 0 ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => markAllRead()}
                          className="text-xs font-semibold text-booknest-purple hover:underline"
                        >
                          Mark all read
                        </button>
                      ) : null}
                    </div>
                    <ul className="max-h-80 overflow-y-auto py-1">
                      {sortedNotifications.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-booknest-muted">
                          No notifications yet
                        </li>
                      ) : (
                        sortedNotifications.map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                markAsRead(n.id);
                                setNotifOpen(false);
                              }}
                              className={`w-full border-b border-booknest-border/40 px-3 py-3 text-left last:border-b-0 hover:bg-booknest-lilac/60 ${
                                n.read ? "opacity-80" : "bg-booknest-lilac/30"
                              }`}
                            >
                              <div className="text-sm font-semibold text-booknest-navy">
                                {n.title}
                              </div>
                              <div className="mt-0.5 text-xs leading-snug text-booknest-muted">
                                {n.body}
                              </div>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="border-t border-booknest-border/70 px-2 py-2">
                      <Link
                        to={notificationsTarget}
                        role="menuitem"
                        className="block rounded-xl px-3 py-2 text-center text-sm font-semibold text-booknest-purple hover:bg-booknest-lilac"
                        onClick={() => setNotifOpen(false)}
                      >
                        View all
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </>

            <div
              className="hidden h-10 w-px shrink-0 bg-gradient-to-b from-transparent via-booknest-border to-transparent sm:block"
              aria-hidden
            />

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 text-right sm:block">
                <div className="truncate text-sm font-semibold leading-tight text-booknest-navy">
                  {user?.name || "Account"}
                </div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-booknest-muted">
                  {user?.role === "admin" ? "Admin" : "Customer"}
                </div>
              </div>
              <div className="relative flex" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-booknest-lilac to-booknest-lilac/60 text-sm font-bold text-booknest-purple shadow-inner ring-2 ring-white ring-offset-2 ring-offset-white transition hover:ring-booknest-purple/25 ${
                    profileOpen ? "ring-booknest-purple/40" : ""
                  }`}
                >
                  {String(user?.name || "A")
                    .slice(0, 1)
                    .toUpperCase()}
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    aria-label="Profile menu"
                    className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-booknest-border/80 bg-white/95 p-1.5 shadow-xl shadow-booknest-navy/[0.08] ring-1 ring-booknest-navy/[0.04] backdrop-blur-sm"
                  >
                    <Link
                      to="/profile"
                      role="menuitem"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-booknest-navy transition hover:bg-booknest-lilac"
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-booknest-muted"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                      Profile
                    </Link>
                    {user?.role !== "admin" && (
                      <Link
                        to="/orders"
                        role="menuitem"
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-booknest-navy transition hover:bg-booknest-lilac"
                        onClick={() => setProfileOpen(false)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 shrink-0 text-booknest-muted"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z"
                          />
                        </svg>
                        Orders
                      </Link>
                    )}
                    <Link
                      to={settingsPath}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-booknest-navy transition hover:bg-booknest-lilac"
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-booknest-muted"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.2 2.2 0 0 1-1.55 3.76 2.2 2.2 0 0 1-1.56-.64l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.64V21a2.2 2.2 0 0 1-4.4 0v-.06a1.8 1.8 0 0 0-1.09-1.64 1.8 1.8 0 0 0-1.98.36l-.04.04a2.2 2.2 0 0 1-3.11-3.11l.04-.04a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.64-1.09H3a2.2 2.2 0 0 1 0-4.4h.06a1.8 1.8 0 0 0 1.64-1.09 1.8 1.8 0 0 0-.36-1.98l-.04-.04A2.2 2.2 0 0 1 7.3 3.1l.04.04a1.8 1.8 0 0 0 1.98.36H9.4A1.8 1.8 0 0 0 10.5 1.86V1a2.2 2.2 0 0 1 4.4 0v.06a1.8 1.8 0 0 0 1.09 1.64 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.2 2.2 0 0 1 3.11 3.11l-.04.04a1.8 1.8 0 0 0-.36 1.98V9.4a1.8 1.8 0 0 0 1.64 1.09H21a2.2 2.2 0 0 1 0 4.4h-.06a1.8 1.8 0 0 0-1.64 1.09Z"
                        />
                      </svg>
                      Settings
                    </Link>
                    <div className="my-1 h-px bg-booknest-border/80" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-[1.125rem]">
          <Link
            to="/"
            className="flex items-center font-bold text-booknest-navy"
          >
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/help"
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-booknest-navy"
            >
              Help
            </Link>
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="rounded-full bg-booknest-purple px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-booknest-purple/25 transition hover:bg-booknest-purple-hover hover:shadow-lg hover:shadow-booknest-purple/30"
            >
              Sign in
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
