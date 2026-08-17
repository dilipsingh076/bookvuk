import { useEffect, useRef } from "react";
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

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      {/* Full-screen layer: blur + dim; must be below panel so outside clicks hit this */}
      <div
        className="absolute inset-0 cursor-default bg-booknest-navy/45 backdrop-blur-[8px]"
        aria-hidden
        onClick={() => onClose?.()}
      />
      <div
        ref={panelRef}
        className={`relative z-10 w-full ${widthClass} max-h-[min(92vh,900px)] overflow-x-hidden overflow-y-auto rounded-[22px] bg-white shadow-booknest-card ring-1 ring-booknest-border/80 ${panelClassName}`.trim()}
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
