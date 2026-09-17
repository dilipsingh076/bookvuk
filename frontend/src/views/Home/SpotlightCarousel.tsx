"use client";

/** Six covers a slide, rotating, with dots to jump between them. */

import BookCard from "../../components/BookCard";
import { useSpotlightCarousel } from "./useSpotlightCarousel";
import type { SpotlightCarouselProps } from "./types";

const SpotlightCarousel = ({ slides, onOpenBook }: SpotlightCarouselProps) => {
  const c = useSpotlightCarousel(slides.length);

  if (slides.length === 0) return null;

  if (c.staticGrid) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-6">
        {slides[0].map((b, i) => (
          <BookCard key={b.id} book={b} variant="dashboard" onOpen={onOpenBook} priority={i < 4} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8" onMouseEnter={c.pause} onMouseLeave={c.resume}>
      <div className="overflow-hidden rounded-2xl pb-1">
        <div
          className="flex transition-transform duration-300 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${c.index * 100}%)` }}
        >
          {slides.map((slide, slideIdx) => (
            <div key={slideIdx} className="w-full shrink-0 px-0.5" aria-hidden={slideIdx !== c.index}>
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-6">
                {slide.map((b, i) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    variant="dashboard"
                    onOpen={onOpenBook}
                    priority={i < 4}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show spotlight slide ${i + 1} of ${slides.length}`}
              aria-current={i === c.index ? "true" : undefined}
              onClick={() => c.show(i)}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === c.index
                  ? "w-8 bg-bookvuk-purple"
                  : "w-2 bg-bookvuk-border hover:bg-bookvuk-muted/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpotlightCarousel;
