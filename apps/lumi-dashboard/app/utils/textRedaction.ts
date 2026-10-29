import { z } from "zod";

export const TEXT_REDACTION_PLACEHOLDER = "[TEKST FJERNET]";
// Match TextProcessor's marker definition, including Java Regex's ASCII whitespace.
const REDACTION_MARKER_PATTERN = /\[[A-ZÆØÅ][A-ZÆØÅ \t\n\v\f\r-]+\]/g;
export const TextRedactionRangeSchema = z
  .object({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  })
  .refine(({ start, end }) => end > start);
export type TextRedactionRange = z.infer<typeof TextRedactionRangeSchema>;

export const RedactFeedbackSchema = z.object({
  id: z.string().min(1).max(255),
  team: z.string().min(1).max(255),
  fieldId: z.string().min(1).max(255),
  expectedTextHash: z.string().regex(/^[0-9a-f]{64}$/),
  ranges: z.array(TextRedactionRangeSchema).min(1).max(20),
});
export type RedactFeedbackInput = z.infer<typeof RedactFeedbackSchema>;

export async function textRedactionHash(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Textareas normalize CRLF to LF; translate the selection back to stored UTF-16 offsets. */
export function storedTextSelection(
  text: string,
  start: number,
  end: number,
): TextRedactionRange | null {
  if (start >= end) return null;
  const offsets = [0];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\r" && text[index + 1] === "\n") index++;
    offsets.push(index + 1);
  }
  const storedStart = offsets[start];
  const storedEnd = offsets[end];
  if (storedStart === undefined || storedEnd === undefined) return null;
  return { start: storedStart, end: storedEnd };
}

function splitsSurrogatePair(text: string, offset: number): boolean {
  return (
    offset > 0 &&
    offset < text.length &&
    /[\uD800-\uDBFF]/.test(text[offset - 1]) &&
    /[\uDC00-\uDFFF]/.test(text[offset])
  );
}

/** Uses original UTF-16 offsets, matching textarea selections and the API. */
export function redactTextPreview(
  text: string,
  ranges: TextRedactionRange[],
): string {
  let offset = 0;
  let result = "";
  const markers = [...text.matchAll(REDACTION_MARKER_PATTERN)];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (
      !TextRedactionRangeSchema.safeParse(range).success ||
      range.start < offset ||
      range.end > text.length ||
      splitsSurrogatePair(text, range.start) ||
      splitsSurrogatePair(text, range.end)
    ) {
      throw new Error(
        "Marker en gyldig del av teksten. Hele tegn må være med.",
      );
    }
    if (
      markers.some((marker) => {
        const start = marker.index;
        const end = start + marker[0].length;
        return (
          (range.start > start && range.start < end) ||
          (range.end > start && range.end < end)
        );
      })
    ) {
      throw new Error(
        "Marker hele den eksisterende maskeringen, eller velg tekst utenfor den.",
      );
    }
    result += text.slice(offset, range.start) + TEXT_REDACTION_PLACEHOLDER;
    offset = range.end;
  }
  return result + text.slice(offset);
}
