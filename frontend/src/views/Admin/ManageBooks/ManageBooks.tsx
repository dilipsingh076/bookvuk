"use client";

/** The catalogue, from the shop's side. */

import { Button, ConfirmDialog, LoaderBlock } from "../../../components/ui";
import BookEditor from "./BookEditor";
import BookFilters from "./BookFilters";
import { useManageBooks } from "./useManageBooks";
import { LOW_STOCK } from "./types";

const ManageBooks = () => {
  const b = useManageBooks();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Manage Books</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                Create, edit, delete, and update inventory.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={b.refresh}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
              >
                Refresh
              </button>
              <Button type="button" onClick={b.openAdd} variant="primary-flat">
                Add book
              </Button>
            </div>
          </div>

          <BookFilters books={b} />

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-5">Book</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2">Actions</div>
            </div>
            <div className="divide-y bg-white">
              {b.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading books…" />
              ) : b.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(b.error as { message?: string } | undefined)?.message || "Failed to load books"}
                </div>
              ) : b.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">No books found.</div>
              ) : (
                b.rows.map((book) => (
                  <div
                    key={book.id}
                    className="grid grid-cols-12 items-start gap-2 px-4 py-3 text-sm"
                  >
                    <div className="col-span-5">
                      <div className="font-semibold text-bookvuk-navy">{book.title}</div>
                      <div className="mt-1 text-xs text-bookvuk-muted">
                        by {book.author || "Unknown"}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-bookvuk-muted">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            book.stock === 0
                              ? "bg-rose-100 text-rose-700"
                              : book.stock <= LOW_STOCK
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {book.stock} in stock
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3 text-bookvuk-navy">
                      {b.categoryFor(book.category_id)}
                    </div>
                    <div className="col-span-2 font-semibold text-bookvuk-navy">
                      ₹{book.price.toFixed(2)}
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => b.openEdit(String(book.id))}
                        className="rounded-lg border border-bookvuk-border bg-white px-3 py-1.5 text-xs font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => b.askDelete(book)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-bookvuk-muted hover:bg-rose-50 hover:text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-bookvuk-muted">
              {b.rangeEnd != null ? (
                <>
                  Showing{" "}
                  <span className="font-semibold text-bookvuk-navy">
                    {b.currentPage * b.pageSize - b.pageSize + 1}
                  </span>{" "}
                  to <span className="font-semibold text-bookvuk-navy">{b.rangeEnd}</span> of{" "}
                  <span className="font-semibold text-bookvuk-navy">{b.totalCount}</span>
                </>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={b.currentPage <= 1}
                onClick={b.prevPage}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={b.pageCount <= b.currentPage}
                onClick={b.nextPage}
                className="rounded-lg bg-bookvuk-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <BookEditor books={b} />

      <ConfirmDialog
        open={!!b.deleteTarget}
        title={`Delete “${b.deleteTarget?.title ?? ""}”?`}
        body={
          <>
            This removes the title from the catalogue. Past orders keep their own copy of the title
            and price, so they are unaffected — but the book stops being buyable and disappears from
            search.
            {b.removeError ? (
              <span className="mt-2 block font-semibold text-rose-700">{b.removeError}</span>
            ) : null}
          </>
        }
        confirmLabel="Delete book"
        busy={b.removing}
        onConfirm={b.confirmRemove}
        onCancel={b.cancelDelete}
      />
    </>
  );
};

export default ManageBooks;
