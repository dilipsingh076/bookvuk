"use client";

/** The categories books are filed under. */

import Modal from "../../../components/ui/Modal";
import { Button, Input } from "../../../components/ui";
import { useCategories } from "./useCategories";

const Categories = () => {
  const c = useCategories();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Categories</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                Manage categories used for book organization.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={c.refresh}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
              >
                Refresh
              </button>
              <Button type="button" onClick={c.openDialog} variant="primary-flat">
                Add category
              </Button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-8">Name</div>
              <div className="col-span-4">Id</div>
            </div>
            <div className="divide-y bg-white">
              {c.loading ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">Loading...</div>
              ) : c.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(c.error as { message?: string } | undefined)?.message ||
                    "Failed to load categories"}
                </div>
              ) : c.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">No categories found.</div>
              ) : (
                c.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                    <div className="col-span-8 font-semibold text-bookvuk-navy">{row.name}</div>
                    <div className="col-span-4 truncate text-xs font-semibold text-bookvuk-muted">
                      {row.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={c.open} onClose={c.closeDialog}>
        <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Add category</div>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <div className="text-xs font-semibold text-bookvuk-muted">Category name</div>
            <Input
              value={c.name}
              onChange={(e) => c.setName(e.target.value)}
              className="mt-2 rounded-lg px-3 py-2"
            />
          </label>
          {c.saveError ? (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {c.saveError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={c.closeDialog}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={c.save}
              disabled={c.saving || c.name.trim().length === 0}
              variant="primary-flat"
            >
              {c.saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Categories;
