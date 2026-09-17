import { forwardRef } from "react";

import { cn } from "../../lib/cn";

/* Text inputs, selects and textareas share one focus treatment so a form cannot
 * end up with two different purples on two different fields — which is what was
 * happening: `focus:ring-bookvuk-purple/15` in most places and `/20` in one.
 */

const CONTROL = cn(
  "w-full rounded-xl border border-bookvuk-border bg-white px-3.5 py-2.5 text-sm",
  "outline-none focus:border-bookvuk-purple/40 focus:ring-2 focus:ring-bookvuk-purple/15",
  // A disabled field must not look like an empty one you can type in.
  "disabled:cursor-not-allowed disabled:bg-bookvuk-cream disabled:text-bookvuk-muted",
);

/** Set when the field has failed validation, so the border carries the message
 *  too — colour alone is not available to everyone reading the form. */
const INVALID = "border-rose-300 focus:border-rose-400 focus:ring-rose-200";

type InputProps = { invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, className, ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid && INVALID, className)}
      {...rest}
    />
  ),
);
Input.displayName = "Input";

type TextareaProps = { invalid?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid && INVALID, className)}
      {...rest}
    />
  ),
);
Textarea.displayName = "Textarea";

type SelectProps = { invalid?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid, className, ...rest }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "cursor-pointer", invalid && INVALID, className)}
      {...rest}
    />
  ),
);
Select.displayName = "Select";

/* The taller field used by the sign-in and sign-up forms: a leading icon, the
 * input, and sometimes a trailing control like "Show" on a password.
 *
 * The wrapper takes the focus ring via `focus-within`, so clicking the icon or
 * the padding focuses the field — which is what makes the whole box feel like
 * the control rather than a rectangle drawn around one.
 */
type IconInputProps = {
  icon: React.ReactNode;
  /** A "Show"/"Hide" toggle or a unit label, pinned to the right. */
  trailing?: React.ReactNode;
  wrapperClassName?: string;
  /* Declared for the same reason as on the other three controls, and because
   * `Field` hands `invalid` to whatever it wraps: without it here, that flag
   * fell through to the `<input>` as a non-standard DOM attribute and the field
   * showed no error state at all. The border lives on the wrapper, so that is
   * where the invalid styling has to go. */
  invalid?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon, trailing, wrapperClassName, className, invalid, ...rest }, ref) => (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-bookvuk-border bg-bookvuk-cream px-4 py-3",
        "focus-within:ring-2 focus-within:ring-bookvuk-purple/40",
        invalid && "border-rose-300 focus-within:ring-rose-200",
        wrapperClassName,
      )}
    >
      {/* The icon is placed directly in the flex row rather than wrapped. A
          wrapper span is an inline box, so it carries a line box the svg does
          not — enough to push the input ~2px narrower. The caller styles its own
          icon; this component owns the box, the focus ring and the input. */}
      {icon}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full bg-transparent text-sm outline-none placeholder:text-bookvuk-muted",
          className,
        )}
        {...rest}
      />
      {trailing}
    </div>
  ),
);
IconInput.displayName = "IconInput";

