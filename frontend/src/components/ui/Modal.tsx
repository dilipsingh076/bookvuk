"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** Merged onto the dialog panel (e.g. max-w-4xl for wide layouts). */
  panelClassName?: string;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ isOpen, onClose, children, panelClassName = "" }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const hasCustomMaxWidth = /\bmax-w-/.test(panelClassName);
  const widthClass = hasCustomMaxWidth ? "" : "max-w-lg";
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  /* `createPortal` needs `document`, which does not exist while Next renders on
   * the server — and a route that opens straight into a dialog (`/login`,
   * `/reset-password`) does render there. So the portal waits for the mount.
   *
   * Nothing is lost: a dialog is browser-only by nature, and the routes that
   * present one have their own metadata, so the HTML a crawler reads is complete
   * without it. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* A click only dismisses the dialog if it *started* on the backdrop.
   *
   * Without this, a click that begins inside the panel and ends anywhere else
   * closes the dialog — and that is not hypothetical. Clicking a link in the book
   * dialog started a navigation, the dialog unmounted mid-gesture, the backdrop
   * ended up under the cursor, and its handler ran `router.back()` — landing the
   * visitor back on the book they had just left. Intermittently, depending on
   * which happened first, which is why it looked like the links "sometimes did
   * not work".
   */
  const backdropArmed = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const root = panelRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = nodes[0];
    window.setTimeout(() => first?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || nodes.length === 0) return;
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      {/* Full-screen layer: blur + dim; must be below panel so outside clicks hit this */}
      <div
        className="absolute inset-0 cursor-default bg-bookvuk-navy/45 backdrop-blur-[8px]"
        aria-hidden
        onMouseDown={(e) => {
          backdropArmed.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (!backdropArmed.current || e.target !== e.currentTarget) return;
          backdropArmed.current = false;
          onClose?.();
        }}
      />
      <div
        ref={panelRef}
        className={`relative z-10 w-full ${widthClass} max-h-[min(92vh,900px)] overflow-x-hidden overflow-y-auto rounded-[22px] bg-white shadow-bookvuk-card ring-1 ring-bookvuk-border/80 ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
