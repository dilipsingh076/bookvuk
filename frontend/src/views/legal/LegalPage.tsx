import type { ReactNode } from "react";
import { SectionHeading } from "../../components/ui";
import Link from "next/link";

/**
 * Shared shell for the policy pages.
 *
 * One component because these pages differ only in their words: same measure, same
 * heading rhythm, same "last updated" line. Three separate layouts would drift
 * apart, and a shop whose Terms and Privacy pages look like different websites
 * reads as careless about both.
 */
type LegalPageProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

const LegalPage = ({ title, updated, children }: LegalPageProps) => {

  return (
    <div className="pb-20 pt-8">
      <nav aria-label="Breadcrumb">
        <Link href="/" className="text-sm font-semibold text-bookvuk-purple hover:underline">
          ← BookVuk
        </Link>
      </nav>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-bookvuk-muted">Last updated {updated}</p>

      {/* Prose keeps a measure even though pages here are full width: a policy read
          across 1400px is a policy nobody finishes. */}
      <div className="mt-8 max-w-3xl space-y-8 text-sm leading-relaxed text-bookvuk-navy/90 sm:text-[15px]">
        {children}
      </div>

      <div className="mt-12 max-w-3xl rounded-2xl border border-bookvuk-border/80 bg-white p-6">
        <h2 className="text-base font-bold text-bookvuk-navy">Questions about this?</h2>
        <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
          Write to us and a person will answer.
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-block rounded-xl bg-bookvuk-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
};

/** Section heading, so every policy page has the same rhythm. */
export const Section = ({ heading, children }: { heading: string; children: ReactNode }) => (
  <section>
    <SectionHeading title={heading} />
    <div className="mt-2.5 space-y-3">{children}</div>
  </section>
);

export default LegalPage;
