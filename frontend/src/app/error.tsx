"use client";

import RouteError from "@/components/RouteError";

/* The app-wide boundary. Catches a failure in any route that has no nearer error.tsx — including a server component, which the client ErrorBoundary in providers.tsx cannot see. */
const Error = (props: { error: Error & { digest?: string }; reset: () => void }) => (
  <RouteError
    {...props}
    scope="Route"
    heading="Something went wrong"
    body="This page could not be loaded. Trying again often works - the catalogue may have been briefly unreachable."
    fallbackHref="/browse"
    fallbackLabel="Browse books"
  />
);

export default Error;
