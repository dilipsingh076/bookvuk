"use client";

/** Add or edit a title — one form, because the fields are the same either way. */

import Modal from "../../../components/ui/Modal";
import { Button, Input, Select, Textarea } from "../../../components/ui";
import type { UseManageBooks } from "./useManageBooks";

type BookEditorProps = { books: UseManageBooks };

const BookEditor = ({ books: b }: BookEditorProps) => (
  <Modal isOpen={b.editorOpen} onClose={b.closeEditor} panelClassName="max-w-2xl">
    <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
      <div className="text-sm font-semibold text-bookvuk-navy">
        {b.editingId ? "Edit book" : "Add book"}
      </div>
      <button
        type="button"
        onClick={b.closeEditor}
        className="rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
      >
        Close
      </button>
    </div>
    <div className="space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <div className="text-xs font-semibold text-bookvuk-muted">Title</div>
          <Input
            value={b.form.title}
            onChange={(e) => b.setFormField("title", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-bookvuk-muted">Author</div>
          <Select
            value={b.form.authorName}
            onChange={(e) => b.setFormField("authorName", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2 font-semibold text-bookvuk-navy"
          >
            {b.authors.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-bookvuk-muted">Category</div>
          <Select
            value={b.form.categoryId}
            onChange={(e) => b.setFormField("categoryId", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2 font-semibold text-bookvuk-navy"
          >
            {b.cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-bookvuk-muted">Format</div>
          <Input
            value={b.form.format}
            onChange={(e) => b.setFormField("format", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2"
          />
        </label>

        <label className="block sm:col-span-2">
          <div className="text-xs font-semibold text-bookvuk-muted">Description</div>
          <Textarea
            value={b.form.description}
            onChange={(e) => b.setFormField("description", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2"
            rows={3}
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-bookvuk-muted">Price (₹)</div>
          <Input
            value={b.form.price}
            onChange={(e) => b.setFormField("price", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-bookvuk-muted">Stock</div>
          <Input
            value={b.form.stock}
            onChange={(e) => b.setFormField("stock", e.target.value)}
            className="mt-2 rounded-lg px-3 py-2"
          />
        </label>

        <label className="block sm:col-span-2">
          <div className="text-xs font-semibold text-bookvuk-muted">Cover image</div>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => b.setCoverFile(e.currentTarget.files?.[0] ?? null)}
            className="mt-2 rounded-lg px-3 py-2"
          />
          <div className="mt-2 text-xs text-bookvuk-muted">
            Optional. If provided, it will be uploaded after saving the book.
          </div>
        </label>
      </div>

      {b.saveError ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {b.saveError}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={b.closeEditor}
          className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
        >
          Cancel
        </button>
        <Button type="button" onClick={b.save} disabled={b.saving} variant="primary-flat">
          {b.saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  </Modal>
);

export default BookEditor;
