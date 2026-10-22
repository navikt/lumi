import type { Slide, SlideProps } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, Station } from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/*
 * The same question in the old plan (measured in FlexJar) and the new one
 * (measured in Lumi): the share who answered 4 or 5 out of 5. From the
 * dashboards, October 2025 to August 2026, rounded. Two groups, not a time
 * series: the gap between the rings is the difference, on a true axis.
 */
const ROWS = [
  {
    who: "Ledere",
    question: ["«Hvordan var det å bruke", "oppfølgingsplanen?»"],
    before: 66,
    after: 77,
    detail: "Snitt 3,8 og 4,0 (9 523 og 1 757 svar)",
    y: 512,
  },
  {
    who: "Sykmeldte",
    question: ["«Er oppfølgingsplanen til", "hjelp for deg?»"],
    before: 73,
    after: 78,
    detail: "Snitt 4,0 og 4,1 (13 319 og 3 033 svar)",
    y: 772,
  },
] as const;

const LEFT = 112;
/** 50 to 100 percent, 20 px a point. */
const AXIS_FROM = 50;
const AXIS_TO = 100;
const AXIS_X = 700;
const PER_POINT = 20;
const at = (value: number) => AXIS_X + (value - AXIS_FROM) * PER_POINT;

const RING = 22;
/** The numbers stand above the axis, outside the pair of rings. */
const NUMBER_RISE = 58;
const NUMBER_GAP = 30;
const LEGEND_Y = 1000;

const percent = (value: number) => `${value} %`;

function Row({ row, index }: { row: (typeof ROWS)[number]; index: number }) {
  const before = at(row.before);
  const after = at(row.after);
  return (
    <g className="opp__row" style={cssVars({ "--row": index })}>
      <MapText x={LEFT} y={row.y - NUMBER_RISE} size={44} weight={800}>
        {row.who}
      </MapText>
      {row.question.map((line, i) => (
        <MapText
          key={line}
          x={LEFT}
          y={row.y + i * 40}
          size={32}
          weight={600}
          muted
        >
          {line}
        </MapText>
      ))}
      <MapText x={LEFT} y={row.y + 88} size={32} weight={500} muted>
        {row.detail}
      </MapText>

      <Line
        points={[
          [at(AXIS_FROM), row.y],
          [at(AXIS_TO), row.y],
        ]}
        dim
        width={6}
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
      <h2 className="slide-title">
        Den nye oppfølgingsplanen skulle ikke bli dårligere
      </h2>
      <LineMap label="Andelen som svarte 4 eller 5 av 5 på samme spørsmål, på en akse fra 50 til 100 prosent. Ledere, «Hvordan var det å bruke oppfølgingsplanen?»: 66 prosent i den gamle planen og 77 prosent i den nye. Snitt 3,8 og 4,0, med 9 523 og 1 757 svar. Sykmeldte, «Er oppfølgingsplanen til hjelp for deg?»: 73 prosent i den gamle planen og 78 prosent i den nye. Snitt 4,0 og 4,1, med 13 319 og 3 033 svar. Den gamle planen er målt i FlexJar, den nye i Lumi.">
        {ROWS.map((row, i) => (
          <Row key={row.who} row={row} index={i} />
        ))}

        {/* The ends of the axis, once, under the top row. */}
        <MapText
          x={at(AXIS_FROM)}
          y={top + 50}
          anchor="middle"
          size={32}
          weight={600}
          muted
        >
          {percent(AXIS_FROM)}
        </MapText>
        <MapText
          x={at(AXIS_TO)}
          y={top + 50}
          anchor="middle"
          size={32}
          weight={600}
          muted
        >
          {percent(AXIS_TO)}
        </MapText>

        <MapText x={LEFT} y={LEGEND_Y - 50} size={32} weight={600}>
          Andelen som svarte 4 eller 5 av 5 på samme spørsmål i begge planene.
        </MapText>
        <Station x={LEFT + 16} y={LEGEND_Y} r={14} dim />
        <MapText x={LEFT + 50} y={LEGEND_Y + 2} size={32} weight={600} muted>
          Gammel plan, målt i FlexJar
        </MapText>
        <g className="opp__legend-after" data-from={1}>
          <Station x={LEFT + 556} y={LEGEND_Y} r={14} />
          <MapText x={LEFT + 590} y={LEGEND_Y + 2} size={32} weight={600}>
            Ny plan, målt i Lumi
          </MapText>
        </g>
      </LineMap>
    </div>
  );
}

export const oppfolgingsplanen: Slide = {
  id: "oppfolgingsplanen",
  title: "Den nye oppfølgingsplanen skulle ikke bli dårligere",
  steps: 1,
  notes: `Ordrett: «Da vi lagde ny oppfølgingsplan, var målet at den ikke skulle bli dårligere. Vi stilte samme spørsmål i den gamle og den nye planen.»

Steg 0 viser bare den gamle planen. Spør: «Hva tror dere skjedde?» Vent noen sekunder.

Klikk 1: «Lederne ga den gamle planen 3,8 og den nye 4,0, og andelen som ga fire eller fem, gikk fra 66 til 77 prosent. For de sykmeldte gikk den fra 73 til 78.»

Aksen går fra 50 til 100 prosent, så avstanden mellom ringene viser forskjellen.

Den gamle planen ble målt i FlexJar fra oktober 2025 til mars 2026, den nye i Lumi fra februar til august 2026. Planen ble lansert for hele landet 27. april, og den datoen står som en markør i dashboardet.

Si «gikk opp». Den nye planen er ikke bevist bedre: periodene er ikke de samme, og det er ikke de samme folkene som svarte.

95 prosent av de sykmeldte kjenner seg igjen i innholdet i planen.

Poenget for salen: sett et mål for en endring, still samme spørsmål før og etter, og se på svarene.`,
  Component: Oppfolgingsplanen,
};
