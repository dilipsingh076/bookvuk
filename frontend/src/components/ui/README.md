# The BookVuk design system

Everything here was derived from what the app already renders. No component
below introduced a new colour, size or spacing — each one is a name for a pattern
that was already repeated across the pages, which is why adopting them changed
no pixels.

## Where things live

| File | What it holds |
| --- | --- |
| `src/theme/tokens.ts` | Every colour, font stack, gradient and shadow. One value each. |
| `tailwind.config.ts` | Builds the Tailwind theme *from* `tokens.ts`, so the two cannot disagree. |
| `src/lib/cn.ts` | `cn()` — joins classes and resolves Tailwind conflicts. |
| `src/components/ui/` | The primitives and compounds, re-exported from `index.ts`. |

Import from the barrel:

```tsx
import { Button, Card, Field, Input, PageHeader } from "../components/ui";
```

## Why `cn()` and not template strings

Tailwind decides between two conflicting utilities by **stylesheet order**, not
by the order they appear in the `class` attribute. So this does *not* reliably
give a wider button:

```tsx
<button className={`px-4 py-2 ${className}`} />   // caller passes px-8 — may lose
```

`cn()` wraps `tailwind-merge`, which drops the earlier of any conflicting pair.
That is what makes `className` on these components a dependable escape hatch.
The custom tokens are registered with it (`cn.ts`), so `shadow-bookvuk-card`
behaves like a shadow and `bg-bookvuk-hero` like a background *image* rather than
a colour.

## Primitives

- **`Button`** / **`ButtonLink`** — `variant`, `size`, `radius`, `block`. Use `ButtonLink` whenever the thing navigates: it stays a
  real `<a>`, so ⌘-click and "copy link address" keep working.
- **`Input`**, **`Textarea`**, **`Select`**, **`IconInput`** — one shared focus
  ring. `invalid` sets `aria-invalid` as well as the colour.
- **`Card`** — `radius`, `padding`, `elevation`, `hairline`, `bordered`, `as`.
- **`Field`** — a label bound to its control, with a hint or an error. Generates
  the ids and wires `aria-describedby` / `aria-invalid`.
- **`Alert`** — the inline message strip above a form or under a failed action.
- **`ConfirmDialog`** — a confirmation step for something irreversible. Takes a
  `body`, because naming *what* is about to go is the whole point: `window.confirm`
  cannot. Use it sparingly — a confirm on a reversible action teaches people to
  click through confirms, which is how the irreversible one gets clicked through.
- **`Img`** — a plain `<img>`, plus `fill` and `priority`. **Use this, not
  `next/image`.** The optimiser runs `sharp` in-process and caches to
  `.next/cache/images`, which on the 512MB instance this deploys to means a
  memory spike and a cache wiped by every deploy. The cost of the swap is real
  and worth knowing: no AVIF/WebP, and no `srcset`, so a phone downloads the
  same ~34KB cover a desktop does. `Img` defaults to `loading="lazy"` because a
  bare `<img>` is *eager* — that default is the whole reason this is a component
  and not a find-and-replace.
- **`Loader`** / **`LoaderBlock`** — `size`, `tone`, `label`, `decorative`; the
  block form adds `caption` and `height`. `Loader` is the glyph, for use *beside*
  something (inside a button, next to a line of text). `LoaderBlock` centres it
  in a region it fills, for use *instead* of something (a route fallback, a
  guard, a panel waiting on data). Reach for the block form by default: the
  inline one does not centre itself, which is exactly how the old single-shape
  loader ended up pinned to the top-left corner of the home page.
- **`Modal`**, **`Skeleton`**, **`BrandLogo`** — pre-existing.

### Spinner or skeleton?

Both are in here and they are not interchangeable:

- A **skeleton** stands in for content whose shape is known — the browse grid,
  a product page, an author list. It holds the layout still, so nothing jumps
  when the data lands. `browse/`, `books/[bookId]/` and `authors/` all have one.
- A **spinner** is for a wait whose result has no shape yet: a session being
  resolved, a cart being fetched, a form mid-submit. Prefer a skeleton wherever
  you can actually draw the shape.

## Compounds

- **`PageHeader`** — eyebrow, `h1`, description, optional actions. Renders a
  plain block without actions and a stacking row with them, because those are
  the two layouts the app actually uses.
- **`SectionHeading`** / **`Eyebrow`** — an `h2` inside a page, and the quiet
  all-caps label. `SectionHeading` renders the bare `h2` when there is no
  description or action beside it, which is what most call sites are.

## Adding a component

1. Find the pattern in at least two places first. A primitive with one caller is
   just indirection.
2. Take the values from `tokens.ts`. If the value is not there, add it there —
   not to the component.
3. Accept `className` last and merge it with `cn()`.
4. Test the promise, not the markup: that the label is bound, that the override
   wins, that the link is a link. See `__tests__/primitives.test.tsx`.

## Four components that were deleted

`Badge`, `EmptyState`, `IconButton` and `StatCard` were built here and then
removed, because a review found none of them had a caller and — worse — that
they had been drawn from *class-string frequency* rather than from reading the
call sites:

- **`StatCard`** was modelled on `rounded-2xl bg-white p-5 ring-1 …`, which turns
  out to be the admin dashboard's **section panels**, not its number tiles. The
  real tile is `rounded-xl bg-bookvuk-lilac p-4` and is already rendered from a
  `.map()`, so there was nothing to consolidate. Those six panels now use `Card`.
- **`EmptyState`** matched none of the app's empty states: one is an inline
  sentence with a button, one a full illustrated panel, one a plain text block.
- **`Badge`** ignored the `ring-1` the app's status pills actually carry, and its
  name collided with the count bubble in `layout/Navbar.tsx`.
- **`IconButton`** had no home — the repeated `h-10 w-10 rounded-xl` shapes are
  decorative `<span>` containers around icons, not buttons.

The lesson worth keeping: a repeated class string is not the same as a repeated
component. Read the call sites before naming the pattern.

## Known inconsistencies, deliberately preserved

These were found while adopting the primitives and left exactly as they are,
because changing them is visible and so is a design decision rather than a
refactor:

- **`Button` has a `primary-flat` variant with no hover state.** Eight admin CRUD
  buttons use it; every customer-facing button darkens on hover. Folding these
  into `primary` is a one-line change.
- **`boxShadow` carries near-duplicate steps** — `raised`/`lift` differ only in
  blur spread, and there are three `glow`s at 0.12/0.15/0.18 alpha. They are
  almost certainly meant to be one step each.
- **`leading-relaxed` is opt-in on the small `PageHeader` description**, because
  the two pages using that size disagree about it (4px per line).
- **Two `Card` border opacities** — `/80` is the default, the auth panels use the
  full-strength border.
