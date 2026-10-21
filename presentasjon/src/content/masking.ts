/*
 * The default masking in Lumi API, ported so a slide can show what the API
 * would store. Source: apps/lumi-api/src/main/kotlin/no/nav/lumi/sensitive/
 * SensitiveDataPatterns.kt (HIGH_CONFIDENCE_PATTERNS, in that order) and
 * SensitiveDataFilter.kt (choice between overlapping matches). Keep the two
 * in step.
 */

interface Pattern {
  name: string;
  regex: RegExp;
  replacement: string;
  validate?: (value: string) => boolean;
}

function isValidFodselsnummer(value: string): boolean {
  const digits = value.replace(/[\s.-]/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const d = [...digits].map(Number);
  const weights1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
  const rem1 = weights1.reduce((sum, w, i) => sum + d[i] * w, 0) % 11;
  const check1 = rem1 === 0 ? 0 : 11 - rem1;
  if (check1 === 10 || check1 !== d[9]) return false;
  const weights2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const rem2 = weights2.reduce((sum, w, i) => sum + d[i] * w, 0) % 11;
  const check2 = rem2 === 0 ? 0 : 11 - rem2;
  return check2 !== 10 && check2 === d[10];
}

const PATTERNS: readonly Pattern[] = [
  {
    name: "fødselsnummer",
    regex: /\b\d{6}[\s.-]?\d{5}\b/g,
    replacement: "[FØDSELSNUMMER FJERNET]",
    validate: isValidFodselsnummer,
  },
  {
    name: "navident",
    regex: /\b[a-zA-Z]\d{6}\b/g,
    replacement: "[NAVIDENT FJERNET]",
  },
  {
    name: "e-post",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[E-POST FJERNET]",
  },
  {
    name: "telefonnummer",
    regex: /(?<![0-9a-fA-F-])[2-9](?:\d[\s-]?){6}\d(?![0-9a-fA-F-])/g,
    replacement: "[TELEFON FJERNET]",
  },
  {
    name: "bankkort",
    regex:
      /(?<![0-9a-fA-F]-)\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b(?!-[0-9a-fA-F])/g,
    replacement: "[KORTNUMMER FJERNET]",
  },
  {
    name: "kontonummer",
    regex: /\b\d{4}\.?\d{2}\.?\d{5}\b/g,
    replacement: "[KONTONUMMER FJERNET]",
  },
  {
    name: "hemmelig_adresse",
    regex: /hemmelig(?:%20|\s+)(?:20\s*%(?:%20|\s+))?adresse/gi,
    replacement: "[HEMMELIG ADRESSE]",
  },
];

interface Match {
  priority: number;
  start: number;
  end: number;
}

function findMatches(text: string): Match[] {
  const matches: Match[] = [];
  PATTERNS.forEach((pattern, priority) => {
    for (const found of text.matchAll(pattern.regex)) {
      if (pattern.validate && !pattern.validate(found[0])) continue;
      const start = found.index ?? 0;
      matches.push({ priority, start, end: start + found[0].length });
    }
  });
  return matches;
}

/** Earlier patterns win where matches overlap, as in SensitiveDataFilter. */
function nonOverlapping(matches: Match[]): Match[] {
  const sorted = [...matches].sort(
    (a, b) =>
      a.start - b.start ||
      a.priority - b.priority ||
      b.end - b.start - (a.end - a.start),
  );
  const overlaps = (a: Match, b: Match) => a.start < b.end && a.end > b.start;
  const accepted: Match[] = [];
  for (const match of sorted) {
    while (accepted.length > 0) {
      const last = accepted[accepted.length - 1];
      if (!overlaps(match, last)) break;
      if (match.priority < last.priority) {
        accepted.pop();
        continue;
      }
      break;
    }
    if (!accepted.some((other) => overlaps(match, other))) {
      accepted.push(match);
    }
  }
  return accepted.sort((a, b) => a.start - b.start);
}

export interface MaskedPart {
  text: string;
  /** True for a replacement such as «[E-POST FJERNET]». */
  masked: boolean;
}

/** The text as Lumi API would store it, split so the masked parts can be marked. */
export function maskLikeLumiApi(text: string): MaskedPart[] {
  const parts: MaskedPart[] = [];
  let position = 0;
  for (const match of nonOverlapping(findMatches(text))) {
    if (match.start > position) {
      parts.push({ text: text.slice(position, match.start), masked: false });
    }
    parts.push({ text: PATTERNS[match.priority].replacement, masked: true });
    position = match.end;
  }
  if (position < text.length) {
    parts.push({ text: text.slice(position), masked: false });
  }
  return parts;
}
