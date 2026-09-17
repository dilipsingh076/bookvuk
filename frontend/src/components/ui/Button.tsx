import { forwardRef } from "react";

import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";

/* The variants below are the button shapes the app already had, named. They were
 * arrived at by reading every `bg-bookvuk-purple` / `border-bookvuk-border`
 * button in the codebase, not invented — so adopting them changes no pixels.
 */

type ButtonVariant =
  | "primary"
  /** Same purple, no hover treatment. Only the admin CRUD screens use this: the
   *  buttons there were written without one while every customer-facing button
   *  has it. Folding these into `primary` is a one-line change, but it is a
   *  visible one, so it needs a decision rather than a quiet cleanup. */
  | "primary-flat"
  /** Purple that fades on hover instead of darkening. */
  | "primary-fade"
  /** White with a border — the "Cancel" / "Back" half of a pair. */
  | "secondary"
  /** No border until hovered. Toolbars and icon rows. */
  | "ghost"
  /** Destructive: remove from cart, cancel an order, delete a category. */
  | "danger"
  /** Reads as a link, sized like a button. */
  | "link";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
type ButtonRadius = "lg" | "xl" | "2xl" | "full";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-bookvuk-purple text-white transition hover:bg-bookvuk-purple-hover disabled:opacity-60",
  "primary-flat": "bg-bookvuk-purple text-white",
  "primary-fade": "bg-bookvuk-purple text-white transition hover:opacity-90",
  secondary:
    "border border-bookvuk-border bg-white text-bookvuk-navy transition hover:bg-zinc-50 disabled:opacity-60",
  ghost:
    "text-bookvuk-muted transition-colors hover:bg-bookvuk-lilac hover:text-bookvuk-purple",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-60",
  link: "text-bookvuk-purple underline-offset-2 transition-colors hover:text-bookvuk-purple-hover hover:underline",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "px-3 py-1.5 text-xs font-semibold",
  sm: "px-3.5 py-2 text-xs font-semibold",
  md: "px-4 py-2 text-sm font-semibold",
  lg: "px-5 py-2.5 text-sm font-semibold",
  xl: "px-8 py-3.5 text-sm font-semibold",
};

const RADII: Record<ButtonRadius, string> = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  /** Stretch to the container. Pairs with `size` for the tall submit buttons. */
  block?: boolean;
};

/** The class string for a button, for the rare case that needs a bare `<a>`. */
export const buttonStyles = ({
  variant = "primary",
  size = "md",
  radius = "lg",
  block = false,
}: ButtonStyleProps = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2",
    // A disabled button should not still look clickable.
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    RADII[radius],
    block && "w-full",
  );

type ButtonProps = ButtonStyleProps &
  React.ButtonHTMLAttributes<HTMLButtonElement>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, radius, block, className, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size, radius, block }), className)}
      {...rest}
    />
  ),
);
Button.displayName = "Button";

type ButtonLinkProps = ButtonStyleProps & ComponentProps<typeof Link>;

/** A button that navigates. Separate from `Button` so it stays a real `<a>`:
 *  middle-click, ⌘-click and "copy link address" all keep working. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant, size, radius, block, className, ...rest }, ref) => (
    <Link
      ref={ref}
      className={cn(buttonStyles({ variant, size, radius, block }), className)}
      {...rest}
    />
  ),
);
ButtonLink.displayName = "ButtonLink";

export default Button;
