/** Types local to the sign-in form. */

export type LoginProps = {
  /** Rendered inside the auth dialog rather than as its own page. */
  embedded?: boolean;
  onCancel?: () => void;
  onSwitchToRegister?: () => void;
  /**
   * Whether to send the visitor to their home page after signing in.
   *
   * False when this is the prompt raised by `requireAuth` over a page the visitor
   * was already using. It used to redirect unconditionally, so signing in to
   * finish an action moved them to /home and the action's own confirmation was
   * never seen — the sell form submitted the book and then vanished.
   */
  redirectOnSuccess?: boolean;
  /** Raise the reset dialog in place. Without it the button navigates, which
   *  closes this dialog and moves the visitor off the page they were on. */
  onForgotPassword?: () => void;
};

/** What the form holds. */
export type LoginFields = { email: string; password: string };
