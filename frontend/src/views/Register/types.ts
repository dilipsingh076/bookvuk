/** Types local to the sign-up form. */

export type RegisterProps = {
  /** Rendered inside the auth dialog rather than as its own page. */
  embedded?: boolean;
  onCancel?: () => void;
  onSwitchToLogin?: () => void;
};

export type RegisterFields = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export const EMPTY_FIELDS: RegisterFields = { name: "", username: "", email: "", password: "" };
