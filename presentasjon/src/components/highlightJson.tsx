import type { ReactNode } from "react";

// Strings (optionally followed by a colon, which makes them keys), literals,
// numbers and punctuation in JSON.stringify output.
const TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

/** Wraps the tokens of formatted JSON in spans with `json-*` classes. */
export function highlightJson(json: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of json.matchAll(TOKEN)) {
    const start = match.index;
    if (start > cursor) nodes.push(json.slice(cursor, start));
    const [text, quoted, colon, literal, numeric] = match;
    if (quoted !== undefined && colon !== undefined) {
      nodes.push(
        <span key={start} className="json-key">
          {quoted}
        </span>,
        <span key={`${start}:`} className="json-punctuation">
          {colon}
        </span>,
      );
    } else if (quoted !== undefined) {
      nodes.push(
        <span key={start} className="json-string">
          {quoted}
        </span>,
      );
    } else if (literal !== undefined) {
      nodes.push(
        <span key={start} className="json-literal">
          {literal}
        </span>,
      );
    } else if (numeric !== undefined) {
      nodes.push(
        <span key={start} className="json-number">
          {numeric}
        </span>,
      );
    } else {
      nodes.push(
        <span key={start} className="json-punctuation">
          {text}
        </span>,
      );
    }
    cursor = start + text.length;
  }
  if (cursor < json.length) nodes.push(json.slice(cursor));
  return nodes;
}
