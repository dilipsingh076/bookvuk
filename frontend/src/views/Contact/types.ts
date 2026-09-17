/**
 * Who to contact, from the environment rather than the markup.
 *
 * The phone number is optional: a shop with no phone line should show no phone
 * row at all rather than a placeholder nobody answers.
 */

export const EMAIL: string = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bookvuk.com";
export const PHONE_DISPLAY: string = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";
/** Stripped to digits and a leading +, which is all `tel:` accepts. */
export const PHONE_HREF = PHONE_DISPLAY ? `tel:${PHONE_DISPLAY.replace(/[^\d+]/g, "")}` : "";

/** How long "Copied" stays on the button. */
export const COPIED_MS = 2000;
