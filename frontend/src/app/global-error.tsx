"use client";

/* The last resort: an error in the root layout itself.
 *
 * `error.tsx` renders inside the layout, so it cannot help when the layout is
 * what failed. This replaces the whole document, which is why it has to supply
 * its own <html> and <body> — and why it is styled inline rather than with
 * Tailwind, since a layout failure may mean the stylesheet never loaded.
 */
const GlobalError = ({ reset }: { error: Error; reset: () => void }) => (
  <html lang="en">
    <body
      style={{
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
        background: "#FDF8F8",
        color: "#1A1D2E",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem", maxWidth: "28rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>BookVuk is unavailable</h1>
        <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#71717A" }}>
          Something failed before the page could load. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.625rem 1.25rem",
            borderRadius: "0.75rem",
            border: 0,
            background: "#6C47FF",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </body>
  </html>
);

export default GlobalError;
