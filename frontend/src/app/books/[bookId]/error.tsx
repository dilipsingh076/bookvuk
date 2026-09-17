"use client";

import RouteError from "@/components/RouteError";

/* A product page failing is a lost sale, so it offers a retry rather than a dead end. */
const Error = (props: { error: Error & { digest?: string }; reset: () => void }) => (
  <RouteError
    {...props}
    scope="Book page"
    heading="We could not load this book"
    body="The book is probably still there - the request did not come back."
    fallbackHref="/browse"
    fallbackLabel="Browse books"
  />
);

export default Error;
