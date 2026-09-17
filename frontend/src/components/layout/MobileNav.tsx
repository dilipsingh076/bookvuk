"use client";

/**
 * The navigation on a phone.
 *
 * The links used to sit in a horizontally scrolling pill row at every width.
 * Measured at 390px — the standard iPhone — that row needed 407px in 350px of
 * space, so **two of the six links were unreachable**: "Home" and "Contact" sat
 * past the right edge. The scrollbar is deliberately hidden, so nothing on
 * screen said they were there. It also gave the row its own line, taking the
 * header from 85px to 137px on the screens with the least room to spare.
 *
 * A drawer costs one tap and shows all six.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useDismissable from "../../hooks/useDismissable";
import { CUSTOMER_NAV, navLinkIsActive } from "./navLinks";

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
};

const MobileNav = ({ open, onClose }: MobileNavProps) => {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  useDismissable(open, panelRef, onClose);

  /* Close when the page changes.
   *
   * Tapping a link navigates but does not unmount this, so without it the drawer
   * stays open over the page it just went to — which reads as the tap not having
   * worked. */
  useEffect(() => {
    onClose();
    // `onClose` is deliberately absent: it is rebuilt each render, and listing
    // it would close the drawer on every render rather than on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* The page behind must not scroll while the drawer is over it. Restoring the
     previous value rather than clearing it, so this cannot fight a dialog that
     had already locked the page. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the drawer, so a keyboard or screen-reader user lands on the
  // thing that just opened instead of continuing from the button behind it.
  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* The page behind, dimmed. Not focusable: `useDismissable` already closes
          on a press out here, and a tabbable backdrop is a stop on the way to
          the links. */}
      <div className="absolute inset-0 bg-bookvuk-navy/40 backdrop-blur-[2px]" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col border-r border-bookvuk-border/80 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-bookvuk-border/70 px-5 py-4">
          <span className="text-sm font-bold uppercase tracking-wider text-bookvuk-muted">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-1 rounded-full p-2 text-bookvuk-muted transition hover:bg-bookvuk-lilac hover:text-bookvuk-navy"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {CUSTOMER_NAV.map((link, i) => {
              const active = navLinkIsActive(link, pathname);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    ref={i === 0 ? firstLinkRef : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    className={`block rounded-xl px-4 py-3 text-[15px] font-semibold transition ${
                      active
                        ? "bg-bookvuk-lilac text-bookvuk-purple"
                        : "text-bookvuk-navy hover:bg-zinc-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default MobileNav;
