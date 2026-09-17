"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { LoaderBlock } from "@/components/ui/Loader";
import SignInRequired from "@/components/auth/SignInRequired";

type Role = string;

/* "You are not signed in" is not a destination. Distinguishing it from a real
   redirect target is what lets the guard offer a sign-in where the visitor
   already is instead of moving them somewhere else. */
const NEEDS_AUTH = Symbol("needs-auth");

/* Who is allowed on a route.
 *
 * Still a client component, and deliberately not Next middleware: middleware
 * runs on the server, and the session is a bearer token in `localStorage`, which
 * the server cannot see. Moving these checks to the edge is what an httpOnly
 * cookie session would unlock — see the note in `AuthContext`.
 *
 * `<Navigate>` had no Next equivalent, so redirecting happens in an effect. That
 * changes one thing worth knowing: a redirect can no longer happen *during*
 * render, so the guard renders a spinner for the frame before it fires rather
 * than swapping instantly. It must never render `children` in that frame — an
 * admin would see a flash of the customer page it is about to leave.
 */
type RoleRouteGuardProps = {
  variant:
    | "adminOnly"
    | "redirectAdminsOnUserRoutes"
    | "authenticatedOnly"
    | "unauthenticatedOnly"
    /** Customer-only (cart / wishlist / checkout): guests → landing `/`, admins → `/admin` */
    | "customerRoutes";
  /**
   * What this page is, for the sign-in prompt: "your sell requests", "your cart".
   *
   * Completes the sentence "Sign in to see …", so a page that omits it gets the
   * bland but correct "this page".
   */
  signInPrompt?: string;
  allowedRoles?: Role[];
  children: ReactNode;
};

/** Where this visitor should be sent, or null if they belong here. */
const redirectFor = (
  variant: RoleRouteGuardProps["variant"],
  isAuthenticated: boolean,
  role: string | undefined,
  allowedRoles?: Role[],
): string | typeof NEEDS_AUTH | null => {
  const notAllowed =
    allowedRoles !== undefined &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(role || "");

  switch (variant) {
    case "adminOnly":
      // Not signed in is a different problem from signed in as the wrong person.
      // The first is fixable without leaving; the second is not.
      if (!isAuthenticated) return NEEDS_AUTH;
      if (role !== "admin" || notAllowed) return "/";
      return null;
    case "authenticatedOnly":
      if (!isAuthenticated) return NEEDS_AUTH;
      if (notAllowed) return "/";
      return null;
    case "unauthenticatedOnly":
      if (isAuthenticated) return role === "admin" ? "/admin" : "/home";
      return null;
    case "customerRoutes":
      if (!isAuthenticated) return NEEDS_AUTH;
      if (role === "admin") return "/admin";
      return null;
    case "redirectAdminsOnUserRoutes":
      if (isAuthenticated && role === "admin") return "/admin";
      return null;
  }
};

/* Whether a variant's content is private.
 *
 * This distinction is what makes server rendering possible at all. The session
 * lives in `localStorage`, so on the server `loading` is always true — and a
 * guard that withholds its children until it resolves renders nothing but a
 * spinner into the HTML. Every public page was doing that: the catalogue and each
 * of the 200 book pages served a spinner to crawlers, because they carry
 * `redirectAdminsOnUserRoutes`.
 *
 * That variant is not a security boundary. It exists so a signed-in admin
 * clicking a customer link lands on the admin panel instead — a convenience,
 * worth nothing to a visitor who is not an admin, and worth less than the
 * catalogue being indexable. So it renders its children immediately and moves
 * admins on afterwards.
 *
 * The other four gate genuinely private pages, which are `noindex` anyway, so
 * they keep withholding: showing an order and then yanking it away is worse than
 * a spinner.
 */
const PRIVATE_VARIANTS: ReadonlySet<RoleRouteGuardProps["variant"]> = new Set([
  "adminOnly",
  "authenticatedOnly",
  "unauthenticatedOnly",
  "customerRoutes",
]);

const RoleRouteGuard = ({
  variant,
  allowedRoles,
  children,
  signInPrompt,
}: RoleRouteGuardProps) => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const outcome = loading
    ? null
    : redirectFor(variant, isAuthenticated, user?.role, allowedRoles);
  const needsAuth = outcome === NEEDS_AUTH;
  const target = needsAuth ? null : outcome;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  const isPrivate = PRIVATE_VARIANTS.has(variant);

  if (isPrivate && (loading || target)) {
    return (
      <LoaderBlock height="page" caption="Checking your account…" />
    );
  }

  /* Ask, rather than bounce. Nothing needs to be remembered and no return path
     needs threading through the login: the visitor is already on the page they
     wanted, so once they are signed in this guard re-runs and renders it. */
  if (needsAuth) {
    return <SignInRequired what={signInPrompt ?? "this page"} />;
  }

  return <>{children}</>;
};

export default RoleRouteGuard;
