import type { ReactNode } from "react";
import { cssVars } from "../../engine/css";
import { type Point, roundedPath } from "../../map";

interface ReiseProps {
  /** The route, from where the answer is given to where it lands. */
  points: readonly Point[];
  /** Corner radius, as on `Line`. Keep it inside the station rings. */
  radius?: number;
  /** The build step that sends the answer. */
  from: number;
  /** When the answer leaves, in ms after the step starts. */
  start?: number;
  /** How long it travels, in ms. */
  duration: number;
  /** The answer disc. */
  r?: number;
  /** Drawn between the line and the answer, such as the stations it passes. */
  children?: ReactNode;
}

/**
 * The answer travels its route and lands. The disc is the head of the line:
 * the line is drawn behind it, so the route is only there where the answer
 * has been. When it lands, the glow flares and a thin ring runs out.
 *
 * The end state is the still map: the line drawn and the disc at the end. That
 * is what paper, the PDF and reduced motion show at once, and what a browser
 * without CSS motion paths gets.
 */
export function Reise({
  points,
  radius = 0,
  from,
  start = 0,
  duration,
  r = 36,
  children,
}: ReiseProps) {
  const d = roundedPath(points, radius);
  const [x, y] = points[points.length - 1];
  return (
    <g
      className="kart-reise"
      data-from={from}
      style={cssVars({
        "--reise-start": `${start}ms`,
        "--reise-tid": `${duration}ms`,
        "--reise-ankomst": `${start + duration}ms`,
      })}
    >
      <path d={d} pathLength={1} className="map-line kart-reise__line" />
      {children}
      <circle
        cx={x}
        cy={y}
        r={r}
        className="map-answer__ring kart-reise__ring"
      />
      {/* The flare when it lands: a stronger glow under the disc, faded in and out. */}
      <circle cx={x} cy={y} r={r} className="map-answer kart-reise__flare" />
      <circle cx={x} cy={y} r={r} className="map-answer kart-reise__disc" />
      {/* On its way: the same disc, moved along the line. */}
      <circle
        cx={0}
        cy={0}
        r={r}
        className="map-answer kart-reise__dot"
        style={{ offsetPath: `path("${d}")` }}
      />
    </g>
  );
}
