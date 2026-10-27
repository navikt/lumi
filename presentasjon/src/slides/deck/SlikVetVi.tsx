import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./avslutning.css";

/** The stripe at the foot of the slide, clear of the Teams corner. */
const Y = 900;
const LINE_END = 1480;
const LABEL_Y = 968;
const NOTE_Y = 1010;

/** Three checks on one line. The first, the pentest, is the oldest. */
const STOPS = [
  {
    x: 146,
    r: 34,
    label: "Team SåPe, februar 2026",
    note: "Før Surveyverksted.",
  },
  {
    x: 580,
    r: 20,
    label: "Over 2 500 tester",
    note: "axe i widgeten og e2e",
  },
  {
    x: 980,
    r: 20,
    label: "Sjekk selv på npm",
    note: "provenance og adressene i pakken",
  },
] as const;

function SlikVetVi() {
  return (
    <div className="slide">
      <h2 className="end-at slik-vet-vi">
        <span className="slik-vet-vi__kicker">Pentesten fant</span>
        <span className="slik-vet-vi__none">ingen</span>
        <span className="slik-vet-vi__rest">
          høye eller
          <br />
          kritiske funn
        </span>
      </h2>
      <LineMap label="Tre kontroller på én linje: pentesten fra Team SåPe i februar 2026, før Surveyverksted. Over 2 500 automatiske tester, med axe i widgeten og i e2e-testene. Og det dere kan sjekke selv på npm: provenance, og hvilke adresser som står i pakken.">
        <Line
          points={[
            [STOPS[0].x, Y],
            [LINE_END, Y],
          ]}
        />
        {STOPS.map((stop, i) => (
          <g key={stop.label} {...(i === 0 ? {} : { "data-from": i })}>
            <Station x={stop.x} y={Y} r={stop.r} />
            <MapText x={stop.x - stop.r} y={LABEL_Y} size={32} weight={700}>
              {stop.label}
            </MapText>
            <MapText
              x={stop.x - stop.r}
              y={NOTE_Y}
              size={32}
              weight={600}
              muted
            >
              {stop.note}
            </MapText>
          </g>
        ))}
      </LineMap>
    </div>
  );
}

export const slikVetVi: Slide = {
  id: "slik-vet-vi",
  title: "Pentesten fant ingen høye eller kritiske funn",
  rooms: ["frontend"],
  steps: 2,
  Component: SlikVetVi,
};
