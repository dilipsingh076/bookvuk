import LegalPage, { Section } from "./LegalPage";
import Link from "next/link";

/**
 * Terms of service.
 *
 * Written to describe what this shop actually does — the cancellation window, the
 * grading step in buyback, the cap on store credit — rather than generic clauses.
 * A policy that does not match the software is worse than none: it is the document
 * someone quotes back when the two disagree.
 */
const Terms = () => (
  <LegalPage
    title="Terms of service"
    updated="20 August 2026"
  >
    <p>
      These terms cover using BookVuk — browsing, ordering, selling us your used
      books, and spending the credit that earns. Using the site means accepting them.
    </p>

    <Section heading="Your account">
      <p>
        Browsing and getting a buyback quote need no account. Ordering, saving to a
        wishlist and selling to us do.
      </p>
      <p>
        Keep your password to yourself — anything done from your account is treated
        as done by you. Changing your password signs out every other device, which is
        the fastest way to lock someone else out.
      </p>
    </Section>

    <Section heading="Prices and availability">
      <p>
        Prices are in Indian rupees and include what is shown at checkout: the item
        price, shipping and tax are listed separately before you pay.
      </p>
      <p>
        Stock is limited and not reserved by adding something to your cart. If a
        title runs out before you check out, we do not sell what we do not have —
        the item stays in your cart marked <strong>waiting for stock</strong>, is
        excluded from your total, and the rest of your order goes through normally.
        We email you when it is back.
      </p>
      <p>
        Used copies are graded by us before they are listed. What each grade means is
        stated on the book&rsquo;s page, and the price reflects it.
      </p>
    </Section>

    <Section heading="Orders, cancellation and refunds">
      <p>
        An order can be cancelled while it is still <strong>processing</strong>. Once
        it is packed or shipped it cannot be cancelled from the site — write to us
        instead.
      </p>
      <p>
        Cancelling returns the books to our stock and starts a refund of anything you
        paid. Money goes back to the method you paid with; any store credit you used
        goes back to your credit balance. See{" "}
        <Link href="/shipping-returns" className="font-semibold text-bookvuk-purple hover:underline">
          shipping and returns
        </Link>{" "}
        for timings.
      </p>
    </Section>

    <Section heading="Payment">
      <p>
        Card and UPI payments are handled by our payment provider. We never see or
        store your card number — it does not reach our servers.
      </p>
      <p>
        An order is confirmed as paid when the provider tells us the money moved, not
        when your browser says so. If a payment fails or is abandoned, the order stays
        unpaid and nothing is dispatched.
      </p>
    </Section>

    <Section heading="Selling us your books">
      <p>
        A quote is what we will pay if the book arrives in the condition you selected.
        It is fixed when you submit, so later changes to our rates do not affect an
        offer you already have.
      </p>
      <p>
        We check every book on arrival. If it grades lower than described, we tell you
        the revised amount before paying — you are not committed to accepting it. If a
        book arrives damaged beyond selling, we will say so and explain why.
      </p>
      <p>
        By sending us a book you confirm it is yours to sell, is complete, and is not
        a pirated or photocopied edition.
      </p>
    </Section>

    <Section heading="Store credit">
      <p>
        Credit earned from buyback is spendable on BookVuk. It is not cash: it cannot
        be withdrawn, transferred to another account, or exchanged for money. Choose a
        bank payout at the time of selling if you want money instead.
      </p>
      <p>
        Only part of any single order can be paid with credit — the remaining share is
        payable normally. The exact limit is shown at checkout. Credit does not expire.
      </p>
    </Section>

    <Section heading="Reviews">
      <p>
        You may leave one review per book. Keep it about the book. We remove reviews
        containing abuse, personal information, or spam, and we do not edit reviews to
        make them more favourable.
      </p>
    </Section>

    <Section heading="Changes to these terms">
      <p>
        We may update these terms. The date at the top is when they last changed, and
        the version in force is the one published when you place an order.
      </p>
    </Section>
  </LegalPage>
);

export default Terms;
