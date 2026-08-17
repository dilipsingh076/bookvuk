import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Toggle = ({
  id,
  label,
  description,
  defaultOn = true,
}: {
  id: string;
  label: string;
  description: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-booknest-border/80 bg-white px-4 py-4 sm:px-5">
      <div>
        <label
          htmlFor={id}
          className="text-sm font-semibold text-booknest-navy"
        >
          {label}
        </label>
        <p className="mt-1 text-xs leading-relaxed text-booknest-muted">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? "bg-booknest-purple" : "bg-booknest-border"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
};

const Settings = () => {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl pb-16 pt-6 sm:pt-8">
      <div className="mb-8">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-booknest-navy">
          Settings
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-booknest-muted">
          Manage notifications and preferences for{" "}
          {user?.email ?? "your account"}.
        </p>
      </div>

      <div className="space-y-8">
        <section className="rounded-3xl border border-booknest-border/80 bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.04] sm:p-8">
          <h2 className="text-base font-bold text-booknest-navy">
            Notifications
          </h2>
          <p className="mt-1 text-xs text-booknest-muted">
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

        <section className="rounded-3xl border border-booknest-border/80 bg-gradient-to-br from-booknest-lilac/40 to-white p-6 ring-1 ring-booknest-purple/10 sm:p-8">
          <h2 className="text-base font-bold text-booknest-navy">
            Profile &amp; security
          </h2>
          <p className="mt-1 text-sm text-booknest-muted">
            Update your name, email, and password on your profile page.
          </p>
          <Link
            to="/profile"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-booknest-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-booknest-purple-hover"
          >
            Open profile
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Settings;
