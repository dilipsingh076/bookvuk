"use client";

import { useId } from "react";

import { cn } from "../../lib/cn";

/* A label bound to its control, plus room for a hint and an error.
 *
 * The binding is the point. Most forms in the app wrapped the input inside the
 * `<label>`, which works, but meant every field re-declared
 * `text-sm font-semibold text-bookvuk-navy` and none of them could describe an
 * error to a screen reader. `Field` generates the ids and wires
 * `aria-describedby` / `aria-invalid` so that comes for free.
 */

type FieldProps = {
  label: React.ReactNode;
  /** Rendered under the control, quieter than the label. */
  hint?: React.ReactNode;
  /** When set, replaces the hint and marks the control invalid. */
  error?: React.ReactNode;
  required?: boolean;
  /** Receives the ids to spread onto the input/select/textarea. */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
  className?: string;
  /** Gap between the label and the control. `mt-2` is the app's usual. */
  gap?: "sm" | "md";
  /** Overrides the hint's own classes. The sign-up form sets its password hint
   *  heavier and further from the field than the default. */
  hintClassName?: string;
};

const Field = ({
  label,
  hint,
  error,
  required,
  children,
  className,
  gap = "md",
  hintClassName,
}: FieldProps) => {
  const base = useId();
  const id = `${base}-control`;
  const messageId = error ? `${base}-error` : hint ? `${base}-hint` : undefined;

  return (
    <div className={cn("block", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-bookvuk-navy">
        {label}
        {required ? (
          <span className="ml-0.5 text-rose-600" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className={gap === "md" ? "mt-2" : "mt-1"}>
        {children({ id, "aria-describedby": messageId, invalid: Boolean(error) })}
      </div>
      {error ? (
        // `role="alert"` so the message is announced when it appears, not only
        // when the field is next focused.
        <p id={messageId} role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className={cn("mt-1.5 text-xs text-bookvuk-muted", hintClassName)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default Field;
