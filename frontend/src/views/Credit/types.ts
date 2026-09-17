/** Helpers local to the store-credit page. */

export const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

/** The default cap, used only until the server states the real one. */
export const DEFAULT_REDEMPTION_PERCENT = 50;
