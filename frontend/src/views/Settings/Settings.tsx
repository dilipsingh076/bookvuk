"use client";

/** Preferences. The notification switches are local-only for now. */

import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Toggle from "./Toggle";

const Settings = () => {
  const { user } = useAuth();

  return (
    <div className="pb-16 pt-6 sm:pt-8">
      <div className="mb-8">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-bookvuk-navy">Settings</h1>
        <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
          Manage notifications and preferences for {user?.email ?? "your account"}.
        </p>
      </div>

      <div className="space-y-8">
        <section className="rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.04] sm:p-8">
          <h2 className="text-base font-bold text-bookvuk-navy">Notifications</h2>
          <p className="mt-1 text-xs text-bookvuk-muted">
            These are local-only toggles for the demo UI.
          </p>
          <div className="mt-5 space-y-3">
            <Toggle
              id="notify-order"
              label="Order updates"
              description="Shipping and delivery messages for purchases."
            />
            <Toggle
              id="notify-promo"
              label="Recommendations"
              description="Occasional picks based on your browsing."
              defaultOn={false}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-bookvuk-border/80 bg-gradient-to-br from-bookvuk-lilac/40 to-white p-6 ring-1 ring-bookvuk-purple/10 sm:p-8">
          <h2 className="text-base font-bold text-bookvuk-navy">Profile &amp; security</h2>
          <p className="mt-1 text-sm text-bookvuk-muted">
            Update your name, email, and password on your profile page.
          </p>
          <Link
            href="/profile"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-bookvuk-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-bookvuk-purple-hover"
          >
            Open profile
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Settings;
