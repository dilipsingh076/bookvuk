"use client";

/**
 * Sign in — the same form in the auth dialog and on `/login`.
 *
 * Only three things differ between the two placements, and each is a prop: the
 * card's chrome, whether there is a Cancel button, and whether "Sign up" and
 * "Forget password?" navigate or swap the dialog's contents.
 */

import Link from "next/link";
import { Alert, Button, Card, Field, IconInput, Loader } from "../../components/ui";
import { LockIcon, MailIcon } from "../../components/ui/icons";
import { cn } from "../../lib/cn";
import { useLogin } from "./useLogin";
import type { LoginProps } from "./types";

const Login = ({
  embedded = false,
  onCancel,
  onSwitchToRegister,
  redirectOnSuccess = true,
  onForgotPassword,
}: LoginProps) => {
  const f = useLogin({ redirectOnSuccess, onCancel, onForgotPassword });

  return (
    <div
      className={
        embedded
          ? "w-full bg-white p-6"
          : "min-h-screen w-full bg-bookvuk-cream px-4 flex items-center justify-center"
      }
    >
      <Card
        as="section"
        radius={embedded ? "2xl" : "3xl"}
        padding={embedded ? "md" : "lg"}
        elevation={embedded ? "none" : "sm"}
        className={cn("border-bookvuk-border", embedded ? "w-full" : "w-full md:w-[448px]")}
      >
        <div>
          <h3 className="text-2xl font-bold text-bookvuk-navy">Login</h3>
          <p className="mt-1 text-sm text-bookvuk-muted">
            Enter your email and password to continue.
          </p>
        </div>

        <form onSubmit={f.submit} className="mt-7 space-y-4">
          <Field label="Email address">
            {(field) => (
              <IconInput
                {...field}
                icon={<MailIcon />}
                value={f.fields.email}
                onChange={(e) => f.setField("email", e.target.value)}
                type="email"
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            )}
          </Field>

          <Field label="Password">
            {(field) => (
              <IconInput
                {...field}
                icon={<LockIcon />}
                value={f.fields.password}
                onChange={(e) => f.setField("password", e.target.value)}
                type={f.showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    onClick={f.toggleShowPassword}
                    className="shrink-0 text-xs font-semibold text-bookvuk-navy hover:underline"
                  >
                    {f.showPassword ? "Hide" : "Show"}
                  </button>
                }
              />
            )}
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-bookvuk-navy">
              {/* Controlled now, and acted on. It was `defaultChecked` with no
                  handler, so unticking it changed nothing and the session
                  outlived the browser either way — the opposite of what the
                  label offers on a shared machine. */}
              <input
                type="checkbox"
                checked={f.remember}
                onChange={(e) => f.setRemember(e.target.checked)}
                className="h-4 w-4"
              />
              Remember me
            </label>
            <button
              type="button"
              className="text-sm font-semibold text-bookvuk-navy hover:underline"
              onClick={f.forgotPassword}
            >
              Forget password?
            </button>
          </div>

          {f.error ? (
            <Alert
              tone="error"
              className="rounded-2xl border-0 p-2 text-lg flex justify-center font-semibold"
            >
              {f.error}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            radius="2xl"
            block
            className="gap-3 px-0 py-3"
            disabled={f.loading}
          >
            {f.loading ? <Loader size="sm" tone="inverse" decorative /> : null}
            Login to BookVuk
          </Button>

          {embedded && onCancel ? (
            <Button
              variant="secondary"
              radius="2xl"
              block
              onClick={onCancel}
              className="mt-3 px-0 py-3 hover:bg-bookvuk-cream"
            >
              Cancel
            </Button>
          ) : null}

          <div className="flex justify-center pt-2 text-sm">
            <span className="text-bookvuk-muted">Don&rsquo;t have an account?</span>
            {embedded && onSwitchToRegister ? (
              <button
                type="button"
                onClick={() => onSwitchToRegister()}
                className="ml-2 font-semibold text-bookvuk-navy hover:underline"
              >
                Sign up
              </button>
            ) : (
              <Link
                href="/register"
                className="ml-2 font-semibold text-bookvuk-navy hover:underline"
              >
                Sign up
              </Link>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Login;
