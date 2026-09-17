"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteReview,
  fetchReviews,
  submitReview,
  type ReviewSummary,
} from "../api/commerce";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { Button, Input, Textarea } from "../components/ui";

type BookReviewsProps = { bookId: string };

const Stars = ({ value }: { value: number }) => (
  <span aria-label={`${value} out of 5`} className="text-amber-500">
    {"★".repeat(value)}
    <span className="text-bookvuk-border">{"★".repeat(5 - value)}</span>
  </span>
);

const BookReviews = ({ bookId }: BookReviewsProps) => {
  const { getToken, isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await fetchReviews(bookId));
    } catch (err: any) {
      setError(err?.message || "Could not load reviews");
    }
  }, [bookId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = summary?.items.find((r) => r.is_mine) || null;

  // Prefill the form when editing an existing review.
  useEffect(() => {
    if (!mine) return;
    setRating(mine.rating);
    setTitle(mine.title || "");
    setBody(mine.body || "");
    /* `mine` itself is deliberately absent. It comes from `.find()`, so it is a
       new object on every render; listing it would re-run this effect constantly
       and overwrite whatever the reviewer was in the middle of typing. The id is
       what actually identifies a different review, which is the only time the
       form should be refilled. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitReview(getToken(), bookId, {
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "Could not save your review");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteReview(getToken(), bookId);
      setRating(5);
      setTitle("");
      setBody("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Could not remove your review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 border-t border-bookvuk-border pt-8">
      <h2 className="text-lg font-extrabold text-bookvuk-navy">
        Reviews {summary ? `(${summary.count})` : ""}
      </h2>

      {summary && summary.count > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="text-3xl font-extrabold text-bookvuk-navy">
            {summary.average.toFixed(1)}
          </div>
          <div>
            <Stars value={Math.round(summary.average)} />
            <div className="text-xs text-bookvuk-muted">
              from {summary.count} {summary.count === 1 ? "review" : "reviews"}
            </div>
          </div>
          <div className="ml-auto w-full max-w-xs space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.breakdown[String(star)] || 0;
              const pct = summary.count ? Math.round((count / summary.count) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-bookvuk-muted">
                  <span className="w-3 tabular-nums">{star}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-bookvuk-lilac">
                    <span
                      className="block h-full rounded-full bg-bookvuk-purple"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-8 tabular-nums text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-bookvuk-muted">
          No reviews yet — be the first to say what you thought.
        </p>
      )}

      {/* Write / edit */}
      <div className="mt-6 rounded-2xl border border-bookvuk-border bg-white p-5">
        <div className="text-sm font-bold text-bookvuk-navy">
          {mine ? "Edit your review" : "Write a review"}
        </div>

        <div className="mt-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              aria-label={`Rate ${star} out of 5`}
              className={`text-2xl leading-none ${star <= rating ? "text-amber-500" : "text-bookvuk-border"}`}
            >
              ★
            </button>
          ))}
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Headline (optional)"
          maxLength={120}
          className="mt-3 rounded-lg px-3 py-2"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you think of it?"
          rows={3}
          maxLength={4000}
          className="mt-2 rounded-lg px-3 py-2"
        />

        {error ? (
          <div className="mt-3 rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-700">{error}</div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            disabled={busy}
            // Guests get the sign-in prompt and their review is saved right after.
            onClick={() => requireAuth(() => void save())}
            variant="primary"
          >
            {busy ? "Saving…" : mine ? "Update review" : "Post review"}
          </Button>
          {mine && isAuthenticated ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-lg border border-bookvuk-border px-4 py-2 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac disabled:opacity-60"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {/* Existing reviews */}
      {summary && summary.items.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {summary.items.map((r) => (
            <li key={r.id} className="rounded-2xl border border-bookvuk-border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="text-sm font-semibold text-bookvuk-navy">{r.author_name}</span>
                  {r.is_mine ? (
                    <span className="rounded-full bg-bookvuk-lilac px-2 py-0.5 text-[10px] font-bold text-bookvuk-purple">
                      YOU
                    </span>
                  ) : null}
                  {/* Anyone can rate any book here, bought or not. Saying which
                      reviewers actually received the book from us is what makes
                      the rest of the ratings worth weighing. */}
                  {r.verified_purchase ? (
                    <span
                      title="This reader bought this book from us"
                      className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200"
                    >
                      VERIFIED PURCHASE
                    </span>
                  ) : null}
                </div>
                <time className="text-xs text-bookvuk-muted">
                  {new Date(r.created_at).toLocaleDateString()}
                </time>
              </div>
              {r.title ? (
                <div className="mt-2 text-sm font-bold text-bookvuk-navy">{r.title}</div>
              ) : null}
              {r.body ? (
                <p className="mt-1 whitespace-pre-line text-sm text-bookvuk-muted">{r.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

export default BookReviews;
