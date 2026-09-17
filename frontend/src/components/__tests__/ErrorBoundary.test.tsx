import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../ErrorBoundary";

/** Throws on the first render, succeeds afterwards — so "Try again" can recover. */
let shouldThrow = true;
const Flaky = () => {
  if (shouldThrow) throw new Error("kaboom from render");
  return <p>Recovered content</p>;
};

beforeEach(() => {
  shouldThrow = true;
  // React logs caught render errors; silenced so the test output stays readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing goes wrong", () => {
    render(
      <ErrorBoundary>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All fine")).toBeInTheDocument();
  });

  it("shows a message instead of a blank page when a child throws", () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    // The failure this exists for: an uncaught render error unmounts everything
    // and leaves a white screen with the reason only in the console.
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
  });

  it("shows the error message, so a bug report can be specific", () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText("kaboom from render")).toBeInTheDocument();
  });

  it("reassures the visitor that their cart is intact", () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/your cart and your account are untouched/i)).toBeInTheDocument();
  });

  it("offers a way out of the error state", () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /homepage/i })).toBeInTheDocument();
  });

  it("recovers when Try again is pressed and the cause has passed", async () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("logs the error for whoever is debugging", () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalled();
  });
});
