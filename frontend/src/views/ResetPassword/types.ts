/** Types local to the password-reset flow. */

export type ResetPasswordProps = {
  /** Rendered inside the auth dialog rather than as its own page. */
  embedded?: boolean;
  /** Called once the reset is finished, so the dialog can offer sign-in. */
  onDone?: () => void;
  onCancel?: () => void;
};

/**
 * Which of the flow's three screens to draw.
 *
 * `request` and `choose` are told apart by the `?token=` in the URL, not by a
 * step counter: the second is reached from a link in an e-mail, in a fresh
 * browser with no state to have counted anything.
 */
export type ResetStage = "request" | "choose" | "done";

/** The minimum the server will accept, repeated so the form can say so up front. */
export const MIN_PASSWORD_LENGTH = 8;
