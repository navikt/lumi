import type { CSSProperties } from "react";
import { cssVars, cx } from "../../engine/css";
import { MapText } from "../../map";
import "./sporsmal.css";

/*
 * The parts of the widget, split between the team and Lumi, the same way on
 * every slide that shows it. Words get a highlighter stroke, parts a frame,
 * and a cased map line goes from each name to its part. Colour says who
 * decides: green the team, blue Lumi.
 */

/** Who decides a part: the team, or Lumi. Each has its colour. */
export type Tone = "team" | "lumi";

/** A rectangle in the pixels of the layer it is drawn in. */
export interface Boks {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Words marked as with a highlighter: one stroke per line of text, drawn
 * left to right, one line after the other. HTML in the layer's own pixels,
 * multiplied onto the widget, so the text stays as dark as it was. The
 * layer must not fade or move as a whole, or the strokes would cover the
 * text instead of colouring under it.
 */
export function Merker({
  linjer,
  on,
  tone = "team",
  start = 0,
}: {
  linjer: readonly Boks[];
  /** Shown. The strokes are drawn when it turns on. */
  on: boolean;
  tone?: Tone;
  /** Wait before the first stroke, in ms. */
  start?: number;
}) {
  return (
    <div
      className={`merker merker--${tone}`}
      data-on={on ? "" : undefined}
      style={cssVars({ "--merke-start": `${start}ms` })}
      aria-hidden
    >
      {linjer.map((linje, i) => (
        <span
          key={`${linje.x},${linje.y}`}
          className="merke"
          style={{
            left: linje.x,
            top: linje.y,
            width: linje.width,
            height: linje.height,
            ...cssVars({ "--i": i }),
          }}
        />
      ))}
    </div>
  );
}

/**
 * A frame round a part: a cased line, as on the map, so it shows on the
 * dark slide and on the white widget alike. It draws itself round when it
 * turns on. Drawn inside an SVG in the layer's own pixels.
 */
export function Ramme({
  boks,
  on,
  tone = "lumi",
  radius = 16,
  strek = 8,
  start = 0,
  tid = 700,
}: {
  boks: Boks;
  on: boolean;
  tone?: Tone;
  radius?: number;
  /** The coloured line's width. The casing adds a thin edge each side. */
  strek?: number;
  /** Wait before it draws, and how long it takes, in ms. */
  start?: number;
  tid?: number;
}) {
  // The geometry is CSS, so a frame that follows its part can move.
  const shape: CSSProperties = {
    x: boks.x,
    y: boks.y,
    width: boks.width,
    height: boks.height,
    rx: radius,
  };
  return (
    <g
      className={cx("ramme", `peker--${tone}`)}
      data-on={on ? "" : undefined}
      style={cssVars({
        "--ramme-strek": `${strek}px`,
        "--ramme-start": `${start}ms`,
        "--ramme-tid": `${tid}ms`,
      })}
    >
      <rect pathLength={1} className="ramme__kasing" style={shape} />
      <rect pathLength={1} className="ramme__linje" style={shape} />
    </g>
  );
}

/**
 * A pointer at a part of the widget: a cased map line from the name to a
 * ring on the part. Drawn inside a `LineMap`, in stage pixels.
 */
export interface Peker {
  /** Where the line ends, on the widget. */
  at: readonly [number, number];
  /** The name, on one line or more. */
  label: string | readonly string[];
  /** A smaller line under the name, muted. */
  note?: string;
}

/** A key for a pointer, from its name. */
export function pekerKey(peker: Peker): string {
  return typeof peker.label === "string" ? peker.label : peker.label.join(" ");
}

const RING = 14;
/** Room between the name and the start of the line. */
const GAP = 20;

export function PekerLinje({
  peker,
  side,
  labelX,
  size = 36,
  weight = 700,
  tone,
  className,
  style,
}: {
  peker: Peker;
  /** Who decides it: the team's green or Lumi's blue. */
  tone?: Tone;
  /** The side of the widget the name is on. */
  side: "left" | "right";
  /** Where the name ends (left side) or starts (right side). */
  labelX: number;
  size?: number;
  weight?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [x, y] = peker.at;
  const left = side === "left";
  const lineStart = left ? labelX + GAP : labelX - GAP;
  const lineEnd = left ? x - RING : x + RING;
  const d = `M${lineStart} ${y} L${lineEnd} ${y}`;
  // With a note, the name sits above the line and the note under it. A
  // name on more lines grows upwards.
  const shift = peker.note ? Math.round(size * 0.55) : 0;
  const lines = typeof peker.label === "string" ? [peker.label] : peker.label;
  const lineHeight = Math.round(size * 1.12);
  return (
    <g
      className={cx("peker", tone && `peker--${tone}`, className)}
      style={style}
    >
      {/* Cased, as on a transit map, so the line shows on the light widget too. */}
      <path d={d} className="peker__casing" />
      <path d={d} className="peker__line" />
      <circle cx={x} cy={y} r={RING} className="peker__ring" />
      {lines.map((line, i) => (
        <MapText
          key={line}
          x={labelX}
          y={y - shift - (lines.length - 1 - i) * lineHeight}
          anchor={left ? "end" : "start"}
          size={size}
          weight={weight}
          className="peker__label"
        >
          {line}
        </MapText>
      ))}
      {peker.note && (
        <MapText
          x={labelX}
          y={y + Math.round(size * 0.62)}
          anchor={left ? "end" : "start"}
          size={32}
          weight={600}
          muted
        >
          {peker.note}
        </MapText>
      )}
    </g>
  );
}
