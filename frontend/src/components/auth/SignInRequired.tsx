"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { useAuthModal } from "@/context/AuthModalContext";

/**
 * What a signed-out visitor sees on a page that needs an account.
 *
 * These pages used to `router.replace("/")` — a silent bounce to the shopfront.
 * Follow a bookmark to your sell requests, or open the link a friend sent you,
 * and you simply arrived somewhere else with no explanation and no way back to
 * where you were going. Seven routes behaved that way: cart, wishlist, orders,
 * profile, settings, checkout and sell requests.
 *
 * Staying put is better in every respect. The URL is preserved, so signing in
 * lands you on the page you asked for with no return-path to thread through the
 * login and no second navigation — `RoleRouteGuard` simply re-evaluates and
 * renders the page. A refresh or a re-share still works, because the address bar
 * never lied about where you are.
 */
type SignInRequiredProps = {
  /** Completes "Sign in to open …" — e.g. "your sell requests", "this order". */
  what: string;
  /** Where to send someone who has no account and does not want one yet. */
  browseHref?: string;
  browseLabel?: string;
};

const SignInRequired = ({
  what,
  browseHref = "/browse",
  browseLabel = "Browse books",
}: SignInRequiredProps) => {
  const { openLoginModal, openRegisterModal } = useAuthModal();

  return (
    <div className="mx-auto max-w-md py-16 text-center sm:py-24">
      <div
        className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-bookvuk-lilac text-bookvuk-purple"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V8a4 4 0 1 0-8 0v3M6 11h12v9H6z"
          />
        </svg>
      </div>

      <h1 className="mt-5 text-2xl font-bold tracking-tight text-bookvuk-navy sm:text-3xl">
        Sign in to open {what}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
        {/* Says plainly that they are in the right place — the old redirect left
            people wondering whether the link was broken. */}
        You are on the right page. Sign in and it will open here.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={openLoginModal} variant="primary" size="lg" radius="xl">
          Sign in
        </Button>
        <Button type="button" onClick={openRegisterModal} variant="secondary" size="lg" radius="xl">
          Create an account
        </Button>
      </div>

      <p className="mt-6 text-xs text-bookvuk-muted">
        Or{" "}
        <Link href={browseHref} className="font-semibold text-bookvuk-purple hover:underline">
          {browseLabel.toLowerCase()}
        </Link>{" "}
        without an account.
      </p>
    </div>
  );
};

export default SignInRequired;
