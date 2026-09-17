"use client";

import RouteError from "@/components/RouteError";

/* Keeps an admin failure inside the panel; the sidebar and the rest of the shell survive. */
const Error = (props: { error: Error & { digest?: string }; reset: () => void }) => (
  <RouteError
    {...props}
    scope="Admin"
    heading="This admin screen failed to load"
    body="The catalogue service may be unreachable. The rest of the panel still works."
    fallbackHref="/admin"
    fallbackLabel="Back to the dashboard"
  />
);

export default Error;
