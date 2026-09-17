/* A JSON-LD block, rendered on the server.
 *
 * This replaces the `useStructuredData` hook, which appended a `<script>` from a
 * `useEffect`. That worked for Google, which runs JavaScript, and for nobody
 * else — and it meant the graph was absent from the HTML that every other
 * crawler and every link-preview scraper reads. Rendered here it is simply part
 * of the document.
 *
 * Deliberately not a client component: it has no interactivity, and keeping it
 * on the server is the whole point.
 */
const JsonLd = ({ data }: { data: object }) => (
  <script
    type="application/ld+json"
    // The value is our own object, serialised here rather than interpolated from
    // any user input. `</script>` inside a string would still end the tag early,
    // so the sequence is escaped.
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    }}
  />
);

export default JsonLd;
