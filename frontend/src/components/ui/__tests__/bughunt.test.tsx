/* A review of the design system, written as failing tests.
 *
 * Each test below asserts what the component *should* do. Any that fails is a
 * real defect, not a style preference — the point of writing them this way is
 * that "I found a bug" is checkable rather than claimed.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Field from "../Field";
import { IconInput, Input } from "../Input";
import { MailIcon } from "../icons";
import Login from "../../../views/Login";
import Register from "../../../views/Register";
import { AuthProvider } from "../../../context/AuthContext";
import { AuthModalProvider } from "../../../context/AuthModalContext";
import { CartProvider } from "../../../context/CartContext";

const noop = () => {};
const app = (ui: React.ReactNode) =>
  render(
    <><AuthProvider>
        <AuthModalProvider
          value={{
            openLoginModal: noop,
            openRegisterModal: noop,
            openResetModal: noop,
            requireAuth: (a) => a(),
          }}
        >
          <CartProvider>{ui}</CartProvider>
        </AuthModalProvider>
      </AuthProvider></>,
  );

describe("the auth forms' labels", () => {
  it("sign-in: every field is reachable by its visible label", () => {
    app(<Login embedded />);
    // A <label> that neither wraps its input nor carries htmlFor is decoration:
    // a screen reader announces the field with no name, and clicking the label
    // does not focus it.
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("sign-up: every field is reachable by its visible label", () => {
    app(<Register embedded />);
    for (const label of [/full name/i, /username/i, /email address/i, /^password$/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe("IconInput", () => {
  it("can show an error state like the other controls", () => {
    render(<IconInput icon={<MailIcon />} invalid aria-label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("works with Field without leaking props to the DOM", () => {
    // Field hands its children `{id, aria-describedby, invalid}`. Spreading that
    // onto a control that does not declare `invalid` puts a non-standard
    // attribute on the <input> and React warns about it.
    render(
      <Field label="Email" error="Not a valid address">
        {(p) => <IconInput icon={<MailIcon />} {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).not.toHaveAttribute("invalid");
  });
});

describe("field icons", () => {
  it("keeps its colour when the caller only changes the size", () => {
    // `className ?? DEFAULT` replaces rather than merges, so asking for a
    // smaller icon silently drops `text-bookvuk-muted` and the icon turns black.
    const { container } = render(<MailIcon className="h-4 w-4" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("h-4");
    expect(svg.getAttribute("class")).toContain("text-bookvuk-muted");
  });
});

describe("Input", () => {
  it("lets a caller set aria-invalid directly", () => {
    render(<Input aria-label="Code" aria-invalid />);
    expect(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
  });

  it("does not put the invalid flag itself in the DOM", () => {
    render(<Input aria-label="Code" invalid />);
    expect(screen.getByLabelText("Code")).not.toHaveAttribute("invalid");
  });
});
