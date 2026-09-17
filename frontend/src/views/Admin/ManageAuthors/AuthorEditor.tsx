"use client";

/** Add or edit — one form, because the fields are the same either way. */

import Modal from "../../../components/ui/Modal";
import { Button, Input, Select, Textarea } from "../../../components/ui";
import type { AdminAuthor } from "../../../api/admin";
import type { UseManageAuthors } from "./useManageAuthors";

type AuthorEditorProps = Pick<
  UseManageAuthors,
  "editorOpen" | "editingId" | "form" | "setFormField" | "saving" | "saveError" | "closeEditor" | "save"
>;

const AuthorEditor = ({
  editorOpen,
  editingId,
  form,
  setFormField,
  saving,
  saveError,
  closeEditor,
  save,
}: AuthorEditorProps) => (
  <Modal isOpen={editorOpen} onClose={closeEditor} panelClassName="max-w-2xl">
    <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
      <div className="text-sm font-semibold text-bookvuk-navy">
        {editingId ? "Edit author" : "Add author"}
      </div>
      <button
        type="button"
        onClick={closeEditor}
        className="rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
      >
        Close
      </button>
    </div>
    <div className="space-y-4 p-6">
      <label className="block">
        <div className="text-xs font-semibold text-bookvuk-muted">Name</div>
        <Input
          value={form.name}
          onChange={(e) => setFormField("name", e.target.value)}
          className="mt-2 rounded-lg px-3 py-2"
        />
      </label>
      <label className="block">
        <div className="text-xs font-semibold text-bookvuk-muted">Bio</div>
        <Textarea
          value={form.bio}
          onChange={(e) => setFormField("bio", e.target.value)}
          className="mt-2 rounded-lg px-3 py-2"
          rows={4}
        />
      </label>
      <label className="block">
        <div className="text-xs font-semibold text-bookvuk-muted">Status</div>
        <Select
          value={form.status}
          onChange={(e) => setFormField("status", e.target.value as AdminAuthor["status"])}
          className="mt-2 rounded-lg px-3 py-2 font-semibold text-bookvuk-navy"
        >
          <option value="active">active</option>
          <option value="draft">draft</option>
        </Select>
      </label>
      {saveError ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {saveError}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={closeEditor}
          className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
        >
          Cancel
        </button>
        <Button type="button" onClick={save} disabled={saving} variant="primary-flat">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  </Modal>
);

export default AuthorEditor;
