"use client";

/**
 * The one interactive thing on the contact page: copying the address.
 *
 * Failures are swallowed deliberately — the clipboard is refused in some
 * browsers and over plain HTTP, and the address is on screen either way, so
 * there is nothing to tell the visitor to do about it.
 */

import { useState } from "react";
import { COPIED_MS, EMAIL } from "./types";

export const useContact = () => {
  const [copied, setCopied] = useState(false);

  return {
    copied,
    copyEmail: async () => {
      try {
        await navigator.clipboard.writeText(EMAIL);
        setCopied(true);
        window.setTimeout(() => setCopied(false), COPIED_MS);
      } catch {
        /* Nothing to say: the address is already visible. */
      }
    },
  };
};

type UseContact = ReturnType<typeof useContact>;
