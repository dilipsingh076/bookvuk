import LegalPage, { Section } from "./LegalPage";
import Link from "next/link";

/** Shipping, cancellation and returns — the mechanics as the site implements them. */
const ShippingReturns = () => (
  <LegalPage
    title="Shipping and returns"
    updated="20 August 2026"
  >
    <Section heading="What shipping costs">
      <p>
        Shipping is a flat charge per order, shown as its own line at checkout before
        you pay, alongside tax. Nothing is added after that.
      </p>
    </Section>

    <Section heading="When it arrives">
      <p>
        Orders are packed on working days. You can follow yours from{" "}
        <Link href="/orders" className="font-semibold text-bookvuk-purple hover:underline">
          your orders
        </Link>{" "}
        — each stage is stamped with the time it happened, so &ldquo;packed&rdquo; and &ldquo;shipped&rdquo;
        show when, not just that.
      </p>
      <p>We email you at each stage, so you do not have to come back and check.</p>
    </Section>

    <Section heading="Books waiting for stock">
      <p>
        If something in your cart has run out, it is not dropped. It stays in your cart
        marked <strong>waiting for stock</strong>, is left out of your total, and the
        rest of your order ships normally. When it comes back we email you and it is
        already there to buy.
      </p>
      <p>
        Titles people are waiting for are the ones we restock first, so asking to be
        notified genuinely moves it up the queue.
      </p>
    </Section>

    <Section heading="Cancelling an order">
      <p>
        You can cancel from{" "}
        <Link href="/orders" className="font-semibold text-bookvuk-purple hover:underline">
          your orders
        </Link>{" "}
        while the order is still <strong>processing</strong>. After it is packed the
        button is gone — write to us and we will sort it out by hand.
      </p>
      <p>
        Cancelling puts the books back into stock immediately, so somebody else can
        buy them.
      </p>
    </Section>

    <Section heading="Refunds">
      <p>
        A cancelled order is refunded to the method you paid with. If you paid partly
        with store credit, that part returns to your credit balance and the rest goes
        back to your card or UPI — you are not left short on either.
      </p>
      <p>
        Bank refunds take as long as your bank takes, usually a few working days.
        Credit is back on your account straight away.
      </p>
    </Section>

    <Section heading="Used books">
      <p>
        Used copies are graded by us before listing, and the grade is stated on the
        book&rsquo;s page with what it means. If a used copy arrives materially worse than
        its grade, tell us and we will make it right.
      </p>
    </Section>

    <Section heading="Sending us books to sell">
      <p>
        Post approved books to the address we give you when we accept your offer. We
        check each one on arrival, and if it grades differently we tell you the revised
        amount before paying anything.
      </p>
      <p>
        Track everything from{" "}
        <Link href="/sell/requests" className="font-semibold text-bookvuk-purple hover:underline">
          your sell requests
        </Link>
        .
      </p>
    </Section>
  </LegalPage>
);

export default ShippingReturns;
