import { cn } from "../../lib/cn";

/* The inline message strip above a form or under a failed action.
 *
 * These were written out per page, which is why the same failure reads as
 * `rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700`
 * on one screen and `rounded-2xl bg-rose-50 p-2 text-lg ...` on another.
 */

type AlertTone = "error" | "success" | "warning" | "info";

const TONES: Record<AlertTone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-bookvuk-border bg-bookvuk-lilac text-bookvuk-navy",
};

type AlertProps = {
  tone?: AlertTone;
  /** Centre the text. The sign-in and register forms do. */
  center?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const Alert = ({ tone = "error", center = false, className, children, ...rest }: AlertProps) => (
  <div
    // An error a user needs to act on should be announced, not just drawn.
    role={tone === "error" ? "alert" : "status"}
    className={cn(
      "rounded-xl border px-4 py-3 text-sm",
      TONES[tone],
      center && "text-center",
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export default Alert;
