"use client";

/**
 * Attaching photographs from a phone.
 *
 * Used by the sell flow and by returns, because they are the same act on the
 * same device: somebody is standing over a book with a camera, on mobile data,
 * and the picture their phone produces is several times larger than any server
 * will accept. The shrinking happens in `api/buyback.ts::downscaleImage`; what
 * this owns is the part the person sees.
 *
 * `capture="environment"` asks the phone for the rear camera directly rather
 * than the photo library, which is what someone photographing a book in front of
 * them actually wants.
 */

import { useRef, useState } from "react";
import Img from "./ui/Img";

type PhotoSlot = {
  /** Stable id from the server, used to remove it again. */
  id: string;
  url: string;
  /** Shown under the thumbnail, e.g. "Cover". Omitted when unlabelled. */
  label?: string;
};

type PhotoUploaderProps = {
  photos: PhotoSlot[];
  max: number;
  /** What this photo should show, when the caller labels its slots. */
  kindLabel?: string;
  busy?: boolean;
  /** Absent means the photos can no longer be changed. */
  onAdd?: (file: File) => void;
  onRemove?: (photoId: string) => void;
  /** One line under the control saying why the photos matter here. */
  hint?: string;
};

const PhotoUploader = ({
  photos,
  max,
  kindLabel,
  busy = false,
  onAdd,
  onRemove,
  hint,
}: PhotoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const full = photos.length >= max;
  const readOnly = !onAdd;

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <figure key={p.id} className="relative">
            <button
              type="button"
              onClick={() => setZoomed(zoomed === p.url ? null : p.url)}
              className="block overflow-hidden rounded-xl border border-bookvuk-border"
              aria-label={`View ${p.label || "photo"} larger`}
            >
              <Img
                src={p.url}
                alt={p.label || "Photo of the book"}
                className="h-24 w-24 object-cover"
              />
            </button>
            {p.label ? (
              <figcaption className="mt-1 text-center text-[11px] text-bookvuk-muted">
                {p.label}
              </figcaption>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                disabled={busy}
                aria-label={`Remove ${p.label || "this photo"}`}
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white text-sm font-bold text-rose-700 shadow ring-1 ring-bookvuk-border disabled:opacity-50"
              >
                ×
              </button>
            ) : null}
          </figure>
        ))}

        {!readOnly && !full ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-bookvuk-border text-xs font-semibold text-bookvuk-muted hover:border-bookvuk-purple hover:text-bookvuk-purple disabled:opacity-50"
            >
              <span className="text-xl leading-none">+</span>
              {busy ? "Uploading…" : kindLabel || "Add photo"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Clear first: picking the same file twice in a row fires no
                // change event otherwise, so a retry after a failure does nothing.
                e.target.value = "";
                if (file) onAdd?.(file);
              }}
            />
          </>
        ) : null}
      </div>

      {hint && !readOnly ? (
        <p className="mt-2 text-xs text-bookvuk-muted">{hint}</p>
      ) : null}
      {full && !readOnly ? (
        <p className="mt-2 text-xs text-bookvuk-muted">That is all {max} photos.</p>
      ) : null}

      {zoomed ? (
        <button
          type="button"
          onClick={() => setZoomed(null)}
          className="mt-3 block w-full overflow-hidden rounded-xl border border-bookvuk-border"
          aria-label="Close the larger view"
        >
          <Img src={zoomed} alt="Photo of the book, larger" className="w-full object-contain" />
        </button>
      ) : null}
    </div>
  );
};

export default PhotoUploader;
