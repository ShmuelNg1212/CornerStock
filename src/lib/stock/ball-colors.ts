/** Navy: the swatch when the color text names no known color. */
export const FALLBACK_SWATCH = "#172a3a";

// Common color words on bowling ball boxes. Two-word names come first, so "sky blue" is not "blue".
const COLORS: [string, string][] = [
  ["sky blue", "#6fb7e6"],
  ["royal blue", "#2a4fb5"],
  ["dark blue", "#1d3166"],
  ["light blue", "#8cc8ee"],
  ["hot pink", "#e04a8f"],
  ["solid black", "#1b1d20"],
  ["ultramarine", "#3a3fb0"],
  ["black", "#1b1d20"],
  ["white", "#eeeae2"],
  ["pearl", "#e6e0d4"],
  ["silver", "#b9bfc4"],
  ["gray", "#7d858b"],
  ["grey", "#7d858b"],
  ["carbon", "#33383d"],
  ["smoke", "#5d646a"],
  ["red", "#c8352a"],
  ["ruby", "#9e1b32"],
  ["crimson", "#a3162c"],
  ["maroon", "#6b1f2a"],
  ["orange", "#e0702e"],
  ["copper", "#b5653a"],
  ["bronze", "#9a6a3a"],
  ["gold", "#d7a55b"],
  ["yellow", "#e8c33a"],
  ["lime", "#9ccb3b"],
  ["green", "#2f8a4a"],
  ["emerald", "#1f7a55"],
  ["teal", "#1f8a8a"],
  ["aqua", "#3fc1c9"],
  ["turquoise", "#2fb3b0"],
  ["lapis", "#2b4c9b"],
  ["navy", "#1f2f5a"],
  ["blue", "#2f63c9"],
  ["indigo", "#3b3a8f"],
  ["violet", "#7a4fc2"],
  ["purple", "#6a3a9e"],
  ["plum", "#6b2f5e"],
  ["magenta", "#c0328e"],
  ["pink", "#e584b2"],
  ["rose", "#d46a86"],
  ["brown", "#6e4a33"],
  ["tan", "#c8a27a"],
];

/** One to three swatches from a color text such as "Red / Blue / Purple". */
export function ballSwatches(text: string | null | undefined): string[] {
  const found: string[] = [];
  for (const part of (text ?? "").toLowerCase().split(/[/,&+|]|\band\b/)) {
    const word = part.trim();
    if (!word) continue;
    const hit = COLORS.find(([name]) => new RegExp(`\\b${name}\\b`).test(word));
    if (hit && !found.includes(hit[1])) found.push(hit[1]);
    if (found.length === 3) break;
  }
  return found.length ? found : [FALLBACK_SWATCH];
}
