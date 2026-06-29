// Display-case a raw personal name *without reordering its tokens*.
//
// Source data arrives in inconsistent casing: FEC and several Secretary-of-State
// feeds publish ALL CAPS ("JANE DOE"), a few publish all-lowercase. We only
// re-case names that are uniformly one case; a name that already has mixed case
// is left untouched — it was almost certainly cased deliberately ("McDonald",
// "DeShawn", "van der Berg"), and second-guessing it does more harm than good.
//
// Handles: Mc/Mac prefixes, O'/D' patronymics, hyphenated surnames, lowercase
// nobiliary particles (de, la, van, von, …) in interior position, and
// Roman-numeral suffixes (II, III, IV, …). It does NOT move suffixes or flip
// "LAST, FIRST" order — callers that need that (see fec.ts) do the structural
// work themselves and call this only for the casing pass.

const PARTICLES = new Set([
  "de", "del", "dela", "della", "di", "da", "do", "dos", "das",
  "la", "le", "van", "von", "der", "den", "ter", "ten",
  "bin", "ibn", "al", "el",
  "san", "santa", "st", "ste",
]);

// I, II, III, IV, V, VI, VII, VIII, IX, X — enough to cover real-world suffixes.
const ROMAN = /^(?:i{1,3}|iv|v|vi{0,3}|ix|x)$/i;

function capitalizeWord(w: string): string {
  if (!w) return w;
  const lower = w.toLowerCase();
  // Mc + letter → McDonald, McCain
  if (/^mc[a-z]/.test(lower) && lower.length > 2) {
    return "Mc" + lower.charAt(2).toUpperCase() + lower.slice(3);
  }
  // Mac + letters → MacArthur, MacDonald (require 3+ trailing chars so we don't
  // turn "Mack" / "Macey" into "MacK" / "MacEy").
  if (/^mac[a-z]{3,}/.test(lower)) {
    return "Mac" + lower.charAt(3).toUpperCase() + lower.slice(4);
  }
  // O'Brien, D'Angelo
  if (/^[od]'[a-z]/.test(lower)) {
    return (
      lower.charAt(0).toUpperCase() + "'" + lower.charAt(2).toUpperCase() + lower.slice(3)
    );
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Capitalize a token that may be hyphenated: "abu-ghazalah" → "Abu-Ghazalah".
function capitalizeToken(token: string): string {
  return token.split("-").map(capitalizeWord).join("-");
}

export function toDisplayCase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Leave deliberately mixed-case input alone.
  if (/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)) return trimmed;

  const tokens = trimmed.split(/\s+/);
  return tokens
    .map((tok, i) => {
      const lower = tok.toLowerCase();
      const interior = i > 0 && i < tokens.length - 1;
      // Roman-numeral suffix (II, III, IV…) anywhere but the first slot → keep
      // upper-case. Only multi-char: a lone "I"/"V"/"X" is more likely an
      // initial or a real name, so let normal casing handle it.
      if (i > 0 && tok.length > 1 && ROMAN.test(lower)) return lower.toUpperCase();
      // Lowercase nobiliary particles, but only interior — never first or last,
      // where they are likely a real (capitalized) surname.
      if (interior && PARTICLES.has(lower)) return lower;
      return capitalizeToken(tok);
    })
    .join(" ");
}
