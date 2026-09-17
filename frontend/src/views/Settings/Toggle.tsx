"use client";

/**
 * A switch.
 *
 * `role="switch"` with `aria-checked` rather than a styled checkbox, because
 * this is a two-state control that acts immediately — there is no form to submit
 * it with.
 */

import { useState } from "react";

type ToggleProps = {
  id: string;
  label: string;
  description: string;
  defaultOn?: boolean;
};

const Toggle = ({ id, label, description, defaultOn = true }: ToggleProps) => {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-bookvuk-border/80 bg-white px-4 py-4 sm:px-5">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-bookvuk-navy">
          {label}
        </label>
        <p className="mt-1 text-xs leading-relaxed text-bookvuk-muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? "bg-bookvuk-purple" : "bg-bookvuk-border"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
};

export default Toggle;
