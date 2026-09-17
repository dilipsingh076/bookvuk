"use client";

/**
 * The sign-up form itself, written once.
 *
 * It used to exist twice in this file — once for the modal and once for the
 * standalone page — around 170 lines each, differing only in a subtitle, a
 * Cancel button and where "Sign in" pointed. The two copies had already drifted:
 * their mail and padlock icons were drawn differently. Anything that varies
 * between the two placements is a prop; everything else is shared.
 */

import { Alert, Button, Field, IconInput } from "../../components/ui";
import { LockIcon, MailIcon, PersonIcon, UsersIcon } from "../../components/ui/icons";
import type { UseRegister } from "./useRegister";

type RegisterFormProps = {
  form: UseRegister;
  subtitle: string;
  onSignIn: () => void;
  onCancel?: () => void;
};

const RegisterForm = ({ form, subtitle, onSignIn, onCancel }: RegisterFormProps) => (
  <>
    <div>
      <h3 className="text-2xl font-bold text-bookvuk-navy">Create account</h3>
      <p className="mt-1 text-sm text-bookvuk-muted">{subtitle}</p>
    </div>

    <form onSubmit={form.submit} className="mt-7 space-y-4">
      <Field label="Full name">
        {(field) => (
          <IconInput
            {...field}
            icon={<PersonIcon />}
            value={form.fields.name}
            onChange={(e) => form.setField("name", e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
          />
        )}
      </Field>

      <Field label="Username">
        {(field) => (
          <IconInput
            {...field}
            icon={<UsersIcon />}
            value={form.fields.username}
            onChange={(e) => form.setField("username", e.target.value)}
            placeholder="your_username"
            required
            autoComplete="username"
          />
        )}
      </Field>

      <Field label="Email address">
        {(field) => (
          <IconInput
            {...field}
            icon={<MailIcon />}
            value={form.fields.email}
            onChange={(e) => form.setField("email", e.target.value)}
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        )}
      </Field>

      <Field
        label="Password"
        hint="Use at least 8 characters."
        hintClassName="mt-2 text-xs font-semibold text-bookvuk-muted"
      >
        {(field) => (
          <IconInput
            {...field}
            icon={<LockIcon />}
            value={form.fields.password}
            onChange={(e) => form.setField("password", e.target.value)}
            type={form.showPassword ? "text" : "password"}
            placeholder="Create a password"
            required
            autoComplete="new-password"
            trailing={
              <button
                type="button"
                onClick={form.toggleShowPassword}
                className="shrink-0 text-xs font-semibold text-bookvuk-navy hover:underline"
              >
                {form.showPassword ? "Hide" : "Show"}
              </button>
            }
          />
        )}
      </Field>

      {form.error ? (
        <Alert
          tone="error"
          className="flex justify-center rounded-2xl border-0 p-2 text-lg font-semibold"
        >
          {form.error}
        </Alert>
      ) : null}

      <Button type="submit" radius="2xl" block className="gap-3 px-0 py-3">
        Create account
      </Button>

      {onCancel ? (
        <Button
          variant="secondary"
          radius="2xl"
          block
          onClick={onCancel}
          className="px-0 py-3 hover:bg-bookvuk-cream"
        >
          Cancel
        </Button>
      ) : null}

      <div className={`flex justify-center text-sm ${onCancel ? "pt-1" : "pt-2"}`}>
        <span className="text-bookvuk-muted">Already have an account?</span>
        <button
          type="button"
          onClick={onSignIn}
          className="ml-2 font-semibold text-bookvuk-navy hover:underline"
        >
          Sign in
        </button>
      </div>
    </form>
  </>
);

export default RegisterForm;
