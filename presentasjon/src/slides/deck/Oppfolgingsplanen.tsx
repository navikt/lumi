import type { Slide, SlideProps } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, Station } from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/*
 * The same question in the old plan (measured before Lumi) and the new one
 * (measured in Lumi): the share who answered 4 or 5 out of 5. From the
 * dashboards, October 2025 to August 2026, rounded. Two groups, not a time
 * series: the gap between the rings is the difference, on a true axis.
 *
 * The questions themselves are on the slide before, oppfolgingsplanen-intro.
 * Here each group is a band between hairlines, with its averages and its
 * number of answers under its name, and the key with the periods and the
 * caveat is a band of its own at the bottom.
 */
const ROWS = [
  {
    who: "Ledere",
    question: "«Hvordan var det å bruke oppfølgingsplanen?»",
    before: 66,
    after: 77,
    detail: "Snitt 3,8 og 4,0 (9 523 og 1 757 svar)",
    y: 430,
  },
  {
    who: "Sykmeldte",
    question: "«Er oppfølgingsplanen til hjelp for deg?»",
    before: 73,
    after: 78,
    detail: "Snitt 4,0 og 4,1 (13 319 og 3 033 svar)",
    y: 700,
  },
] as const;

const LEFT = 112;
const RIGHT = 1808;
/** 50 to 100 percent, 20 px a point. */
const AXIS_FROM = 50;
const AXIS_TO = 100;
const AXIS_X = 700;
const PER_POINT = 20;
const at = (value: number) => AXIS_X + (value - AXIS_FROM) * PER_POINT;

const RING = 28;
/** The numbers stand above the axis, outside the pair of rings. */
const NUMBER_RISE = 64;
const NUMBER_GAP = 34;
/** Hairlines: under the title, between the groups, over the key. */
const RULES = [262, 548, 784] as const;
const LEGEND_Y = 912;
/** The key for the new plan, right of the old one and its period. */
const NEW_KEY_X = 896;

const percent = (value: number) => `${value} %`;

function Row({ row, index }: { row: (typeof ROWS)[number]; index: number }) {
  const before = at(row.before);
  const after = at(row.after);
  return (
    <g
      className="opp__row"
      style={cssVars({ "--row": index, "--travel": `${before - after}px` })}
    >
      <MapText x={LEFT} y={row.y - NUMBER_RISE} size={52} weight={800}>
        {row.who}
      </MapText>
      <MapText x={LEFT} y={row.y} size={32} weight={500} muted>
        {row.detail}
      </MapText>

      <Line
        points={[
          [at(AXIS_FROM), row.y],
          [at(AXIS_TO), row.y],
        ]}
        dim
        width={10}
      />
      <MapText
        x={before - NUMBER_GAP}
        y={row.y - NUMBER_RISE}
        anchor="end"
        size={120}
        weight={200}
        muted
        className="opp__number"
      >
        {percent(row.before)}
      </MapText>
      {/*
       * The new ring starts under the old one and travels to its value,
       * drawing the gap behind it. Then the new number comes.
       */}
      <g className="opp__after" data-from={1}>
        <Line
          points={[
            [before, row.y],
            [after, row.y],
          ]}
          draw
          from={1}
          className="opp__gap"
        />
        <Station x={after} y={row.y} r={RING} className="opp__ring" />
        <MapText
          x={after + NUMBER_GAP}
          y={row.y - NUMBER_RISE}
          size={120}
          weight={900}
          className="opp__number opp__number--after"
        >
          {percent(row.after)}
        </MapText>
      </g>
      <Station x={before} y={row.y} r={RING} dim />
    </g>
  );
}

function Oppfolgingsplanen({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  const top = ROWS[0].y;
  return (
    <div className="slide opp" data-motion={motion ? "" : undefined}>
      <h2 className="slide-title">Ble den nye planen dårligere?</h2>
      <LineMap
        label={`Andelen som svarte 4 eller 5 av 5 på samme spørsmål, på en akse fra 50 til 100 prosent. ${ROWS.map(
          (row) =>
            `${row.who}, ${row.question}: ${row.before} prosent i den gamle planen og ${row.after} prosent i den nye. ${row.detail}.`,
        ).join(
          " ",
        )} Målt i ulike perioder: den gamle planen fra oktober 2025 til mars 2026, den nye fra februar til august 2026.`}
      >
        {RULES.map((y) => (
          <line
            key={y}
            className="opp__rule"
            x1={LEFT}
            x2={RIGHT}
            y1={y}
            y2={y}
          />
        ))}

        {ROWS.map((row, i) => (
          <Row key={row.who} row={row} index={i} />
        ))}

        {/* The ends of the axis, once, under the top row. */}
        <MapText
          x={at(AXIS_FROM)}
          y={top + 52}
          anchor="middle"
          size={32}
          weight={600}
          muted
        >
          {percent(AXIS_FROM)}
        </MapText>
        <MapText
          x={at(AXIS_TO)}
          y={top + 52}
          anchor="middle"
          size={32}
          weight={600}
          muted
        >
          {percent(AXIS_TO)}
        </MapText>

        {/*
         * The caveat stands on the slide, so it is not read as proof when
         * the deck is open on the web: the plans were measured in different
         * periods, by different people.
         */}
        <MapText x={LEFT} y={LEGEND_Y - 60} size={32} weight={600}>
          Andelen som svarte 4 eller 5 av 5 på samme spørsmål i begge planene,
          målt i ulike perioder.
        </MapText>
        <Station x={LEFT + 16} y={LEGEND_Y} r={14} dim />
        <MapText x={LEFT + 50} y={LEGEND_Y + 2} size={32} weight={600} muted>
          Gammel plan,
          <tspan className="opp__period"> oktober 2025 til mars 2026</tspan>
        </MapText>
        <g className="opp__legend-after" data-from={1}>
          <Station
            x={NEW_KEY_X}
            y={LEGEND_Y}
            r={14}
            className="opp__ring opp__ring--key"
          />
          <MapText x={NEW_KEY_X + 34} y={LEGEND_Y + 2} size={32} weight={600}>
            Ny plan,
            <tspan className="opp__period"> februar til august 2026</tspan>
          </MapText>
        </g>
      </LineMap>
    </div>
  );
}

export const oppfolgingsplanen: Slide = {
  id: "oppfolgingsplanen",
  title: "Ble den nye planen dårligere?",
  steps: 1,
  Component: Oppfolgingsplanen,
};
