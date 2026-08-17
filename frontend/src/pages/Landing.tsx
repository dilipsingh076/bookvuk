import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import useFetch from "../hooks/useFetch";
import { fetchBooks, type Book } from "../api/index";
import BookCard from "../components/BookCard";
import GuestCollectionModal from "../components/GuestCollectionModal";
import BrandLogo from "../components/ui/BrandLogo";

type Feature = {
  title: string;
  sub: string;
  icon: ReactNode;
};

const LandingFooterMark = ({ className = "" }: { className?: string }) => (
  <BrandLogo
    className={className}
    size="lg"
    wordmarkClassName="text-2xl font-extrabold tracking-tight text-booknest-navy"
    showWordmark
  />
);

const Landing = () => {
  const { isAuthenticated } = useAuth();
  const { openLoginModal, openRegisterModal } = useAuthModal();
  const navigate = useNavigate();
  const { data: books, loading } = useFetch<Book[]>(() => fetchBooks(), []);

  const [guestCollectionOpen, setGuestCollectionOpen] = useState(false);

  const trending = useMemo(() => (books || []).slice(0, 4), [books]);

  const features: Feature[] = [
    {
      title: "Massive Collection",
      sub: "Explore thousands of titles in a clean, fast experience.",
      icon: (
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
            d="M4 4h16v16H4z"
            opacity="0.2"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 7h10M7 12h7M7 17h10"
          />
        </svg>
      ),
    },
    {
      title: "Personalized Wishlist",
      sub: "Save favorites and continue your reading later.",
      icon: (
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
            d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"
          />
        </svg>
      ),
    },
    {
      title: "Swift Delivery",
      sub: "Smooth checkout with instant confirmation and updates.",
      icon: (
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
            d="M3 7h6l2 3h10v7H3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z"
          />
        </svg>
      ),
    },
  ];

  const goBrowse = () => {
    if (isAuthenticated) navigate("/browse");
    else setGuestCollectionOpen(true);
  };

  const goBrowseOrRegister = () => {
    if (isAuthenticated) navigate("/browse");
    else openRegisterModal();
  };

  const openTrendingBook = (book: Book) => {
    if (isAuthenticated) navigate(`/books/${book.id}`);
    else setGuestCollectionOpen(true);
  };

  return (
    <div className="min-h-screen bg-booknest-cream">
      <div className="w-full px-4 py-14">
        {/* Hero */}
        <section className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] rounded-[20px] bg-white py-7">
          <div className="ml-7">
            <div className="text-xs font-bold tracking-wide text-booknest-purple">
              Welcome to the BookNest
            </div>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight text-booknest-navy md:text-5xl">
              Your infinite digital library awaits.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-booknest-muted">
              Browse your next favorite read, build a wishlist, and manage your
              cart in one smooth experience.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={goBrowseOrRegister}
                className="inline-flex items-center justify-center rounded-md bg-booknest-purple px-6 py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
              >
                Sign up and read
              </button>
              <button
                type="button"
                onClick={goBrowse}
                className="inline-flex items-center justify-center rounded-md border border-booknest-border bg-white px-6 py-3 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
              >
                Explore collection
              </button>
            </div>
          </div>

          <div className="relative pr-7">
            <div className="overflow-hidden rounded-3xl shadow-booknest-card ring-1 ring-booknest-navy/[0.06]">
              <img
                src="/assets/Homepage.jpg"
                alt="Book shelves"
                className="w-full object-cover h-[300px]"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.dataset.fallbackApplied === "1") return;
                  img.dataset.fallbackApplied = "1";
                  img.src = "/assets/landingpage.jpg";
                }}
              />
            </div>
            <div className="absolute left-5 top-5 rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-booknest-border backdrop-blur">
              <div className="text-xs font-bold text-booknest-purple">10k+</div>
              <div className="text-sm font-semibold text-booknest-navy">
                Consumer
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-booknest-navy">
            Everything a reader needs
          </h2>
          <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-booknest-border bg-white p-7 shadow-booknest-card"
              >
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-booknest-lilac text-booknest-purple">
                    {f.icon}
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-booknest-navy">
                      {f.title}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-booknest-muted">
                      {f.sub}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trending */}
        <section className="mt-14">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-extrabold text-booknest-navy">
              Trending this week
            </h2>
            <button
              type="button"
              onClick={goBrowse}
              className="text-sm font-semibold text-booknest-purple hover:underline"
            >
              View all
            </button>
          </div>

          {!loading ? (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
              {trending.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  variant="trending"
                  onOpen={openTrendingBook}
                />
              ))}
            </div>
          ) : null}
        </section>

        {/* CTA — dark panel + signup card; width capped to match footer */}
        <section className="mx-auto mt-14 w-full max-w-[1080px]">
          <div className="rounded-[28px] bg-booknest-navy px-6 py-10 shadow-lg sm:px-8 sm:py-12 md:px-10 md:py-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-8 xl:gap-10">
              <div className="min-w-0 lg:flex-1 lg:min-w-0 lg:pr-8">
                <div className="max-w-xl">
                  <h3 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                    Ready to dive into a new story?
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-[15px]">
                    Create your free account today to build your library, save
                    your favorite reads, and track your orders seamlessly.
                  </p>
                </div>
              </div>

              <div className="w-full shrink-0 sm:mx-auto sm:max-w-[380px] lg:mx-0 lg:w-[380px]">
                <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-booknest-navy/[0.08] sm:p-7">
                  <p className="text-center text-base font-bold text-booknest-navy">
                    Join BookNest
                  </p>
                  <button
                    type="button"
                    onClick={() => openRegisterModal()}
                    className="mt-5 w-full rounded-lg bg-booknest-purple py-3 text-sm font-semibold text-white transition-colors hover:bg-booknest-purple-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-booknest-purple focus-visible:ring-offset-2"
                  >
                    Create your free account
                  </button>
                  <p className="mt-4 text-center text-sm text-booknest-muted">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => openLoginModal()}
                      className="font-semibold text-booknest-purple hover:underline"
                    >
                      Log in here
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer — reference: brand column + Shop / About / Legal + bar with socials */}
        <footer className="mt-16 bg-booknest-cream">
          <div className="mx-auto w-full px-4 pb-6 pt-2 md:w-[1080px]">
            <div className="grid grid-cols-1 gap-10 border-b border-booknest-border pb-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-14">
              <div className="lg:pr-4">
                <LandingFooterMark />
                <p className="mt-4 text-sm leading-relaxed text-booknest-muted">
                  Your premier digital library and bookstore. Discover,
                  organize, and read the best books from around the world.
                </p>
              </div>

              <div>
                <div className="text-sm font-bold text-booknest-navy">Shop</div>
                <ul className="mt-4 space-y-3 text-sm text-booknest-muted">
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                      onClick={goBrowse}
                    >
                      All Books
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                      onClick={goBrowse}
                    >
                      Bestsellers
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                      onClick={goBrowse}
                    >
                      New Arrivals
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                      onClick={goBrowse}
                    >
                      Browse Authors
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <div className="text-sm font-bold text-booknest-navy">
                  About
                </div>
                <ul className="mt-4 space-y-3 text-sm text-booknest-muted">
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Our Story
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Blog
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Careers
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Contact Us
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <div className="text-sm font-bold text-booknest-navy">
                  Legal
                </div>
                <ul className="mt-4 space-y-3 text-sm text-booknest-muted">
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Terms of Service
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-left hover:text-booknest-navy"
                    >
                      Shipping &amp; Returns
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row">
              <p className="text-xs font-medium text-booknest-muted">
                © {new Date().getFullYear()} BookNest Platform. All rights
                reserved.
              </p>
              <div className="flex items-center gap-5 text-booknest-muted/80">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-booknest-navy"
                  aria-label="X"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-booknest-navy"
                  aria-label="Instagram"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle
                      cx="17.5"
                      cy="6.5"
                      r="0.9"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-booknest-navy"
                  aria-label="Facebook"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <GuestCollectionModal
        isOpen={guestCollectionOpen}
        onClose={() => setGuestCollectionOpen(false)}
        onSignIn={openLoginModal}
      />
    </div>
  );
};

export default Landing;
