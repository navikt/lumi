import type { CSSProperties, ReactNode } from "react";
import { cx } from "../engine/css";
import { type Point, roundedPath } from "./geometry";
import "./map.css";

/** Build step props shared by every map part: shown from step `from`. */
interface Revealable {
  from?: number;
  className?: string;
}

function reveal(from: number | undefined) {
  return from === undefined ? {} : { "data-from": from };
}

interface LineMapProps {
  /** What the map shows, for screen readers. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** A full-stage SVG in stage pixels. Text on the map is SVG text. */
export function LineMap({ label, children, className }: LineMapProps) {
  return (
    <svg
      className={cx("map", className)}
      viewBox="0 0 1920 1080"
      width={1920}
      height={1080}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

interface LineProps extends Revealable {
  points: readonly Point[];
  radius?: number;
  /** A line still being built: on the way, not there yet. */
  dashed?: boolean;
  dim?: boolean;
  /** Draws itself when revealed, instead of fading in. */
  draw?: boolean;
  width?: number;
  /** An arrowhead at the last point, where direction matters. */
  arrow?: boolean;
}

const ARROW_LENGTH = 40;
const ARROW_HALF_WIDTH = 24;

/** The line ends where the arrowhead starts, so the tip stays sharp. */
function withArrow(points: readonly Point[]) {
  const end = points[points.length - 1];
  const before = points[points.length - 2];
  const length = Math.hypot(end[0] - before[0], end[1] - before[1]) || 1;
  const ux = (end[0] - before[0]) / length;
  const uy = (end[1] - before[1]) / length;
  const base: Point = [end[0] - ux * ARROW_LENGTH, end[1] - uy * ARROW_LENGTH];
  const head = [
    end,
    [base[0] - uy * ARROW_HALF_WIDTH, base[1] + ux * ARROW_HALF_WIDTH],
    [base[0] + uy * ARROW_HALF_WIDTH, base[1] - ux * ARROW_HALF_WIDTH],
  ]
    .map((point) => point.join(","))
    .join(" ");
  return { points: [...points.slice(0, -1), base], head };
}

export function Line({
  points,
  radius,
  dashed = false,
  dim = false,
  draw = false,
  width,
  arrow = false,
  from,
  className,
}: LineProps) {
  const shape = arrow && points.length > 1 ? withArrow(points) : null;
  const path = (
    <path
      d={roundedPath(shape ? shape.points : points, radius)}
      pathLength={draw ? 1 : undefined}
      className={cx(
        "map-line",
        dashed && "map-line--dashed",
        dim && "map-line--dim",
        draw && "map-line--draw",
        className,
      )}
      style={width ? { strokeWidth: width } : undefined}
      // A drawn line keeps its own step, also under an arrowhead, so it
      // can draw itself in toward the head.
      {...(shape && !draw ? {} : reveal(from))}
    />
  );
  if (!shape) return path;
  return (
    <g className="map-arrow" {...reveal(from)}>
      {path}
      <polygon
        points={shape.head}
        className={cx("map-arrow__head", dim && "map-arrow__head--dim")}
      />
    </g>
  );
}

type Side = "right" | "left" | "above" | "below";

interface StationProps extends Revealable {
  x: number;
  y: number;
  label?: string;
  /** Smaller second line under the label. */
  note?: string;
  side?: Side;
  dim?: boolean;
  /** Host names and app names are set in mono. */
  mono?: boolean;
  r?: number;
}

const LABEL_GAP = 28;
const NOTE_GAP = 42;

/** Where the label and the note go, relative to the station. */
function labelPlacement(
  side: Side,
  x: number,
  y: number,
  r: number,
  hasNote: boolean,
) {
  switch (side) {
    case "left":
    case "right": {
      const anchor = side === "left" ? ("end" as const) : ("start" as const);
      const labelX = side === "left" ? x - r - LABEL_GAP : x + r + LABEL_GAP;
      const labelY = hasNote ? y - NOTE_GAP / 2 : y;
      return { anchor, labelX, labelY, noteY: labelY + NOTE_GAP };
    }
    case "above": {
      // The note sits above the label, so the label stays next to the station.
      const labelY = y - r - LABEL_GAP - 18;
      return {
        anchor: "middle" as const,
        labelX: x,
        labelY,
        noteY: labelY - NOTE_GAP,
      };
    }
    default: {
      const labelY = y + r + LABEL_GAP + 22;
      return {
        anchor: "middle" as const,
        labelX: x,
        labelY,
        noteY: labelY + NOTE_GAP,
      };
    }
  }
}

export function Station({
  x,
  y,
  label,
  note,
  side = "right",
  dim = false,
  mono = false,
  r = 22,
  from,
  className,
}: StationProps) {
  const place = labelPlacement(side, x, y, r, Boolean(note));
  return (
    <g
      className={cx("map-station", dim && "map-station--dim", className)}
      {...reveal(from)}
    >
      <circle cx={x} cy={y} r={r} className="map-station__ring" />
      {label && (
        <text
          x={place.labelX}
          y={place.labelY}
          textAnchor={place.anchor}
          dominantBaseline="middle"
          className={cx("map-label", mono && "map-label--mono")}
        >
          {label}
        </text>
      )}
      {label && note && (
        <text
          x={place.labelX}
          y={place.noteY}
          textAnchor={place.anchor}
          dominantBaseline="middle"
          className="map-note"
        >
          {note}
        </text>
      )}
    </g>
  );
}

interface AnswerProps extends Revealable {
  x: number;
  y: number;
  r?: number;
  /** Moves the disc with a transition, for an answer on its way. */
  style?: CSSProperties;
}

/** The answer: the only warm colour in the deck. */
export function Answer({ x, y, r = 40, from, className, style }: AnswerProps) {
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      className={cx("map-answer", className)}
      style={style}
      {...reveal(from)}
    />
  );
}

type Tone = "nais" | "neutral";

interface ZoneProps extends Revealable {
  x: number;
  y: number;
  width: number;
  height: number;
  tone: Tone;
  label: string;
  /** Lines under the label. */
  note?: string | readonly string[];
  /** Where the label sits inside the zone. */
  labelAt?: "bottom" | "top";
}

const ZONE_INSET = 36;
const ZONE_LINE = 40;

export function Zone({
  x,
  y,
  width,
  height,
  tone,
  label,
  note,
  labelAt = "bottom",
  from,
  className,
}: ZoneProps) {
  const notes =
    note === undefined ? [] : typeof note === "string" ? [note] : note;
  const blockHeight = ZONE_LINE * notes.length;
  const labelY =
    labelAt === "top"
      ? y + ZONE_INSET + 30
      : y + height - ZONE_INSET - 6 - blockHeight;
  return (
    <g className={cx("map-zone", className)} {...reveal(from)}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className={`map-zone__area map-zone__area--${tone}`}
      />
      <text x={x + ZONE_INSET} y={labelY} className="map-zone__label">
        {label}
      </text>
      {notes.map((line, i) => (
        <text
          key={line}
          x={x + ZONE_INSET}
          y={labelY + ZONE_LINE * (i + 1)}
          className="map-zone__note"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

interface BadgeProps extends Revealable {
  x: number;
  y: number;
  text: string;
  /** Badge width. Overpass is wide, so set it per text. */
  width?: number;
}

/** A line badge, like the line numbers on a metro map. */
export function LineBadge({
  x,
  y,
  text,
  width = 150,
  from,
  className,
}: BadgeProps) {
  const height = 64;
  return (
    <g className={cx("map-badge", className)} {...reveal(from)}>
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={12}
      />
      <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle">
        {text}
      </text>
    </g>
  );
}

interface AppBoxProps extends Revealable {
  x: number;
  y: number;
  width: number;
  /** What runs inside the app, shown as a dark badge on the right. */
  part: string;
  partWidth: number;
  label?: string;
}

/** An app in the browser, with the survey code it carries. */
export function AppBox({
  x,
  y,
  width,
  part,
  partWidth,
  label = "appen",
  from,
  className,
}: AppBoxProps) {
  const height = 96;
  const inset = 16;
  return (
    <g className={cx("map-app", className)} {...reveal(from)}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        className="map-app__frame"
      />
      <text
        x={x + 28}
        y={y + height / 2 + 2}
        dominantBaseline="middle"
        className="map-app__label"
      >
        {label}
      </text>
      <rect
        x={x + width - inset - partWidth}
        y={y + inset}
        width={partWidth}
        height={height - inset * 2}
        rx={8}
        className="map-app__part"
      />
      <text
        x={x + width - inset - partWidth / 2}
        y={y + height / 2 + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="map-app__part-label"
      >
        {part}
      </text>
    </g>
  );
}

interface MapTextProps extends Revealable {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  muted?: boolean;
  mono?: boolean;
}

export function MapText({
  x,
  y,
  children,
  anchor = "start",
  size = 36,
  weight = 600,
  muted = false,
  mono = false,
  from,
  className,
}: MapTextProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      className={cx(
        "map-text",
        muted && "map-text--muted",
        mono && "map-label--mono",
        className,
      )}
      style={{ fontSize: size, fontWeight: weight }}
      {...reveal(from)}
    >
      {children}
    </text>
  );
}
