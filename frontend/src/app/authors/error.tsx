"use client";

import RouteError from "@/components/RouteError";

/* Covers the author list and every author page beneath it. */
const Error = (props: { error: Error & { digest?: string }; reset: () => void }) => (
  <RouteError
    {...props}
    scope="Authors"
    heading="We could not load the authors"
    body="The list did not come back this time. Trying again usually works."
    fallbackHref="/browse"
    fallbackLabel="Browse books"
  />
);

export default Error;
