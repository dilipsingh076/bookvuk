/**
 * Downloads cover JPEGs for every book in src/data/bookCatalog.json.
 * Uses Open Library when a match exists; otherwise a stable placeholder.
 *
 * Run: node scripts/download-book-covers.mjs
 * Optional: LIMIT=50 node scripts/download-book-covers.mjs  (first N books, for testing)
 */
import { readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, "../src/data/bookCatalog.json");
const OUT_DIR = join(__dirname, "../public/assets/books");

const limitRaw = process.env.LIMIT;
const LIMIT =
  limitRaw && !Number.isNaN(Number(limitRaw)) ? Number(limitRaw) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openLibraryCoverId(title, author) {
  const params = new URLSearchParams({ title, limit: "12" });
  if (author) params.set("author", author);
  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  for (const doc of data.docs || []) {
    if (typeof doc.cover_i === "number") return doc.cover_i;
  }
  return null;
}

async function downloadBuffer(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const searchQueriesFor = (book) => {
  const title = book.titleSearch || book.title;
  const author = book.authorSearch || book.author;
  return [
    { title, author },
    { title, author: undefined },
    { title: book.title, author: book.author }
  ];
};

async function firstCoverId(book) {
  for (const q of searchQueriesFor(book)) {
    const id = await openLibraryCoverId(q.title, q.author);
    if (id != null) return { coverId: id, matched: q };
  }
  return { coverId: null, matched: null };
}

async function main() {
  const raw = readFileSync(CATALOG, "utf8");
  /** @type {Array<Record<string, unknown>>} */
  const books = JSON.parse(raw);
  const slice = LIMIT != null ? books.slice(0, LIMIT) : books;

  await mkdir(OUT_DIR, { recursive: true });

  let i = 0;
  for (const book of slice) {
    i += 1;
    const id = String(book.id);
    const dest = join(OUT_DIR, `${id}.jpg`);
    const { coverId } = await firstCoverId(book);
    let sourceUrl =
      coverId != null
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : `https://picsum.photos/seed/booknest-${id}/400/600.jpg`;

    try {
      const buf = await downloadBuffer(sourceUrl);
      await writeFile(dest, buf);
      console.log(`[${i}/${slice.length}] OK ${id}.jpg`);
    } catch (e) {
      console.error(`[${i}/${slice.length}] FAIL ${id}`, e.message);
      const fallback = `https://picsum.photos/seed/booknest-fallback-${id}/400/600.jpg`;
      const buf = await downloadBuffer(fallback);
      await writeFile(dest, buf);
      console.log(`[${i}/${slice.length}] OK ${id}.jpg (fallback)`);
    }
    await sleep(280);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
