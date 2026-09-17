"use client";

/**
 * Three screens in one route:
 *  - no `?token=`  -> ask for the e-mail address and send a link
 *  - with a token  -> let the visitor choose a new password
 *  - afterwards    -> confirm, and offer sign-in
 *
 * The middle one is reached from a link in an e-mail, which is why
 * `/reset-password` remains a real URL: that link opens a fresh browser with no
 * application state to raise a dialog from. The route presents it as a dialog
 * over the shopfront, the same way `/login` does.
 */

import type { ReactNode } from "react";
import { Input } from "../../components/ui";
import { useResetPassword } from "./useResetPassword";
import { MIN_PASSWORD_LENGTH, type ResetPasswordProps } from "./types";

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="py-16">
    <div className="rounded-2xl border border-bookvuk-border bg-white p-7 shadow-bookvuk-card">
      {children}
    </div>
  </div>
);

const ResetPassword = ({ onDone }: ResetPasswordProps) => {
  const r = useResetPassword({ onDone });

  if (r.stage === "done") {
    return (
      <Shell>
        <h1 className="text-xl font-extrabold text-bookvuk-navy">Password updated</h1>
        <p className="mt-2 text-sm text-bookvuk-muted">{r.message}</p>
        <button
          type="button"
          onClick={r.goSignIn}
          className="mt-6 w-full rounded-lg bg-bookvuk-purple py-2.5 text-sm font-semibold text-white hover:bg-bookvuk-purple-hover"
        >
          Sign in
        </button>
      </Shell>
    );
  }

  if (r.stage === "choose") {
    return (
      <Shell>
        <form onSubmit={r.setNewPassword}>
          <h1 className="text-xl font-extrabold text-bookvuk-navy">Choose a new password</h1>
          <p className="mt-2 text-sm text-bookvuk-muted">
            At least {MIN_PASSWORD_LENGTH} characters. Signing in again on your other devices will
            be required.
          </p>

          <label className="mt-5 block text-sm font-semibold text-bookvuk-navy">New password</label>
          <Input
            type="password"
            value={r.password}
            onChange={(e) => r.setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoComplete="new-password"
            className="mt-2 rounded-lg px-3 py-2"
          />

          <label className="mt-4 block text-sm font-semibold text-bookvuk-navy">
            Confirm password
          </label>
          <Input
            type="password"
            value={r.confirm}
            onChange={(e) => r.setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="mt-2 rounded-lg px-3 py-2"
          />
          {r.mismatch ? (
            <div className="mt-2 text-xs font-semibold text-rose-700">Passwords do not match.</div>
          ) : null}

          {r.error ? (
            <div className="mt-4 rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-700">
              {r.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={r.busy || r.mismatch}
            className="mt-6 w-full rounded-lg bg-bookvuk-purple py-2.5 text-sm font-semibold text-white hover:bg-bookvuk-purple-hover disabled:opacity-60"
          >
            {r.busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={r.sendLink}>
        <h1 className="text-xl font-extrabold text-bookvuk-navy">Reset your password</h1>
        <p className="mt-2 text-sm text-bookvuk-muted">
          Enter the e-mail on your account and we will send a link to choose a new password.
        </p>

        <label className="mt-5 block text-sm font-semibold text-bookvuk-navy">Email address</label>
        <Input
          type="email"
          value={r.email}
          onChange={(e) => r.setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-2 rounded-lg px-3 py-2"
        />

        {r.message ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-2 text-sm font-semibold text-emerald-800">
            {r.message}
          </div>
        ) : null}
        {r.error ? (
          <div className="mt-4 rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-700">
            {r.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={r.busy}
          className="mt-6 w-full rounded-lg bg-bookvuk-purple py-2.5 text-sm font-semibold text-white hover:bg-bookvuk-purple-hover disabled:opacity-60"
        >
          {r.busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </Shell>
  );
};

export default ResetPassword;
