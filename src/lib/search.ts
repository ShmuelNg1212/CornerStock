// A forgiving text search for model names, brands, and codes.
// Staff type on a phone, fast, and model names have punctuation ("!Q Tour 78/U", "Hy-Road").

/** Lower case, no accents, and the look-alikes of "i" as "i". */
function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[!|¡]/g, "i");
}

const words = (text: string) => fold(text).split(/[^a-z0-9]+/).filter(Boolean);

/** True when a becomes b by one change: one letter wrong, missing, extra, or two letters swapped. */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** A word of 5 or more letters can have one typing error. A shorter word must match exactly. */
const TYPO_MIN = 5;

/**
 * True when the text has each word of the query. It ignores case, accents, spaces, and punctuation,
 * so "hyroad" finds "Hy-Road" and "iq" finds "!Q Tour". An empty query matches all text.
 */
export function matches(text: string, query: string): boolean {
  const wanted = words(query);
  if (!wanted.length) return true;
  const have = words(text);
  const compact = have.join("");
  if (compact.includes(wanted.join(""))) return true;
  return wanted.every(
    (word) =>
      compact.includes(word) ||
      (word.length >= TYPO_MIN &&
        // The whole word, or the start of a word that the staff member is still typing.
        have.some((w) => [w, ...[-1, 0, 1].map((extra) => w.slice(0, word.length + extra))].some((part) => withinOne(word, part)))),
  );
}
