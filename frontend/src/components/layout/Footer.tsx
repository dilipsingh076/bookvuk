import Link from "next/link";

import BrandLogo from "@/components/ui/BrandLogo";

/* The site footer, on every page.
 *
 * It lived inside the landing page, so `/browse`, `/help`, `/terms` and about
 * twenty-five other pages had no footer at all — and the small `Footer`
 * component that was supposed to serve them had no importer, so it rendered
 * nowhere. This is the landing page's version, which is the good one: fifteen
 * links into the shop, the story, and the legal pages.
 *
 * Rendered from the root layout, which is what makes those links internal
 * linking rather than decoration on one page.
 *
 * Note: `Home` and `About` also contain `<footer>` elements. Those are not site
 * footers — one is a quote attribution, the other a credits block — and they are
 * correct where they are.
 */
/* The wordmark as the footer uses it. Moved here with the footer; it was defined
 * in Landing and used only by that markup. */
const FooterMark = ({ className = "" }: { className?: string }) => (
  <BrandLogo
    className={className}
    size="lg"
    wordmarkClassName="text-2xl font-extrabold tracking-tight text-bookvuk-navy"
    showWordmark
  />
);

const Footer = () => (
<footer className="mt-16 bg-bookvuk-cream">
      <div className="w-full px-4 pb-6 pt-2">
        <div className="grid grid-cols-1 gap-10 border-b border-bookvuk-border pb-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-14">
          <div className="lg:pr-4">
            <FooterMark />
            <p className="mt-4 text-sm leading-relaxed text-bookvuk-muted">
              Your premier digital library and bookstore. Discover,
              organize, and read the best books from around the world.
            </p>
          </div>

          <div>
            <div className="text-sm font-bold text-bookvuk-navy">Shop</div>
            <ul className="mt-4 space-y-3 text-sm text-bookvuk-muted">
              <li>
                <Link href="/browse" className="hover:text-bookvuk-navy">
                  All books
                </Link>
              </li>
              <li>
                <Link href="/browse?sort=popular" className="hover:text-bookvuk-navy">
                  Most popular
                </Link>
              </li>
              <li>
                <Link href="/browse?sort=newest" className="hover:text-bookvuk-navy">
                  New arrivals
                </Link>
              </li>
              <li>
                <Link href="/authors" className="hover:text-bookvuk-navy">
                  Browse authors
                </Link>
              </li>
              <li>
                <Link href="/sell" className="hover:text-bookvuk-navy">
                  Sell your books
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-bold text-bookvuk-navy">About</div>
            <ul className="mt-4 space-y-3 text-sm text-bookvuk-muted">
              <li>
                <Link href="/about" className="hover:text-bookvuk-navy">
                  Our story
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-bookvuk-navy">
                  Contact us
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-bookvuk-navy">
                  Help &amp; FAQs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-bold text-bookvuk-navy">Legal</div>
            <ul className="mt-4 space-y-3 text-sm text-bookvuk-muted">
              <li>
                <Link href="/terms" className="hover:text-bookvuk-navy">
                  Terms of service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-bookvuk-navy">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/shipping-returns" className="hover:text-bookvuk-navy">
                  Shipping &amp; returns
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row">
          <p className="text-xs font-medium text-bookvuk-muted">
            © {new Date().getFullYear()} BookVuk Platform. All rights
            reserved.
          </p>
          {/* The icons here linked to twitter.com, instagram.com and
              facebook.com — the platforms' own front pages, not this shop's
              profiles. A brand icon that lands on somebody else's homepage is a
              dead end wearing a real link's clothes, so these are the pages we
              do have. Put the icons back once there are accounts to point at. */}
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-bookvuk-muted">
            <Link href="/help" className="hover:text-bookvuk-navy">
              Help
            </Link>
            <Link href="/contact" className="hover:text-bookvuk-navy">
              Contact
            </Link>
            <Link href="/terms" className="hover:text-bookvuk-navy">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-bookvuk-navy">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
);

export default Footer;
