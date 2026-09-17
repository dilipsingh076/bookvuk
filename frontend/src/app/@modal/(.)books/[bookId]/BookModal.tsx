"use client";

import { usePathname } from "next/navigation";

import BookDetails from "@/views/BookDetails";

/* A book opened from the catalogue, over the page it was opened from.
 *
 * React Router did this by stashing the previous location in `location.state`
 * and rendering two <Routes> trees. Next's equivalent is an intercepting route:
 * `(.)books/[bookId]` catches a client-side navigation to a book and renders it
 * into the layout's `@modal` slot, while a fresh page load or a shared link falls
 * through to the real `/books/[bookId]` page — which is the behaviour wanted,
 * since the full page is what gets indexed and shared.
 *
 * No `<Modal>` wrapper here: `BookDetails` supplies its own when `isModal` is
 * set, along with the Escape handling and the `router.back()` that dismisses it.
 */
const BookModal = () => {
  const pathname = usePathname();

  /* The dialog closes itself once the route is no longer a book.
   *
   * A parallel slot keeps its contents across a soft navigation, so leaving the
   * dialog for another page left it sitting on top of whatever loaded
   * underneath — the cart, in the case that surfaced this.
   *
   * Deciding from the current path rather than dismissing on click means there
   * is nothing to sequence. An earlier attempt called `router.back()` and pushed
   * the new route a tick later; `back()` is asynchronous, so the push was
   * sometimes swallowed and the dialog closed without going anywhere.
   *
   * Note for anyone tempted to add a click handler here: `Modal` renders through
   * a portal into `document.body`, so the dialog is not inside this component's
   * DOM and a handler here would never see those clicks. The links inside it work
   * on their own — what was breaking them lived in `Modal`'s backdrop.
   */
  if (!pathname?.startsWith("/books/")) return null;

  return <BookDetails isModal />;
};

export default BookModal;
