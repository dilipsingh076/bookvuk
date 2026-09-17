"use client";

/** Your name, and your password. */

import Link from "next/link";
import ProfileIdentity from "./ProfileIdentity";
import SectionHeader, { LockIcon, UserIcon } from "./SectionHeader";
import { useProfile } from "./useProfile";
import { INPUT_CLASS, MIN_PASSWORD_LENGTH } from "./types";

const Profile = () => {
  const p = useProfile();

  return (
    <div className="relative pb-24 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-gradient-to-b from-bookvuk-lilac/85 via-bookvuk-cream/45 to-transparent"
        aria-hidden
      />

      <div className="relative px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <header>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl">
              Profile &amp; security
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
              Manage how you appear across the store and keep your sign-in credentials up to date.
            </p>
          </header>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-xl border border-bookvuk-border bg-white px-4 py-2.5 text-sm font-semibold text-bookvuk-navy shadow-sm transition hover:border-bookvuk-purple/25 hover:bg-bookvuk-lilac/60"
            >
              Settings
            </Link>
            <Link
              href={p.backPath}
              className="inline-flex items-center gap-2 rounded-xl bg-bookvuk-purple px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-bookvuk-purple/20 transition hover:bg-bookvuk-purple-hover"
            >
              <span aria-hidden className="text-base leading-none">
                ←
              </span>
              Back
            </Link>
          </div>
        </div>

        <ProfileIdentity user={p.user} initial={p.initial} />

        <form
          onSubmit={p.submit}
          className="mt-8 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.04] sm:p-8"
        >
          {p.message ? (
            <div
              role="status"
              className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3.5 text-sm font-semibold text-emerald-800 shadow-sm"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                ✓
              </span>
              {p.message}
            </div>
          ) : null}

          {p.error ? (
            <div
              role="alert"
              className="mb-8 rounded-2xl border border-rose-200/90 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-800"
            >
              {p.error}
            </div>
          ) : null}

          <div className="space-y-10">
            <section>
              <SectionHeader
                icon={<UserIcon />}
                title="Personal information"
                hint="Shown on receipts and order updates."
              />
              <div className="mt-6 space-y-5 rounded-2xl bg-bookvuk-cream/40 p-5 ring-1 ring-bookvuk-navy/[0.05] sm:p-6">
                <div>
                  <label htmlFor="profile-name" className="text-sm font-semibold text-bookvuk-navy">
                    Full name
                  </label>
                  <input
                    id="profile-name"
                    value={p.fields.name}
                    onChange={(e) => p.setField("name", e.target.value)}
                    className={INPUT_CLASS}
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="profile-email" className="text-sm font-semibold text-bookvuk-navy">
                    Email address
                  </label>
                  <input
                    id="profile-email"
                    value={p.fields.email}
                    onChange={(e) => p.setField("email", e.target.value)}
                    type="email"
                    className={INPUT_CLASS}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionHeader
                icon={<LockIcon />}
                title="Password & security"
                hint="Leave new password empty to keep your current one. Current password is required to change it."
              />
              <div className="mt-6 space-y-5 rounded-2xl bg-bookvuk-cream/40 p-5 ring-1 ring-bookvuk-navy/[0.05] sm:p-6">
                <div>
                  <label
                    htmlFor="profile-current-password"
                    className="text-sm font-semibold text-bookvuk-navy"
                  >
                    Current password
                  </label>
                  <input
                    id="profile-current-password"
                    value={p.passwords.current}
                    onChange={(e) => p.setPassword("current", e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Required when updating password"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-new-password"
                      className="text-sm font-semibold text-bookvuk-navy"
                    >
                      New password
                    </label>
                    <input
                      id="profile-new-password"
                      value={p.passwords.next}
                      onChange={(e) => p.setPassword("next", e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-confirm-password"
                      className="text-sm font-semibold text-bookvuk-navy"
                    >
                      Confirm new password
                    </label>
                    <input
                      id="profile-confirm-password"
                      value={p.passwords.confirm}
                      onChange={(e) => p.setPassword("confirm", e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-bookvuk-border/80 pt-8 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <Link
              href={p.backPath}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-bookvuk-border bg-white px-6 text-sm font-semibold text-bookvuk-navy shadow-sm transition-colors hover:bg-bookvuk-lilac/70 sm:min-w-[7.5rem]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={p.saving}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-bookvuk-purple px-8 text-sm font-semibold text-white shadow-md shadow-bookvuk-purple/20 transition hover:bg-bookvuk-purple-hover disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[10rem]"
            >
              {p.saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-bookvuk-muted sm:text-left">
            Your email is the sign-in address and cannot be changed here.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Profile;
