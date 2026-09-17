/* What `activeProps` is allowed to hand a DOM element.
 *
 * The bug this pins: it used to return `active: boolean`, call sites spread the
 * whole object onto `<Link>`, and React warned "Received `false` for a
 * non-boolean attribute `active`" — a warning on every nav render of every page.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockPathname = vi.fn(() => "/home");
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));

import { useActivePath } from "../useActivePath";

const Nav = ({ href, exact }: { href: string; exact?: boolean }) => {
  const { activeProps } = useActivePath();
  return (
    <a href={href} {...activeProps(href, { exact, active: "on", inactive: "off" })}>
      link
    </a>
  );
};

describe("useActivePath", () => {
  it("returns nothing that is not a real DOM attribute", () => {
    /* Asserted on the returned object, not the rendered element.
     *
     * The DOM alone is not enough to catch this: React drops a `false` valued
     * unknown attribute silently (warning only), so an inactive link looks
     * clean either way. The shape is the actual rule. */
    const seen: string[] = [];
    const Probe = () => {
      const { activeProps } = useActivePath();
      seen.push(...Object.keys(activeProps("/home", { active: "on", inactive: "off" })));
      return null;
    };
    mockPathname.mockReturnValue("/elsewhere");
    render(<Probe />);
    expect(seen.sort()).toEqual(["aria-current", "className"]);
  });

  it("does not write a stray attribute onto the current-page link", () => {
    // `active: true` *does* reach the DOM as active="true" — this is what the
    // React warning was about on every nav render.
    mockPathname.mockReturnValue("/home");
    render(<Nav href="/home" />);
    expect(screen.getByRole("link")).not.toHaveAttribute("active");
  });

  it("marks the current page for a screen reader, not just visually", () => {
    mockPathname.mockReturnValue("/home");
    render(<Nav href="/home" />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
  });

  it("leaves aria-current off a link that is not the current page", () => {
    mockPathname.mockReturnValue("/about");
    render(<Nav href="/home" />);
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current");
  });

  it("applies the active class, so styling and semantics cannot drift apart", () => {
    mockPathname.mockReturnValue("/home");
    render(<Nav href="/home" />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("on");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("a section link is active for its children", () => {
    // /admin/books should light up /admin.
    mockPathname.mockReturnValue("/admin/books");
    render(<Nav href="/admin" />);
    expect(screen.getByRole("link")).toHaveClass("on");
  });

  it("exact restricts it to the path itself", () => {
    mockPathname.mockReturnValue("/admin/books");
    render(<Nav href="/admin" exact />);
    expect(screen.getByRole("link")).toHaveClass("off");
  });

  it("a query string does not stop a link matching its page", () => {
    mockPathname.mockReturnValue("/browse");
    render(<Nav href="/browse?sort=newest" />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
  });
});
