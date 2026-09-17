/** @type {import('next').NextConfig} */

/* Where uploaded book covers live once the API stores them off its own disk.
 *
 * A container filesystem does not survive a deploy, so on any PaaS the API
 * writes covers to Supabase Storage instead and `books.cover_image` comes back
 * as an absolute URL on that host. The CSP's `img-src` has to name that host or
 * the browser blocks every cover, with nothing in the network tab to say why.
 *
 * Unset on a local run, where covers are still served from the API's own
 * `/static` mount through the rewrites below — so nothing changes by default.
 *
 *   NEXT_PUBLIC_MEDIA_ORIGIN=https://<project-ref>.supabase.co
 */
const mediaOrigin = process.env.NEXT_PUBLIC_MEDIA_ORIGIN?.trim().replace(/\/+$/, "");

/* The storefront runs as a Node server now rather than a folder of static files,
 * because that is what server-rendering the catalogue requires. `standalone`
 * output is what keeps the container small: Next traces the modules actually
 * imported and copies only those, instead of shipping node_modules.
 */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,

  // `x-powered-by: Next.js` tells an attacker which framework and therefore which
  // CVEs to try. It buys nothing.
  poweredByHeader: false,

  // A build must not ship with type errors or lint failures. Next lets both be
  // ignored; stating them explicitly means nobody turns them off by accident.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  /* No `images` block: the app renders plain <img> through `components/ui/Img`
   * rather than `next/image`, so the optimiser is never invoked and every key
   * that configured it (formats, deviceSizes, imageSizes, remotePatterns) would
   * be config that reads as load-bearing and does nothing. `Img` explains why.
   *
   * The media origin below is still needed — it feeds the CSP, which applies to
   * a plain <img> exactly as it did to an optimised one.
   */

  // The catalogue is read through the FastAPI service. Proxying it through Next
  // means the browser talks to one origin, so there is no CORS preflight on
  // every catalogue request and cookies would work if the session ever moves off
  // localStorage.
  /* Security headers.
   *
   * None of these were set. They are the difference between "it works" and "it
   * can be deployed": without them the site can be framed by anyone, leaks its
   * full referrer to third parties, and lets a browser guess content types.
   *
   * The CSP allows `unsafe-inline` for styles because Tailwind and next/font
   * inject them, and for scripts because Next inlines its hydration payload.
   * Tightening those needs nonces, which is a separate piece of work — stated
   * here rather than left as a silent gap.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      /* Razorpay pulls scripts from two hosts, and both were found by opening the
       * modal in a real browser rather than by reading the docs:
       *
       * - `checkout.razorpay.com` serves the widget itself. Blocked, `loadRazorpay()`
       *   just fails, which reads as a gateway problem rather than a policy one.
       * - `cdn.razorpay.com` serves its risk-detection bundle, loaded from inside
       *   the modal once it opens. Blocking that leaves the gateway scoring a
       *   payment with a signal missing, so a legitimate card can be declined —
       *   and nothing in our own logs would say why.
       */
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${mediaOrigin ? ` ${mediaOrigin}` : ""}`,
      "font-src 'self' data:",
      // The API is same-origin through the rewrites below, so it needs no entry.
      // The Razorpay hosts do: the widget talks to `api.razorpay.com` and posts
      // its own diagnostics to `lumberjack.razorpay.com`, and a blocked
      // diagnostics call surfaces as a checkout that hangs rather than an error.
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
      // The payment modal is an iframe from checkout.razorpay.com, not from the
      // API host — listing only the latter leaves an empty modal.
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/auth/:path*", destination: `${api}/auth/:path*` },
    ];
  },
};

export default nextConfig;
