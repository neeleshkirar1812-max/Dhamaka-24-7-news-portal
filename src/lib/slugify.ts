/**
 * Basic Devanagari-to-Latin transliteration map for generating clean URL slugs
 * from Hindi headlines without external network calls.
 */
const DEVANAGARI_MAP: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri",
  ए: "e", ऐ: "ai", ओ: "o", औ: "au", अं: "an", अः: "ah",
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h",
  क्ष: "ksh", त्र: "tr", ज्ञ: "gy", श्र: "shr",
  क़: "q", ख़: "kh", ग़: "gh", ज़: "z", ड़: "d", ढ़: "dh", फ़: "f",
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ं": "n", "ः": "h", "ँ": "n",
  "्": "", "़": "",
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export function transliterateHindi(text: string): string {
  let out = "";
  for (const ch of text) {
    if (DEVANAGARI_MAP[ch] !== undefined) {
      out += DEVANAGARI_MAP[ch];
    } else {
      out += ch;
    }
  }
  return out;
}

export function slugify(input: string, fallbackPrefix = "news"): string {
  const latin = transliterateHindi(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90)
    .replace(/^-|-$/g, "");

  if (latin.length >= 3) {
    return latin;
  }
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${fallbackPrefix}-${suffix}`;
}
