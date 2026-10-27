import { useMemo } from "react";
import { cx } from "../engine/css";
import { highlightJson } from "./highlightJson";
import "./PayloadView.css";

export interface PayloadViewProps {
  /** Any JSON-serialisable value, typically a transport payload. */
  payload: unknown;
  /** Caption above the code. */
  caption?: string;
  /** Shown while there is no payload yet. */
  emptyText?: string;
  className?: string;
}

/** A captured payload as formatted, lightly highlighted JSON. */
export function PayloadView({
  payload,
  caption = "Dette ville blitt sendt",
  emptyText = "Ingenting er sendt ennå.",
  className,
}: PayloadViewProps) {
  const json = useMemo(
    () =>
      payload === null || payload === undefined
        ? null
        : JSON.stringify(payload, null, 2),
    [payload],
  );

  return (
    <figure className={cx("payload-view", className)}>
      <figcaption className="payload-view__caption">{caption}</figcaption>
      {json === null ? (
        <p className="payload-view__empty">{emptyText}</p>
      ) : (
        <pre
          className="payload-view__code"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the code can scroll, so keyboard users must be able to reach it
          tabIndex={0}
          data-deck-interactive=""
        >
          <code>{highlightJson(json)}</code>
        </pre>
      )}
    </figure>
  );
}
