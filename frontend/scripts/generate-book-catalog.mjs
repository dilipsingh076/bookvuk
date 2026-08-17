/**
 * Builds src/data/bookCatalog.json from catalog-seed-en.mjs + catalog-seed-hi.mjs
 * Run: node scripts/generate-book-catalog.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import en from "./catalog-seed-en.mjs";
import hi from "./catalog-seed-hi.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../src/data");
const outPath = join(dataDir, "bookCatalog.json");
mkdirSync(dataDir, { recursive: true });

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
};

const buildBook = (partial) => {
  const id = partial.id;
  const h = hash(id);
  const ratingRaw = 3.7 + (h % 130) / 100;
  const rating = Math.round(ratingRaw * 10) / 10;
  const ratingCount = 200 + (h % 18000);
  const price = 199 + (h % 71) * 10;
  const formats = ["Paperback", "Hardcover", "Paperback"];
  const format = formats[h % 3];
  return {
    ...partial,
    rating,
    ratingCount,
    price,
    format,
    stockStatus: "In Stock"
  };
};

const english = en.map(([title, author, category], i) => {
  const id = `en-${String(i + 1).padStart(3, "0")}`;
  return buildBook({
    id,
    bookId: id,
    title,
    author,
    category,
    language: "en",
    description: `Popular English title widely read across India — ${category}.`
  });
});

const hindi = hi.map((row, i) => {
  const id = `hi-${String(i + 1).padStart(3, "0")}`;
  return buildBook({
    id,
    bookId: id,
    title: row.t,
    author: row.a,
    category: "Hindi Literature",
    language: "hi",
    titleSearch: row.ts,
    authorSearch: row.as,
    description: `Noted Hindi work — ${row.ts}.`
  });
});

const all = [...english, ...hindi];
writeFileSync(outPath, JSON.stringify(all, null, 2), "utf8");
console.log("Wrote", all.length, "books to", outPath);
