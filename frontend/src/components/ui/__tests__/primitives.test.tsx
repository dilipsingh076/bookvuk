/* What these primitives promise, tested.
 *
 * Not "does Button render a button" — the interesting claims are the ones a
 * refactor could silently break: that a caller's `className` actually wins, that
 * a link-shaped button is still a link, and that a field is wired to its label
 * and its error message.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cn } from "../../../lib/cn";
import Alert from "../Alert";
import Button, { ButtonLink, buttonStyles } from "../Button";
import Card from "../Card";
import Field from "../Field";
import Img from "../Img";
import { Input, Select, Textarea } from "../Input";
import Loader, { LoaderBlock } from "../Loader";
import PageHeader, { SectionHeading } from "../PageHeader";

// The App Router is stubbed in src/test/setup.ts, so no wrapper is needed.
const routed = (ui: React.ReactNode) => render(<>{ui}</>);

describe("cn", () => {
  it("lets the later utility win over an earlier conflicting one", () => {
    // The whole reason tailwind-merge is here: plain joining would keep both,
    // and which one applied would depend on stylesheet order.
    expect(cn("px-4", "px-8")).toBe("px-8");
    expect(cn("rounded-lg", "rounded-full")).toBe("rounded-full");
  });

  it("knows the custom shadow tokens are shadows", () => {
    // Without the extended class group, `shadow-bookvuk-card` is an unknown
    // class and would survive alongside `shadow-none`.
    expect(cn("shadow-bookvuk-card", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-bookvuk-card", "shadow-bookvuk-float")).toBe("shadow-bookvuk-float");
  });

  it("does not treat a gradient as a background colour", () => {
    // A gradient over a colour is a real combination, not a conflict.
    expect(cn("bg-white", "bg-bookvuk-hero")).toBe("bg-white bg-bookvuk-hero");
  });

  it("keeps non-conflicting classes", () => {
    expect(cn("flex", "items-center", false && "hidden")).toBe("flex items-center");
  });
});

describe("Loader", () => {
  it("announces itself once, from the wrapper rather than the circle", () => {
    // The rotating border is aria-hidden; the name has to come from somewhere
    // else or the spinner is silent to a screen reader.
    render(<Loader />);
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading");
  });

  it("goes silent when the surrounding control already says it", () => {
    // Inside a disabled submit button, a second "Loading" is noise.
    render(<Loader decorative />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("LoaderBlock centres itself", () => {
    // The bug this component was written for: an inline-flex spinner in a bare
    // padding div sits at the top-left corner instead of in the middle.
    render(<LoaderBlock />);
    const cls = screen.getByRole("status").className;
    expect(cls).toContain("items-center");
    expect(cls).toContain("justify-center");
  });

  it("LoaderBlock does not announce its caption twice", () => {
    // A visible caption plus an sr-only label would be read out as
    // "Loading your cart… Loading".
    render(<LoaderBlock caption="Loading your cart…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAccessibleName("Loading your cart…");
    expect(status.querySelector(".sr-only")).toBeNull();
  });

  it("lets a caller override the height it came with", () => {
    render(<LoaderBlock height="page" className="py-2" />);
    const cls = screen.getByRole("status").className;
    expect(cls).toContain("py-2");
    expect(cls).not.toContain("py-16");
  });
});

describe("Img", () => {
  it("is lazy by default", () => {
    // The trap in dropping next/image: a bare <img> is EAGER by default, so
    // without this the browse grid fetches every cover in one burst.
    render(<Img src="/static/books/a.jpg" alt="A" />);
    expect(screen.getByAltText("A")).toHaveAttribute("loading", "lazy");
  });

  it("loads eagerly and at high priority when it is in the first paint", () => {
    render(<Img src="/hero.jpg" alt="Hero" priority />);
    const img = screen.getByAltText("Hero");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("lets an explicit loading beat the priority default", () => {
    // BrandLogo's `lg` variant is below the fold and says so.
    const { container } = render(<Img src="/logo.png" alt="" priority loading="lazy" />);
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("fill positions against the parent, and the caller's classes still win", () => {
    render(<Img src="/a.jpg" alt="A" fill className="object-cover" />);
    const cls = screen.getByAltText("A").className;
    expect(cls).toContain("absolute");
    expect(cls).toContain("inset-0");
    expect(cls).toContain("object-cover");
  });

  it("passes through the props a call site still needs", () => {
    // onError drives every cover fallback in the app.
    const onError = vi.fn();
    render(<Img src="/a.jpg" alt="A" width={44} height={44} onError={onError} />);
    const img = screen.getByAltText("A");
    expect(img).toHaveAttribute("width", "44");
    expect(img).toHaveAttribute("height", "44");
    fireEvent.error(img);
    expect(onError).toHaveBeenCalled();
  });
});

describe("Button", () => {
  it("defaults to type=button", () => {
    // A button inside a form defaults to type=submit in HTML, which is how a
    // "Remove" next to an input ends up submitting the form.
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("still allows an explicit submit", () => {
    render(<Button type="submit">Sign in</Button>);
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute("type", "submit");
  });

  it("lets a caller override a variant's own utility", () => {
    render(
      <Button size="md" className="px-8">
        Wide
      </Button>,
    );
    const cls = screen.getByRole("button", { name: "Wide" }).className;
    expect(cls).toContain("px-8");
    expect(cls).not.toContain("px-4");
  });

  it("carries a hover treatment on the customer-facing variant", () => {
    render(<Button variant="primary">Buy</Button>);
    expect(screen.getByRole("button", { name: "Buy" }).className).toContain(
      "hover:bg-bookvuk-purple-hover",
    );
  });

  it("has no hover on primary-flat, which is why that variant exists", () => {
    // The admin CRUD screens are on this one. Documented in Button.tsx.
    render(<Button variant="primary-flat">Add</Button>);
    expect(screen.getByRole("button", { name: "Add" }).className).not.toContain("hover:");
  });

  it("marks a disabled button as not clickable", () => {
    render(<Button disabled>Nope</Button>);
    const b = screen.getByRole("button", { name: "Nope" });
    expect(b).toBeDisabled();
    expect(b.className).toContain("disabled:cursor-not-allowed");
  });

  it("exposes its classes for the odd bare anchor", () => {
    expect(buttonStyles({ variant: "secondary", size: "lg" })).toContain("border-bookvuk-border");
  });
});

describe("ButtonLink", () => {
  it("renders a real anchor with an href", () => {
    // If this became a button with an onClick, middle-click and ⌘-click — the
    // way people open a product in a new tab — would stop working.
    routed(<ButtonLink href="/browse">Shop</ButtonLink>);
    const link = screen.getByRole("link", { name: "Shop" });
    expect(link).toHaveAttribute("href", "/browse");
  });

  it("looks like the button variant it was given", () => {
    routed(
      <ButtonLink href="/cart" variant="primary">
        Cart
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "Cart" }).className).toContain("bg-bookvuk-purple");
  });
});

describe("Field", () => {
  it("binds the label to the control", () => {
    render(
      <Field label="Email">{(p) => <Input {...p} />}</Field>,
    );
    // getByLabelText only resolves if the htmlFor/id pair is right.
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("announces an error and points the control at it", () => {
    render(
      <Field label="Email" error="That address is not valid">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("That address is not valid");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("describes the control with its hint when there is no error", () => {
    render(
      <Field label="Phone" hint="Ten digits, no spaces">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText("Phone");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(
      "Ten digits, no spaces",
    );
  });

  it("hides the hint once an error replaces it", () => {
    render(
      <Field label="Phone" hint="Ten digits" error="Too short">
        {(p) => <Input {...p} />}
      </Field>,
    );
    expect(screen.queryByText("Ten digits")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  it("gives each field its own ids", () => {
    render(
      <>
        <Field label="First">{(p) => <Input {...p} />}</Field>
        <Field label="Second">{(p) => <Input {...p} />}</Field>
      </>,
    );
    expect(screen.getByLabelText("First").id).not.toBe(screen.getByLabelText("Second").id);
  });
});

describe("form controls", () => {
  it("marks an invalid input for assistive tech, not just in colour", () => {
    render(<Input invalid aria-label="Postcode" />);
    expect(screen.getByLabelText("Postcode")).toHaveAttribute("aria-invalid", "true");
  });

  it("shares one focus ring across input, textarea and select", () => {
    render(
      <>
        <Input aria-label="a" />
        <Textarea aria-label="b" />
        <Select aria-label="c" />
      </>,
    );
    for (const label of ["a", "b", "c"]) {
      expect(screen.getByLabelText(label).className).toContain("focus:ring-bookvuk-purple/15");
    }
  });
});

describe("Alert", () => {
  it("announces an error", () => {
    render(<Alert tone="error">Card declined</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Card declined");
  });

  it("uses the quieter status role for non-errors", () => {
    render(<Alert tone="success">Saved</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});

describe("layout pieces", () => {
  it("PageHeader renders one h1 with its description and actions", () => {
    render(
      <PageHeader
        eyebrow="Your account"
        title="Orders"
        description="Everything you have bought."
        actions={<Button>Export</Button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Orders" })).toBeInTheDocument();
    expect(screen.getByText("Your account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("SectionHeading is an h2, so a page keeps one top-level heading", () => {
    render(<SectionHeading title="Trending this week" />);
    expect(screen.getByRole("heading", { level: 2, name: "Trending this week" })).toBeInTheDocument();
  });

  it("SectionHeading with nothing beside it is only the heading", () => {
    // Most call sites are a bare <h2>. Wrapping those in a flex row would add
    // layout to reason about for no benefit, so it degrades instead.
    const { container } = render(<SectionHeading title="Items" />);
    expect(container.firstElementChild?.tagName).toBe("H2");
  });

  it("SectionHeading wraps once it has a description to place", () => {
    const { container } = render(<SectionHeading title="Items" description="Two books" />);
    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(screen.getByText("Two books")).toBeInTheDocument();
  });


  it("Card renders the tag it is asked for", () => {
    render(
      <Card as="section" data-testid="c">
        body
      </Card>,
    );
    expect(screen.getByTestId("c").tagName).toBe("SECTION");
  });


});
