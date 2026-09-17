"use client";

import RouteError from "@/components/RouteError";

/* Scoped to the catalogue so a failed search does not blank the whole page. */
const Error = (props: { error: Error & { digest?: string }; reset: () => void }) => (
  <RouteError
    {...props}
    scope="Browse"
    heading="We could not load the catalogue"
    body="The shop is here - this request just did not come back. Trying again usually works."
    fallbackHref="/"
    fallbackLabel="Go home"
  />
);

export default Error;
