"use client";

/** An icon, a heading, and what the section is for. Two of these on the page. */

import type { ReactNode } from "react";

type SectionHeaderProps = {
  icon: ReactNode;
  title: string;
  hint: string;
};

const SectionHeader = ({ icon, title, hint }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 border-b border-bookvuk-border/80 pb-4">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-bookvuk-lilac to-bookvuk-lilac/60 text-bookvuk-purple shadow-inner ring-1 ring-bookvuk-purple/10">
      {icon}
    </span>
    <div>
      <h2 className="text-base font-bold tracking-tight text-bookvuk-navy">{title}</h2>
      <p className="mt-0.5 text-xs text-bookvuk-muted">{hint}</p>
    </div>
  </div>
);

export const UserIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z"
    />
  </svg>
);

export const LockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z"
    />
  </svg>
);

export default SectionHeader;
