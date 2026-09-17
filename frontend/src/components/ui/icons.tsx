/* The icons that label form fields.
 *
 * These were inline `<svg>` blocks repeated across the sign-in and sign-up
 * forms, and the copies had already drifted apart: the sign-up modal drew the
 * mail icon with two paths where the sign-in form and the standalone sign-up
 * page drew it with four, and its padlock used square line caps where the others
 * were rounded. That is what duplicated markup does over time — the same icon
 * stops being the same icon.
 *
 * The four-path mail and the rounded padlock are the versions kept, since they
 * were what two of the three copies already used.
 */

import { cn } from "../../lib/cn";

type IconProps = { className?: string };

const FIELD_ICON = "h-5 w-5 text-bookvuk-muted";

/* `cn` rather than `className ?? FIELD_ICON`: replacing the defaults meant that
 * asking for a smaller icon — `<MailIcon className="h-4 w-4" />` — silently
 * dropped `text-bookvuk-muted` and turned it black. Merging keeps the colour and
 * still lets a caller override it. */
const Svg = ({ className, children }: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className={cn(FIELD_ICON, className)}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden
  >
    {children}
  </svg>
);

export const MailIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" opacity="0.2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l8 6 8-6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 18l5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 18l-5-5" />
  </Svg>
);

export const LockIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 11V9a7 7 0 1 1 14 0v2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5v10h14V11Z" />
  </Svg>
);

export const PersonIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 0 0-16 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
  </Svg>
);

export const UsersIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-3-3.87" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
  </Svg>
);
