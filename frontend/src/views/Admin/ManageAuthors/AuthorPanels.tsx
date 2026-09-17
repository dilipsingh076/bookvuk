"use client";

/** The two read-only dialogs: looking at an author, and removing one. */

import Modal from "../../../components/ui/Modal";
import type { AdminAuthor } from "../../../api/admin";

type AuthorViewProps = {
  author: AdminAuthor | null;
  bookCount: number;
  onClose: () => void;
};

export const AuthorView = ({ author, bookCount, onClose }: AuthorViewProps) => (
  <Modal isOpen={!!author} onClose={onClose} panelClassName="max-w-2xl">
    {author ? (
      <>
        <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
          <div className="text-sm font-semibold text-bookvuk-navy">{author.name}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
          >
            Close
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-xl bg-bookvuk-lilac p-4">
            <div className="text-sm font-semibold text-bookvuk-navy">Status</div>
            <div className="mt-1 text-sm text-bookvuk-navy">{author.status}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-sm font-semibold text-bookvuk-navy">Bio</div>
            <div className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
              {author.bio || "No bio"}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-sm font-semibold text-bookvuk-navy">Books</div>
            <div className="mt-2 text-sm text-bookvuk-muted">{bookCount} linked titles</div>
          </div>
        </div>
      </>
    ) : null}
  </Modal>
);

type DeleteAuthorProps = {
  author: AdminAuthor | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DeleteAuthor = ({ author, onCancel, onConfirm }: DeleteAuthorProps) => (
  <Modal isOpen={!!author} onClose={onCancel}>
    {author ? (
      <>
        <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Remove author</div>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-bookvuk-muted">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-bookvuk-navy">{author.name}</span>? Books linked to
            this author will be reassigned to <span className="font-semibold">Unknown</span>.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete author
            </button>
          </div>
        </div>
      </>
    ) : null}
  </Modal>
);
