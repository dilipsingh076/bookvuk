"use client";

/** The account card: who is signed in, and in what capacity. */

import type { UseProfile } from "./useProfile";

type ProfileIdentityProps = Pick<UseProfile, "user" | "initial">;

const ProfileIdentity = ({ user, initial }: ProfileIdentityProps) => (
  <div className="relative mt-10 overflow-hidden rounded-3xl border border-bookvuk-border/80 bg-gradient-to-br from-white via-bookvuk-lilac/25 to-bookvuk-lilac/50 p-6 shadow-bookvuk-raised ring-1 ring-bookvuk-purple/10 sm:p-8">
    <div
      className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-bookvuk-purple/10 blur-3xl"
      aria-hidden
    />
    <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-bookvuk-lilac to-bookvuk-lilac/60 text-2xl font-extrabold text-bookvuk-purple shadow-inner ring-2 ring-white ring-offset-2 ring-offset-bookvuk-cream sm:h-24 sm:w-24 sm:text-3xl">
        {initial}
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="truncate text-lg font-bold text-bookvuk-navy">
          {user?.name ?? "Your account"}
        </p>
        <p className="mt-1 truncate text-sm text-bookvuk-muted">{user?.email ?? ""}</p>
        {user?.role ? (
          <span className="mt-3 inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-bookvuk-purple ring-1 ring-bookvuk-purple/20">
            {user.role === "admin" ? "Administrator" : "Customer"}
          </span>
        ) : null}
      </div>
    </div>
  </div>
);

export default ProfileIdentity;
