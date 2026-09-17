"use client";

import { Eyebrow } from "../../components/ui";
import { EMAIL, PHONE_DISPLAY, PHONE_HREF } from "./types";
import { useContact } from "./useContact";

const MailIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
    />
  </svg>
);

const PhoneIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
    />
  </svg>
);

const ClockIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/* Contact details come from the environment, not from source.
 *
 * These were hardcoded as a personal Gmail address and a phone number — the kind of
 * placeholder that quietly becomes a shop's public support channel. The email falls
 * back to the brand domain rather than anyone's inbox; the phone is only shown when
 * a real one is configured, because a wrong number is worse than no number.
 */

const Contact = () => {
  const { copied, copyEmail } = useContact();

  return (
    <div className="relative pb-20 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b from-bookvuk-lilac/90 via-bookvuk-cream/50 to-transparent"
        aria-hidden
      />
      <div className="relative px-4 sm:px-6">
        <div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl">Contact</h1>
          <p className="mt-3 text-base leading-relaxed text-bookvuk-muted sm:text-[17px]">
            Reach out to the BookVuk team—we’re happy to help with orders, your account, or general
            questions.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:gap-6">
          <aside className="flex min-h-full min-w-0 flex-col justify-between gap-6 rounded-3xl border border-bookvuk-border/80 bg-white/80 p-6 shadow-bookvuk-panel backdrop-blur-sm ring-1 ring-bookvuk-navy/[0.04] sm:p-8">
            <div>
              <h2 className="text-lg font-bold text-bookvuk-navy">We’re here to help</h2>
              <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
                Prefer email for order details; call us if you need something urgent.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-bookvuk-muted">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bookvuk-lilac text-bookvuk-purple">
                  <ClockIcon className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-semibold text-bookvuk-navy">Typical reply</span>
                  <br />
                  Within 1–2 business days
                </span>
              </li>
            </ul>
          </aside>

          <article className="group relative min-h-full min-w-0 rounded-3xl border border-bookvuk-border/70 bg-white p-6 shadow-bookvuk-card transition-shadow duration-300 hover:shadow-bookvuk-glow ring-1 ring-bookvuk-navy/[0.05] sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-bookvuk-lilac to-bookvuk-lilac/50 text-bookvuk-purple shadow-inner ring-1 ring-bookvuk-purple/10">
                <MailIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow>Email</Eyebrow>
                <div className="mt-1 max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <a
                    href={`mailto:${EMAIL}`}
                    className="inline-block whitespace-nowrap text-[15px] font-semibold text-bookvuk-purple underline-offset-2 transition-colors hover:text-bookvuk-purple-hover hover:underline"
                  >
                    {EMAIL}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-bookvuk-border/90 bg-bookvuk-cream/80 px-3.5 py-2 text-xs font-semibold text-bookvuk-navy transition hover:border-bookvuk-purple/25 hover:bg-bookvuk-lilac/60"
                >
                  {copied ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                        <path d="M8 6a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v10h6V4H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Copy email
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>

          {/* Only when a real number is configured: an unanswered or wrong number
              costs more trust than not offering a phone at all. */}
          {PHONE_DISPLAY ? (
          <article className="group relative min-h-full min-w-0 rounded-3xl border border-bookvuk-border/70 bg-white p-6 shadow-bookvuk-card transition-shadow duration-300 hover:shadow-bookvuk-glow-md ring-1 ring-bookvuk-navy/[0.05] sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-bookvuk-lilac to-bookvuk-lilac/50 text-bookvuk-purple shadow-inner ring-1 ring-bookvuk-purple/10">
                <PhoneIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <Eyebrow>Mobile</Eyebrow>
                <a
                  href={PHONE_HREF}
                  className="mt-1 inline-block whitespace-nowrap text-lg font-bold tabular-nums tracking-tight text-bookvuk-navy transition-colors hover:text-bookvuk-purple"
                >
                  {PHONE_DISPLAY}
                </a>
                <p className="mt-3 text-xs leading-relaxed text-bookvuk-muted">
                  Mon–Sat, 10:00–18:00 IST
                </p>
              </div>
            </div>
          </article>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Contact;
