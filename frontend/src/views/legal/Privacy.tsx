"use client";

import LegalPage, { Section } from "./LegalPage";
import Link from "next/link";

/**
 * Privacy policy.
 *
 * Describes what this application genuinely stores and sends, taken from the code
 * rather than a template: the tokens in localStorage, the guest cart, the four
 * kinds of email the job queue sends, and the fact that card numbers never reach
 * our servers.
 */
const Privacy = () => (
  <LegalPage
    title="Privacy policy"
    updated="20 August 2026"
  >
    <p>
      This explains what we keep, why we keep it, and how to get rid of it. It is
      written to match what the software actually does.
    </p>

    <Section heading="What we store">
      <ul className="ml-5 list-disc space-y-1.5">
        <li>
          <strong>Your account</strong> — name, username and email address. Your
          password is stored only as a one-way hash; we cannot read it, and neither
          can anyone who obtains the database.
        </li>
        <li>
          <strong>Delivery addresses</strong> you save, and a copy attached to each
          order — so editing your address later never rewrites where past orders went.
        </li>
        <li>
          <strong>Orders</strong>: what you bought, what it cost and its status.
        </li>
        <li>
          <strong>Your cart and wishlist</strong>, including books you asked to be
          notified about.
        </li>
        <li>
          <strong>Buyback requests</strong> — the book, the condition, what we offered,
          and the UPI id if you asked for a bank payout.
        </li>
        <li>
          <strong>Store credit</strong> as a list of movements, so every rupee added
          or spent has a record you can see on your own page.
        </li>
        <li>
          <strong>Reviews</strong> you write, shown publicly with your display name.
        </li>
      </ul>
    </Section>

    <Section heading="What we do not store">
      <p>
        <strong>Card numbers.</strong> Payments go through our payment provider&rsquo;s own
        window. Card and UPI credentials are entered there and never reach our
        servers, so there is nothing of that kind for us to lose.
      </p>
    </Section>

    <Section heading="What is kept in your browser">
      <p>
        We do not use advertising or tracking cookies. Your browser holds two things:
      </p>
      <ul className="ml-5 list-disc space-y-1.5">
        <li>
          <strong>Your session</strong> — the tokens that keep you signed in. Signing
          out removes them and revokes them on our side.
        </li>
        <li>
          <strong>A guest cart</strong>, if you add books before signing in. It stays
          in your browser until you sign in, at which point it merges into your
          account cart and the local copy is cleared.
        </li>
      </ul>
    </Section>

    <Section heading="Emails we send">
      <p>Only about your own activity — never marketing you did not ask for:</p>
      <ul className="ml-5 list-disc space-y-1.5">
        <li>Order confirmation, and updates when an order is packed, shipped or delivered.</li>
        <li>A notice when a book you asked about comes back into stock.</li>
        <li>Progress on a book you offered to sell us.</li>
        <li>One reminder if you leave something in your cart.</li>
        <li>A password reset link, when you ask for one.</li>
      </ul>
    </Section>

    <Section heading="Who else sees it">
      <p>
        Our payment provider, to take payment and issue refunds. Our email provider,
        to deliver the messages above. Our hosting and database provider, which stores
        the data described here over an encrypted connection.
      </p>
      <p>We do not sell your data, and we do not share it for advertising.</p>
    </Section>

    <Section heading="Getting your data removed">
      <p>
        Ask us and we will delete your account and everything attached to it — cart,
        wishlist, addresses, buyback requests and credit balance. Deleting the account
        forfeits any unspent store credit, so spend or cash it out first.
      </p>
      <p>
        Completed orders are kept as long as we are required to keep sales records,
        because they are also our accounts.
      </p>
      <p>
        <Link href="/contact" className="font-semibold text-bookvuk-purple hover:underline">
          Contact us
        </Link>{" "}
        to make a request, or to correct anything that is wrong.
      </p>
    </Section>
  </LegalPage>
);

export default Privacy;
