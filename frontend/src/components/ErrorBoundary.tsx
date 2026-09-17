"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "../components/ui";

/**
 * Catches a render error so it does not take the whole page down.
 *
 * Without this, any exception thrown while rendering unmounts the entire tree and
 * the visitor gets a blank white page, with the reason visible only in a console
 * they will never open. A blank page is also indistinguishable from a slow
 * network, so people wait instead of reloading.
 *
 * React has no hook equivalent — `componentDidCatch` only exists on classes.
 */

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Errors that are Next's flow control rather than a failure.
 *
 * Both carry a `digest`: `notFound()` uses `NEXT_HTTP_ERROR_FALLBACK;404` (and
 * `NEXT_NOT_FOUND` in older versions), `redirect()` uses `NEXT_REDIRECT`. Matched
 * on the prefix so a version bump that appends to the digest does not silently
 * start swallowing 404s again. */
const isNextControlFlow = (error: unknown): boolean => {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string") return false;
  return (
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
    digest.startsWith("NEXT_NOT_FOUND") ||
    digest.startsWith("NEXT_REDIRECT")
  );
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    // `notFound()` and `redirect()` are implemented as thrown errors that Next's
    // own boundary is meant to catch. This boundary sits between the page and
    // that machinery, so catching them here swallowed them: a missing author or
    // book returned HTTP 200 with an empty page instead of a 404, and a
    // server-side redirect never happened. Anything Next owns is re-thrown.
    if (isNextControlFlow(error)) throw error;
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isNextControlFlow(error)) throw error;
    // Kept in the console for whoever is debugging; a real deployment would send
    // this to an error tracker.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        {/* Full-width card, like the order cards — no max-width box. */}
        <div className="w-full rounded-3xl border border-bookvuk-border/80 bg-white p-8 text-center shadow-bookvuk-card">
          <h1 className="text-2xl font-bold text-bookvuk-navy">Something went wrong</h1>
          <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
            This page hit an unexpected error. Nothing you had saved is affected —
            your cart and your account are untouched.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={this.reset}
              variant="primary-fade" size="lg" radius="xl"
            >
              Try again
            </Button>
            {/* Deliberately a plain anchor, not next/link. This renders after a
                crash, and a client navigation would keep the broken React tree
                alive; a full document load is what actually recovers. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="rounded-xl border border-bookvuk-border bg-white px-5 py-2.5 text-sm font-semibold text-bookvuk-navy transition hover:bg-zinc-50"
            >
              Go to the homepage
            </a>
          </div>
          {/* The message is shown rather than hidden: "something went wrong" with
              no detail is what makes a bug report useless. */}
          <p className="mt-6 break-words text-xs text-bookvuk-muted/80">{error.message}</p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
