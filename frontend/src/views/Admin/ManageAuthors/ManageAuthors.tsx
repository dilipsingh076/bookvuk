"use client";

/** The author records behind the catalogue. */

import { Button, Input, LoaderBlock } from "../../../components/ui";
import AuthorEditor from "./AuthorEditor";
import { AuthorView, DeleteAuthor } from "./AuthorPanels";
import { useManageAuthors } from "./useManageAuthors";

const ManageAuthors = () => {
  const a = useManageAuthors();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Manage Authors</div>
              <div className="mt-1 text-sm text-bookvuk-muted">Update profiles and statuses.</div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={a.refresh}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
              >
                Refresh
              </button>
              <Button type="button" onClick={a.openAdd} variant="primary-flat">
                Add author
              </Button>
            </div>
          </div>

          <div className="mt-5 rounded-xl border bg-bookvuk-lilac p-4">
            <Input
              value={a.q}
              onChange={(e) => a.setQ(e.target.value)}
              placeholder="Search by author name or bio"
              className="rounded-lg border-gray-200 px-3 py-2"
            />
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-bookvuk-navy">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={a.showActive}
                  onChange={(e) => a.setShowActive(e.target.checked)}
                  className="h-4 w-4"
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={a.showDraft}
                  onChange={(e) => a.setShowDraft(e.target.checked)}
                  className="h-4 w-4"
                />
                Draft
              </label>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-5">Author</div>
              <div className="col-span-2">Books</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Actions</div>
            </div>
            <div className="divide-y bg-white">
              {a.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading authors…" />
              ) : a.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(a.error as { message?: string } | undefined)?.message ||
                    "Failed to load authors"}
                </div>
              ) : a.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">No authors found.</div>
              ) : (
                a.rows.map((author) => (
                  <div key={author.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                    <div className="col-span-5">
                      <div className="font-semibold text-bookvuk-navy">{author.name}</div>
                      {author.bio ? (
                        <div className="mt-1 line-clamp-2 text-xs text-bookvuk-muted">
                          {author.bio}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-bookvuk-muted">No bio</div>
                      )}
                    </div>
                    <div className="col-span-2 text-bookvuk-navy">
                      {a.bookCountFor(author.name)}
                    </div>
                    <div className="col-span-2 font-semibold text-bookvuk-navy">
                      {author.status}
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => a.openEdit(author.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-bookvuk-navy"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => a.view(author)}
                        className="rounded-lg bg-bookvuk-lilac px-3 py-1.5 text-xs font-semibold text-bookvuk-navy"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => a.askDelete(author)}
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthorEditor
        editorOpen={a.editorOpen}
        editingId={a.editingId}
        form={a.form}
        setFormField={a.setFormField}
        saving={a.saving}
        saveError={a.saveError}
        closeEditor={a.closeEditor}
        save={a.save}
      />

      <AuthorView
        author={a.viewing}
        bookCount={a.viewing ? a.bookCountFor(a.viewing.name) : 0}
        onClose={a.closeView}
      />

      <DeleteAuthor
        author={a.deleteTarget}
        onCancel={a.cancelDelete}
        onConfirm={a.confirmDelete}
      />
    </>
  );
};

export default ManageAuthors;
