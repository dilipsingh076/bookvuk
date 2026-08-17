import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-[20px] bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.06]">
    <h2 className="text-base font-bold text-booknest-navy">{title}</h2>
    <div className="mt-3 space-y-2 text-sm leading-relaxed text-booknest-muted">{children}</div>
  </section>
);

const Help = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="mx-auto max-w-2xl pb-16 pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-booknest-navy">Help &amp; support</h1>
        <p className="mt-2 text-sm leading-relaxed text-booknest-muted">
          Quick answers for using BookNest—browse, cart, wishlist, and your account.
        </p>
      </div>

      <div className="space-y-5">
        <Section title="Getting started">
          <p>
            Open{" "}
            {isAuthenticated ? (
              <Link to="/browse" className="font-semibold text-booknest-purple hover:underline">
                Browse
              </Link>
            ) : (
              "Browse"
            )}{" "}
            for the full catalogue. Use the search box on that page to find books by title, author, category,
            or keyword—results update as you type. Category filters are in the sidebar.
          </p>
        </Section>

        <Section title="Cart &amp; checkout">
          <p>
            Add items from a book’s page or from cards in Browse. Open your cart from the nav after you
            sign in, review quantities, then proceed to checkout when you’re ready.
            {isAuthenticated ? (
              <>
                {" "}
                Go to{" "}
                <Link to="/cart" className="font-semibold text-booknest-purple hover:underline">
                  Cart
                </Link>{" "}
                or{" "}
                <Link to="/checkout" className="font-semibold text-booknest-purple hover:underline">
                  Checkout
                </Link>
                .
              </>
            ) : (
              <span className="block pt-1 text-xs text-booknest-muted">
                Cart and checkout are available after you sign in.
              </span>
            )}
          </p>
        </Section>

        <Section title="Wishlist">
          <p>
            Save books you like with the heart icon.
            {isAuthenticated ? (
              <>
                {" "}
                View and manage your list under{" "}
                <Link to="/wishlist" className="font-semibold text-booknest-purple hover:underline">
                  Wishlist
                </Link>{" "}
                in the navigation.
              </>
            ) : (
              <>
                {" "}
                <span className="font-medium text-booknest-navy">Wishlist</span> is available in the
                navigation after you sign in.
              </>
            )}
          </p>
        </Section>

        <Section title="Account &amp; profile">
          <p>
            {isAuthenticated ? (
              <>
                Update your name and password under{" "}
                <Link to="/profile" className="font-semibold text-booknest-purple hover:underline">
                  Profile
                </Link>{" "}
                in the account menu.
              </>
            ) : (
              <>
                After you sign in, you can update your name and password under{" "}
                <span className="font-medium text-booknest-navy">Profile</span> in the account menu.
              </>
            )}
          </p>
        </Section>

        <Section title="Need more help?">
          <p>
            For order or account issues, contact support through your registered email—we’ll get back
            as soon as we can.
          </p>
        </Section>
      </div>

      {isAuthenticated && <p className="mt-10 text-center text-xs text-booknest-muted">
        <Link to="/browse" className="font-semibold text-booknest-purple hover:underline">
          Browse books
        </Link>
        <span className="mx-2 text-booknest-border">·</span>
        <Link to="/" className="font-semibold text-booknest-purple hover:underline">
          Back to start
        </Link>
      </p>}
    </div>
  );
};

export default Help;
