"use client";

/** The closing ask: create an account, or sign in to the one you have. */

type LandingCtaProps = {
  onRegister: () => void;
  onLogin: () => void;
};

const LandingCta = ({ onRegister, onLogin }: LandingCtaProps) => (
  /* Dark panel + signup card. The 1080px cap is deliberate: it lines this panel
     up with the landing footer's `md:w-[1080px]` directly below it. Remove one
     and you must remove the other, or they visibly step. */
  <section className="mt-14 w-full">
    <div className="rounded-[28px] bg-bookvuk-navy px-6 py-10 shadow-lg sm:px-8 sm:py-12 md:px-10 md:py-14">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-8 xl:gap-10">
        <div className="min-w-0 lg:flex-1 lg:min-w-0 lg:pr-8">
          <div>
            <h3 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              Ready to dive into a new story?
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-[15px]">
              Create your free account today to build your library, save your favorite reads, and
              track your orders seamlessly.
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 sm:mx-auto sm:max-w-[380px] lg:mx-0 lg:w-[380px]">
          <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-bookvuk-navy/[0.08] sm:p-7">
            <p className="text-center text-base font-bold text-bookvuk-navy">Join BookVuk</p>
            <button
              type="button"
              onClick={onRegister}
              className="mt-5 w-full rounded-lg bg-bookvuk-purple py-3 text-sm font-semibold text-white transition-colors hover:bg-bookvuk-purple-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-bookvuk-purple focus-visible:ring-offset-2"
            >
              Create your free account
            </button>
            <p className="mt-4 text-center text-sm text-bookvuk-muted">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onLogin}
                className="font-semibold text-bookvuk-purple hover:underline"
              >
                Log in here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LandingCta;
