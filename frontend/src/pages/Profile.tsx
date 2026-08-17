import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const inputClass =
  "mt-2 w-full rounded-xl border border-booknest-border bg-white px-4 py-3 text-sm text-booknest-navy shadow-sm outline-none transition placeholder:text-booknest-muted/70 focus:border-booknest-purple/40 focus:ring-2 focus:ring-booknest-purple/20";

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z"
    />
  </svg>
);

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z"
    />
  </svg>
);

const Profile = () => {
  const { user } = useAuth();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  const initial = String(user?.name || "U")
    .slice(0, 1)
    .toUpperCase();

  const backPath = user?.role === "admin" ? "/admin" : "/home";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const changingPassword =
      newPassword.trim().length > 0 || confirmPassword.trim().length > 0;
    if (changingPassword) {
      if (!currentPassword.trim()) {
        setError("Enter your current password to set a new one.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
    }

    setSaving(true);

    window.setTimeout(() => {
      setSaving(false);
      setMessage(
        "Your profile was updated successfully (mock — not saved to a server).",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, 650);
  };

  return (
    <div className="relative pb-24 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-gradient-to-b from-booknest-lilac/85 via-booknest-cream/45 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <header>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-booknest-navy sm:text-4xl">
              Profile &amp; security
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-booknest-muted sm:text-[15px]">
              Manage how you appear across the store and keep your sign-in
              credentials up to date.
            </p>
          </header>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              to="/settings"
              className="inline-flex items-center justify-center rounded-xl border border-booknest-border bg-white px-4 py-2.5 text-sm font-semibold text-booknest-navy shadow-sm transition hover:border-booknest-purple/25 hover:bg-booknest-lilac/60"
            >
              Settings
            </Link>
            <Link
              to={backPath}
              className="inline-flex items-center gap-2 rounded-xl bg-booknest-purple px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-booknest-purple/20 transition hover:bg-booknest-purple-hover"
            >
              <span aria-hidden className="text-base leading-none">
                ←
              </span>
              Back
            </Link>
          </div>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-3xl border border-booknest-border/80 bg-gradient-to-br from-white via-booknest-lilac/25 to-booknest-lilac/50 p-6 shadow-[0_12px_40px_-24px_rgba(26,29,46,0.12)] ring-1 ring-booknest-purple/10 sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-booknest-purple/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-booknest-lilac to-booknest-lilac/60 text-2xl font-extrabold text-booknest-purple shadow-inner ring-2 ring-white ring-offset-2 ring-offset-booknest-cream sm:h-24 sm:w-24 sm:text-3xl">
              {initial}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="truncate text-lg font-bold text-booknest-navy">
                {user?.name ?? "Your account"}
              </p>
              <p className="mt-1 truncate text-sm text-booknest-muted">
                {user?.email ?? ""}
              </p>
              {user?.role ? (
                <span className="mt-3 inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-booknest-purple ring-1 ring-booknest-purple/20">
                  {user.role === "admin" ? "Administrator" : "Customer"}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 rounded-3xl border border-booknest-border/80 bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.04] sm:p-8"
        >
          {message ? (
            <div
              role="status"
              className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3.5 text-sm font-semibold text-emerald-800 shadow-sm"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                ✓
              </span>
              {message}
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mb-8 rounded-2xl border border-rose-200/90 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-800"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-10">
            <section>
              <div className="flex items-center gap-3 border-b border-booknest-border/80 pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-booknest-lilac to-booknest-lilac/60 text-booknest-purple shadow-inner ring-1 ring-booknest-purple/10">
                  <UserIcon />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-booknest-navy">
                    Personal information
                  </h2>
                  <p className="mt-0.5 text-xs text-booknest-muted">
                    Shown on receipts and order updates.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-5 rounded-2xl bg-booknest-cream/40 p-5 ring-1 ring-booknest-navy/[0.05] sm:p-6">
                <div>
                  <label
                    htmlFor="profile-name"
                    className="text-sm font-semibold text-booknest-navy"
                  >
                    Full name
                  </label>
                  <input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-email"
                    className="text-sm font-semibold text-booknest-navy"
                  >
                    Email address
                  </label>
                  <input
                    id="profile-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className={inputClass}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 border-b border-booknest-border/80 pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-booknest-lilac to-booknest-lilac/60 text-booknest-purple shadow-inner ring-1 ring-booknest-purple/10">
                  <LockIcon />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-booknest-navy">
                    Password &amp; security
                  </h2>
                  <p className="mt-0.5 text-xs text-booknest-muted">
                    Leave new password empty to keep your current one. Current
                    password is required to change it.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-5 rounded-2xl bg-booknest-cream/40 p-5 ring-1 ring-booknest-navy/[0.05] sm:p-6">
                <div>
                  <label
                    htmlFor="profile-current-password"
                    className="text-sm font-semibold text-booknest-navy"
                  >
                    Current password
                  </label>
                  <input
                    id="profile-current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Required when updating password"
                    className={inputClass}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-new-password"
                      className="text-sm font-semibold text-booknest-navy"
                    >
                      New password
                    </label>
                    <input
                      id="profile-new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-confirm-password"
                      className="text-sm font-semibold text-booknest-navy"
                    >
                      Confirm new password
                    </label>
                    <input
                      id="profile-confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-booknest-border/80 pt-8 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <Link
              to={backPath}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-booknest-border bg-white px-6 text-sm font-semibold text-booknest-navy shadow-sm transition-colors hover:bg-booknest-lilac/70 sm:min-w-[7.5rem]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-booknest-purple px-8 text-sm font-semibold text-white shadow-md shadow-booknest-purple/20 transition hover:bg-booknest-purple-hover disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[10rem]"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-booknest-muted sm:text-left">
            This form is a UI preview. Saving does not yet persist to a live
            backend.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Profile;
