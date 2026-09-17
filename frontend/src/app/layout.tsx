import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/styles/index.css";
import Providers from "./providers";
import Footer from "@/components/layout/Footer";
import { MEDIA_ORIGIN, SITE_URL } from "@/lib/site";

/* Inter, self-hosted by Next instead of imported from fonts.googleapis.com.
 *
 * The stylesheet `@import` it replaces was a blocking request to a third party
 * before any text could render. `display: "swap"` keeps text visible while the
 * face loads, and the weights are the ones the design system actually uses. */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});

/* The one sentence that has to say what this shop is.
 *
 * It used to open "Browse thousands of titles" on a catalogue of 200 books. That
 * is the description Google shows under the homepage and the one every page
 * without its own inherited, so the site's most-read sentence was also its least
 * true — and a shopper who arrives expecting thousands and finds two hundred
 * leaves, which is the bounce that search ranking actually punishes.
 *
 * What replaces it leads with the thing no general marketplace offers: you can
 * sell books here, not only buy them. The numbers are the real ones from the
 * catalogue, and the languages are the reason someone picks this over Amazon. */
const DESCRIPTION =
  "Buy new and second-hand books in English and Hindi — or sell your old books back for store credit. 200 titles across fiction, business, history and Hindi literature, delivered across India.";

/* What used to be hand-written `<meta>` tags in index.html, plus everything
 * `usePageMeta` was reproducing at runtime. Because these are rendered into the
 * HTML on the server, the scrapers that build link previews — WhatsApp,
 * Twitter/X, Slack, LinkedIn, iMessage — finally see them; they never ran the
 * JavaScript that used to set them.
 *
 * `metadataBase` is what makes the relative image paths below resolve to
 * absolute URLs, which those scrapers require.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BookVuk — Buy & Sell Books Online in English and Hindi",
    // Each page supplies its own title; this is the suffix they inherit.
    template: "%s · BookVuk",
  },
  description: DESCRIPTION,
  applicationName: "BookVuk",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "BookVuk",
    title: "BookVuk — Buy & Sell Books Online in English and Hindi",
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
    alternateLocale: ["hi_IN"],
    images: [
      {
        url: "/assets/og-card.jpg",
        width: 1200,
        height: 630,
        alt: "BookVuk — buy and sell books in English and Hindi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BookVuk — Buy & Sell Books Online in English and Hindi",
    description: DESCRIPTION,
    images: ["/assets/og-card.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#6C47FF",
  width: "device-width",
  initialScale: 1,
};

/* `modal` is a parallel route slot. It carries the book dialog that opens over
 * the catalogue; see `@modal/(.)books/[bookId]`. */
const RootLayout = ({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) => (
  <html lang="en" className={inter.variable}>
    <head>
      {/* Book covers are served from object storage on another origin, so the
          first one on a page pays for a DNS lookup and a TLS handshake before a
          byte of image arrives — measured at 0.44s cold. Opening that connection
          while the HTML is still parsing takes it off the critical path.
          Omitted entirely when covers are same-origin. */}
      {MEDIA_ORIGIN ? (
        <>
          <link rel="preconnect" href={MEDIA_ORIGIN} crossOrigin="" />
          <link rel="dns-prefetch" href={MEDIA_ORIGIN} />
        </>
      ) : null}
    </head>
    <body className="bg-bookvuk-cream text-bookvuk-navy">
      <Providers>
        {children}
        {modal}
        {/* In the layout so every page has it. The footer's fifteen links are
            the site's internal linking; on the landing page alone they were
            decoration. */}
        <Footer />
      </Providers>
    </body>
  </html>
);

export default RootLayout;
