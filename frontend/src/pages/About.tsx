const BookOpenIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    />
  </svg>
);

const MagnifyingGlassIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const HeartIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"
    />
  </svg>
);

const CartIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  </svg>
);

const About = () => {
  return (
    <div className="relative pb-24 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-gradient-to-b from-booknest-lilac/85 via-booknest-cream/45 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto px-4 sm:px-6">
        <header className="max-w-3xl">
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-booknest-navy sm:text-4xl">About us</h1>
          <p className="mt-4 text-base leading-relaxed text-booknest-muted sm:text-[17px]">
            BookNest is your digital bookstore—discover titles, save favourites, and checkout with a calm,
            reader-first experience. We focus on a clear catalogue, honest pricing, and tools that help you
            build your personal library.
          </p>
        </header>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {[
            {
              title: "Clear catalogue",
              body: "Browse and search without clutter—covers, categories, and stock at a glance.",
              Icon: MagnifyingGlassIcon
            },
            {
              title: "Wishlist that sticks",
              body: "Save titles with one tap so nothing gets lost while you decide.",
              Icon: HeartIcon
            },
            {
              title: "Calm checkout",
              body: "Your cart waits until you are ready—no noise, just a smooth path to pay.",
              Icon: CartIcon
            }
          ].map(({ title, body, Icon }) => (
            <div
              key={title}
              className="rounded-3xl border border-booknest-border/80 bg-white/90 p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.04] transition-shadow hover:shadow-[0_12px_40px_-20px_rgba(108,71,255,0.12)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-booknest-lilac to-booknest-lilac/60 text-booknest-purple ring-1 ring-booknest-purple/10">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-bold text-booknest-navy">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-booknest-muted">{body}</p>
            </div>
          ))}
        </div>

        <section className="relative mt-12 overflow-hidden rounded-3xl border border-booknest-border/70 bg-gradient-to-br from-white via-booknest-lilac/30 to-booknest-lilac/50 p-8 shadow-[0_20px_60px_-28px_rgba(26,29,46,0.18)] ring-1 ring-booknest-purple/10 sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-booknest-purple/10 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-rose-100/40 blur-3xl" aria-hidden />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-booknest-purple shadow-inner ring-1 ring-booknest-purple/15">
              <BookOpenIcon className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold tracking-tight text-booknest-navy sm:text-2xl">Our mission</h2>
              <p className="mt-3 text-base leading-relaxed text-booknest-navy/85 sm:text-[17px]">
                To make finding and buying books simple: powerful search, a wishlist you actually use, and a
                cart that stays out of your way until you are ready.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-20 border-t border-booknest-border/70 pt-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-booknest-muted">Credits</p>
          <p className="mt-3 text-sm text-booknest-navy">
            <span className="text-booknest-muted">made by:</span>{" "}
            <span className="font-semibold">Kunal Singh Rajpurohit & Dilip Singh</span>
          </p>
          <p className="mt-1 text-sm font-medium text-booknest-muted">Web developer</p>
        </footer>
      </div>
    </div>
  );
};

export default About;
