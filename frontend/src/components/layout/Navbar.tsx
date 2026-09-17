"use client";

import { useMemo, useRef, useState } from "react";
import useDismissable from "../../hooks/useDismissable";
import MobileNav from "./MobileNav";
import { CUSTOMER_NAV, navLinkIsActive } from "./navLinks";
import { useAuth } from "../../context/AuthContext";
import { useAuthModal } from "../../context/AuthModalContext";
import BrandLogo from "../ui/BrandLogo";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useNotifications } from "../../context/NotificationsContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useActivePath from "../../hooks/useActivePath";

type BadgeProps = {
  value: number;
};

const Badge = ({ value }: BadgeProps) => {
  if (!value) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bookvuk-purple px-1 text-[10px] font-bold tabular-nums text-white shadow-sm ring-2 ring-white"
      aria-hidden
    >
      {value > 99 ? "99+" : value}
    </span>
  );
};

const Navbar = () => {
  const { openLoginModal } = useAuthModal();
  const router = useRouter();
  const { pathname } = useActivePath();
  const { user, isAuthenticated, logout } = useAuth();
  const { totalQty } = useCart();
  const { wishlistCount } = useWishlist();
  const {
    items: notificationItems,
    unreadCount,
    markAsRead,
    markAllRead,
  } = useNotifications();
  const isCustomer = user?.role !== "admin";
  const primaryHomePath = isAuthenticated
    ? isCustomer
      ? "/home"
      : "/admin"
    : "/";
  const onPrimaryHome =
    (isCustomer && pathname === "/home") ||
    (!isCustomer && pathname === "/admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notifWrapRef = useRef<HTMLDivElement | null>(null);

  /* Both panels dismiss the same two ways. They did not before: the
     notifications panel closed on Escape and the profile menu did not, because
     each had its own hand-rolled pair of effects and only one of them grew the
     key handler. */
  useDismissable(profileOpen, profileMenuRef, () => setProfileOpen(false));
  useDismissable(notifOpen, notifWrapRef, () => setNotifOpen(false));

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    router.push("/");
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
  const navInactive = `${navLinkBase} text-zinc-600 hover:bg-white/95 hover:text-bookvuk-navy hover:shadow-sm`;
  const navActive = `${navLinkBase} bg-white text-bookvuk-purple shadow-md ring-1 ring-bookvuk-border/60`;

  const mainNav = isAuthenticated ? (
    <div
      /* Hidden below `md`: at 390px this row needed 407px in 350px of space, so
         two of its six links sat past the right edge with a hidden scrollbar and
         nothing to say they were there. The drawer carries them on a phone. */
      className="hidden max-w-full min-w-0 items-center justify-center gap-0.5 overflow-x-auto rounded-full bg-gradient-to-b from-bookvuk-lilac/70 to-bookvuk-lilac/40 p-1 ring-1 ring-bookvuk-purple/[0.08] [-ms-overflow-style:none] [scrollbar-width:none] md:flex md:gap-6 [&::-webkit-scrollbar]:hidden"
      aria-label="Main navigation"
    >
      {isCustomer
        ? CUSTOMER_NAV.map((link) => {
            const active = navLinkIsActive(link, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={active ? navActive : navInactive}
              >
                {link.label}
              </Link>
            );
          })
        : null}
    </div>
  ) : null;

  return (
    <>
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    <header className="sticky top-0 z-40 border-b border-bookvuk-border/80 bg-white/85 shadow-bookvuk-hairline backdrop-blur-xl backdrop-saturate-150">
      {isAuthenticated ? (
        /* `auto _ minmax(0,1fr) _ auto`: the logo and the action icons take the
           width they need, and the nav takes what is left and may shrink to
           nothing.

           It used to be `1fr _ auto _ 1fr`, which is the opposite: the nav's
           track sized itself to a row of `whitespace-nowrap` pills — 472px
           inside a 390px viewport — so on a phone the whole document scrolled
           sideways with the header clipped at both edges. Widening the outer
           tracks instead would only move the problem, since it is the middle
           one that has to give.

           Below `xl` the links take a row of their own. Bounding the track
           stopped the sideways scroll but left the nav a 41px sliver reading
           "Se", and a cut-off word looks broken rather than compact. Measured,
           one row needs 150px of logo + 574px of links + 340px of icons ≈ 1110px
           — so `xl` (1280px) is the first breakpoint where it genuinely fits.
           `sm` would have put a 206px sliver on every tablet. The `gap-y-3` here
           was always sized for a second row; nothing used it. */
        <div className="mx-auto grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4 sm:px-5 sm:py-[1.125rem] xl:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center justify-start gap-1">
            {/* Only where the pill row is hidden. On the left because the right
                side already carries the cart, wishlist, bell and profile. */}
            {isCustomer ? (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                className="-ml-1 shrink-0 rounded-full p-2 text-bookvuk-navy transition hover:bg-bookvuk-lilac md:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            ) : null}
            <div className="shrink-0">
              {onPrimaryHome ? (
                <button
                  type="button"
                  className="flex items-center font-bold"
                  aria-label="BookVuk logo"
                >
                  <BrandLogo />
                </button>
              ) : (
                <Link
                  href={primaryHomePath}
                  className="flex items-center font-bold"
                >
                  <BrandLogo />
                </Link>
              )}
            </div>
          </div>

          {/* `md` to `xl` the row still takes a line of its own — measured, one
              line needs ~1110px and only `xl` has it. Below `md` the row is
              hidden entirely and this collapses, giving the header back the
              52px the second line was costing on a phone. */}
          <nav className="relative z-10 col-span-2 row-start-2 hidden min-w-0 justify-center px-1 md:flex xl:col-span-1 xl:col-start-2 xl:row-start-1">
            {mainNav}
          </nav>

          <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 sm:gap-3 xl:col-start-3">
            <>
              {user?.role !== "admin" ? (
                <div className="flex items-center gap-1.5">
                  <Link
                    href="/wishlist"
                    className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-bookvuk-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-bookvuk-purple/25 hover:bg-bookvuk-lilac/80 hover:text-bookvuk-purple hover:shadow-md"
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
                    href="/cart"
                    className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-bookvuk-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-bookvuk-purple/25 hover:bg-bookvuk-lilac/80 hover:text-bookvuk-purple hover:shadow-md"
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
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bookvuk-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-bookvuk-purple/25 hover:bg-bookvuk-lilac/80 hover:text-bookvuk-purple hover:shadow-md ${
                    notifOpen ? "border-bookvuk-purple/30 ring-2 ring-bookvuk-purple/15" : ""
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
                    className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-2xl border border-bookvuk-border/80 bg-white/95 py-1 shadow-xl shadow-bookvuk-navy/[0.08] ring-1 ring-bookvuk-navy/[0.04] backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between border-b border-bookvuk-border/70 px-3 py-2.5">
                      <span className="text-sm font-bold text-bookvuk-navy">Notifications</span>
                      {unreadCount > 0 ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => markAllRead()}
                          className="text-xs font-semibold text-bookvuk-purple hover:underline"
                        >
                          Mark all read
                        </button>
                      ) : null}
                    </div>
                    <ul className="max-h-80 overflow-y-auto py-1">
                      {sortedNotifications.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-bookvuk-muted">
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
                              className={`w-full border-b border-bookvuk-border/40 px-3 py-3 text-left last:border-b-0 hover:bg-bookvuk-lilac/60 ${
                                n.read ? "opacity-80" : "bg-bookvuk-lilac/30"
                              }`}
                            >
                              <div className="text-sm font-semibold text-bookvuk-navy">
                                {n.title}
                              </div>
                              <div className="mt-0.5 text-xs leading-snug text-bookvuk-muted">
                                {n.body}
                              </div>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="border-t border-bookvuk-border/70 px-2 py-2">
                      <Link
                        href={notificationsTarget}
                        role="menuitem"
                        className="block rounded-xl px-3 py-2 text-center text-sm font-semibold text-bookvuk-purple hover:bg-bookvuk-lilac"
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
              className="hidden h-10 w-px shrink-0 bg-gradient-to-b from-transparent via-bookvuk-border to-transparent sm:block"
              aria-hidden
            />

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 text-right sm:block">
                <div className="truncate text-sm font-semibold leading-tight text-bookvuk-navy">
                  {user?.name || "Account"}
                </div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-bookvuk-muted">
                  {user?.role === "admin" ? "Admin" : "Customer"}
                </div>
              </div>
              <div className="relative flex" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-bookvuk-lilac to-bookvuk-lilac/60 text-sm font-bold text-bookvuk-purple shadow-inner ring-2 ring-white ring-offset-2 ring-offset-white transition hover:ring-bookvuk-purple/25 ${
                    profileOpen ? "ring-bookvuk-purple/40" : ""
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
                    className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-bookvuk-border/80 bg-white/95 p-1.5 shadow-xl shadow-bookvuk-navy/[0.08] ring-1 ring-bookvuk-navy/[0.04] backdrop-blur-sm"
                  >
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-bookvuk-navy transition hover:bg-bookvuk-lilac"
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-bookvuk-muted"
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
                        href="/orders"
                        role="menuitem"
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-bookvuk-navy transition hover:bg-bookvuk-lilac"
                        onClick={() => setProfileOpen(false)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 shrink-0 text-bookvuk-muted"
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
                    {user?.role !== "admin" && (
                      /* Store credit had no page at all: the balance showed up
                         inside the checkout and nowhere else, so the money the
                         shop holds for somebody was not something they could go
                         and look at. */
                      <Link
                        href="/credit"
                        role="menuitem"
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-bookvuk-navy transition hover:bg-bookvuk-lilac"
                        onClick={() => setProfileOpen(false)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 shrink-0 text-bookvuk-muted"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 20.25z"
                          />
                        </svg>
                        Store credit
                      </Link>
                    )}
                    <Link
                      href={settingsPath}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-bookvuk-navy transition hover:bg-bookvuk-lilac"
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-bookvuk-muted"
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
                    <div className="my-1 h-px bg-bookvuk-border/80" />
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
            href="/"
            className="flex items-center font-bold text-bookvuk-navy"
          >
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* A guest previously had only Help and Sign in here, with nothing to
                explore. These three are what turn a visit into an account: the
                catalogue, who we are, and the reason to arrive in the first place.
                Help and Contact are support, not discovery — they stay in the footer
                so the header carries only what earns the signup. */}
            <Link
              href="/browse"
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-bookvuk-navy"
            >
              Shop
            </Link>
            <Link
              href="/about"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-bookvuk-navy sm:inline-block"
            >
              About
            </Link>
            <Link
              href="/sell"
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-bookvuk-navy"
            >
              Sell books
            </Link>
            {/* A guest can build a cart, so they need a way back to it. It sits last,
                beside Sign in: it is an action on what they have already chosen, not
                one of the pages they are still browsing. */}
            <Link
              href="/cart"
              className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-bookvuk-border/70 bg-white text-zinc-600 shadow-sm transition-all duration-200 hover:border-bookvuk-purple/25 hover:bg-bookvuk-lilac/80 hover:text-bookvuk-purple hover:shadow-md"
              aria-label={`Shopping cart, ${totalQty} item${totalQty === 1 ? "" : "s"}`}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
              </svg>
              <Badge value={totalQty} />
            </Link>
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="rounded-full bg-bookvuk-purple px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-bookvuk-purple/25 transition hover:bg-bookvuk-purple-hover hover:shadow-lg hover:shadow-bookvuk-purple/30"
            >
              Sign in
            </button>
          </div>
        </div>
      )}
    </header>
    </>
  );
};

export default Navbar;
