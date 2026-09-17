"use client";

/**
 * Close an open overlay the two ways people expect: click away, or press Escape.
 *
 * Written once because the navbar had it three times — the profile menu, the
 * notifications panel, and now the mobile drawer — and the copies had already
 * diverged: the notifications panel closed on Escape and the profile menu did
 * not, so the same gesture worked on one and did nothing on the other.
 */

import { useEffect, type RefObject } from "react";

const useDismissable = (
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) => {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      // Nothing to compare against, or the press landed inside: leave it open.
      if (!target || ref.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    /* `mousedown`, not `click`: a press that starts inside and drifts outside —
       selecting text, dragging a scrollbar — would otherwise close the thing
       being read from. Touch is listened for separately because a tap on iOS
       does not always produce the mouse event. */
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onClose]);
};

export default useDismissable;
