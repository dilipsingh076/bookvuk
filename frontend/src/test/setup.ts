import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/* The App Router is not mountable in a unit test.
 *
 * React Router had `MemoryRouter`, so a component under test could be wrapped in
 * a real router. `next/navigation` has no equivalent — its hooks read a context
 * that only the framework provides, and calling them without it throws
 * "invariant expected app router to be mounted". So the module is stubbed here,
 * once, rather than in every test file.
 *
 * `push`/`replace` are spies, which is better than the old arrangement: a test
 * can now assert *where* a component navigated instead of only that it rendered.
 */
const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

/** The path the mocked router reports. Set it per test when it matters. */
export let mockPathname = "/";
export const setMockPathname = (value: string) => {
  mockPathname = value;
};

/** The query string the mocked router reports. */
export let mockSearchParams = new URLSearchParams();
export const setMockSearchParams = (init: string | Record<string, string>) => {
  mockSearchParams = new URLSearchParams(init as string);
};

export const mockRouter = router;

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// `next/link` renders a plain anchor under the hood; in a test it needs to be
// one, so `getByRole("link")` and href assertions keep working.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => {
    const React = require("react");
    return React.createElement("a", { href, ...rest }, children);
  },
}));

// The cart and the session both live in localStorage, so a test that leaves one
// behind would silently change the next test's starting state.
afterEach(() => {
  cleanup();
  localStorage.clear();
  Object.values(router).forEach((fn) => fn.mockClear());
  setMockPathname("/");
  setMockSearchParams("");
  vi.restoreAllMocks();
  vi.useRealTimers();
});
