"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui";

/* The body of every `error.tsx`.
 *
 * There were five of these files, ~43 lines each and near-identical — about 200
 * lines of copy-paste, which is the thing a segment boundary is supposed to save
 * you from rather than cause. Each `error.tsx` is now a few lines that say what
 * failed and where to go instead.
 *
 * Kept as a component rather than a factory so React sees a stable component
 * type: a function returning a new component per call remounts the tree on every
 * render.
 */
type RouteErrorProps = {
  /** Named in the console log, so a report says which part failed. */
  scope: string;
  heading: string;
  body: string;
  /** Where "somewhere else" is. */
  fallbackHref: string;
  fallbackLabel: string;
  error: Error & { digest?: string };
  reset: () => void;
};

const RouteError = ({
  scope,
  heading,
  body,
  fallbackHref,
  fallbackLabel,
  error,
  reset,
}: RouteErrorProps) => {
  useEffect(() => {
    // Without this a server-side failure is invisible: the visitor sees only the
    // message below, and nothing reaches a log.
    console.error(`${scope} failed:`, error);
  }, [scope, error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-bookvuk-navy">{heading}</h1>
      <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">{body}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} variant="primary" size="lg" radius="xl">
          Try again
        </Button>
        <ButtonLink href={fallbackHref} variant="secondary" size="lg" radius="xl">
          {fallbackLabel}
        </ButtonLink>
      </div>
      {/* Shown, not hidden: "something went wrong" with no detail is what makes a
          bug report useless. */}
      {error?.message ? (
        <p className="mt-6 break-words text-xs text-bookvuk-muted/80">{error.message}</p>
      ) : null}
    </div>
  );
};

export default RouteError;
