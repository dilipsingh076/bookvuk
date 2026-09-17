"use client";

/**
 * What an account is for. Page only — the dialog is opened from wherever the
 * visitor already was, and does not need to be sold the idea again.
 */

import { Card } from "../../components/ui";

const PERKS = [
  { title: "Personalized wishlist", sub: "Keep track of your favorites" },
  { title: "Fast cart updates", sub: "Quantity and totals stay in sync" },
];

const RegisterAside = () => (
  <Card
    as="section"
    padding="lg"
    elevation="sm"
    className="relative border-bookvuk-border bg-white/70 backdrop-blur"
  >
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bookvuk-lilac text-bookvuk-navy">
        B
      </span>
      <div>
        <div className="text-sm font-semibold text-bookvuk-navy">BookVuk</div>
        <div className="text-xs font-semibold text-bookvuk-muted">Create your account</div>
      </div>
    </div>

    <h2 className="mt-5 text-4xl font-extrabold leading-tight text-bookvuk-navy">
      Join the reading community
    </h2>
    <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
      Save your wishlist, build your cart, and checkout in seconds.
    </p>

    <div className="mt-7 rounded-2xl bg-white/80 p-4 ring-1 ring-bookvuk-navy/[0.06]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bookvuk-purple text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <div className="text-sm font-semibold text-bookvuk-navy">Your cart is kept</div>
          <div className="mt-1 text-xs font-semibold text-bookvuk-muted">
            Anything you added before signing up moves into your account.
          </div>
        </div>
      </div>
    </div>

    <div className="mt-7 space-y-3">
      {PERKS.map((x) => (
        <div
          key={x.title}
          className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-bookvuk-navy/[0.06]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bookvuk-lilac text-bookvuk-navy">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2l1.8 6H20l-5 3.8L16.8 20 12 16.9 7.2 20 9 11.8 4 8h6.2L12 2Z"
              />
            </svg>
          </span>
          <div>
            <div className="text-sm font-semibold text-bookvuk-navy">{x.title}</div>
            <div className="mt-1 text-xs font-semibold text-bookvuk-muted">{x.sub}</div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

export default RegisterAside;
