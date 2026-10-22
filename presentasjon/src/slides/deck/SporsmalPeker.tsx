import { MapText } from "../../map";
import "./sporsmal.css";

/**
 * A pointer at a part of the widget: a cased map line from the name to a
 * ring on the widget, as on «Dere bestemmer innholdet …» and «Ute nå …».
 * Drawn inside a `LineMap`, in stage pixels.
 */
export interface Peker {
  /** Where the line ends, on the widget. */
  at: readonly [number, number];
  label: string;
  /** A smaller line under the name, muted. */
  note?: string;
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
}: {
  peker: Peker;
  /** The side of the widget the name is on. */
  side: "left" | "right";
  /** Where the name ends (left side) or starts (right side). */
  labelX: number;
  size?: number;
  weight?: number;
}) {
  const [x, y] = peker.at;
  const left = side === "left";
  const lineStart = left ? labelX + GAP : labelX - GAP;
  const lineEnd = left ? x - RING : x + RING;
  const d = `M${lineStart} ${y} L${lineEnd} ${y}`;
  // With a note, the name sits above the line and the note under it.
  const shift = peker.note ? Math.round(size * 0.55) : 0;
  return (
    <g>
      {/* Cased, as on a transit map, so the line shows on the light widget too. */}
      <path d={d} className="peker__casing" />
      <path d={d} className="peker__line" />
      <circle cx={x} cy={y} r={RING} className="peker__ring" />
      <MapText
        x={labelX}
        y={y - shift}
        anchor={left ? "end" : "start"}
        size={size}
        weight={weight}
      >
        {peker.label}
      </MapText>
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
