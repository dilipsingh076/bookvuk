import { LoaderBlock } from "@/components/ui/Loader";

/* Next's streaming fallback, shown while a server component is still resolving
 * its data. The catalogue and each book page fetch on the server now, so there is
 * a real gap to fill; before this the whole page simply appeared late.
 *
 * `height="page"` because this one stands in for an entire route — a `py-16`
 * strip would leave the footer riding up under the navbar and then drop it once
 * the content lands. */
const Loading = () => <LoaderBlock height="page" caption="Loading BookVuk…" />;

export default Loading;
