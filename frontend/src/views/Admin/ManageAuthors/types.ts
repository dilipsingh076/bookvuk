/** Types local to the author admin. */

import type { AdminAuthor } from "../../../api/admin";

/** The editor's fields. `id` is not among them — which author is being edited
 *  is tracked separately, because "add" has no id and the form is the same. */
export type AuthorForm = {
  name: string;
  bio: string;
  status: AdminAuthor["status"];
};

export const EMPTY_FORM: AuthorForm = { name: "", bio: "", status: "active" };

/** The fallback when a name is left blank: the row still has to be findable. */
export const UNNAMED = "Unnamed author";
