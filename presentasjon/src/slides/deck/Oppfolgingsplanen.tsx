import { useEffect, useState } from "react";
import { type Slide, type SlideProps, useRenderMode } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./bevis.css";

/*
 * The same question in the old plan (measured in FlexJar) and the new one
 * (measured in Lumi): the share who answered 4 or 5 out of 5. From the
 * dashboards, October 2025 to August 2026, rounded.
 */
const ROWS = [
  {
    who: "Ledere",
    question: "«Hvordan var det å bruke oppfølgingsplanen?»",
    before: 66,
    after: 77,
    detail: "Snitt 3,8 og 4,0. 9 523 og 1 757 svar.",
    y: 520,
  },
  {
    who: "Sykmeldte",
    question: "«Er oppfølgingsplanen til hjelp for deg?»",
    before: 73,
    after: 78,
    detail: "Snitt 4,0 og 4,1. 13 319 og 3 033 svar.",
    y: 845,
  },
] as const;

const LEFT = 112;
const OLD_X = 940;
const NEW_X = 1400;
const RING = 22;
const COUNT_MS = 1100;

const percent = (value: number) => `${value} %`;

/**
 * Counts from `from` to `to` when `run` turns on, as the line draws. The end
 * value is shown at once when not running or when motion is reduced.
 */
function useCountUp(from: number, to: number, run: boolean): number {
  const [value, setValue] = useState(to);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!run || reduce.matches) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setValue(from);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, run]);
  return value;
}

function Row({ row, run }: { row: (typeof ROWS)[number]; run: boolean }) {
  const after = useCountUp(row.before, row.after, run);
  return (
    <g>
      <MapText x={LEFT} y={row.y - 52} size={56} weight={800}>
        {row.who}
      </MapText>
      <MapText x={LEFT} y={row.y + 12} size={32} weight={600} muted>
        {row.question}
      </MapText>
      <MapText
        x={OLD_X}
        y={row.y - 104}
        anchor="middle"
        size={112}
        weight={800}
        muted
      >
        {percent(row.before)}
      </MapText>
      <Station x={OLD_X} y={row.y} dim />
      <MapText
        x={OLD_X}
        y={row.y + 62}
        anchor="middle"
        size={32}
        weight={600}
        muted
      >
        gammel plan
      </MapText>
      <g data-from={1}>
        <Line
          points={[
            [OLD_X + RING, row.y],
            [NEW_X - RING, row.y],
          ]}
          draw
          from={1}
        />
        <MapText
          x={NEW_X}
          y={row.y - 116}
          anchor="middle"
          size={168}
          weight={800}
        >
          {percent(after)}
        </MapText>
        <Station x={NEW_X} y={row.y} />
        <MapText
          x={NEW_X}
          y={row.y + 62}
          anchor="middle"
          size={32}
          weight={700}
        >
          ny plan
        </MapText>
        <MapText x={LEFT} y={row.y + 62} size={32} weight={500} muted>
          {row.detail}
        </MapText>
      </g>
    </g>
  );
}

function Oppfolgingsplanen({ step, active }: SlideProps) {
  const run = useRenderMode() === "stage" && active && step >= 1;
  return (
    <div className="slide">
      <h2 className="slide-title">
        Målet var at den nye planen ikke skulle bli dårligere
      </h2>
      <LineMap label="To rader med andelen som svarte 4 eller 5 av 5, i den gamle og den nye oppfølgingsplanen. Ledere, «Hvordan var det å bruke oppfølgingsplanen?»: 66 prosent i den gamle, 77 prosent i den nye. Snitt 3,8 og 4,0, med 9 523 og 1 757 svar. Sykmeldte, «Er oppfølgingsplanen til hjelp for deg?»: 73 prosent i den gamle, 78 prosent i den nye. Snitt 4,0 og 4,1, med 13 319 og 3 033 svar. Samme spørsmål i gammel og ny plan.">
        {ROWS.map((row) => (
          <Row key={row.who} row={row} run={run} />
        ))}
        <MapText x={LEFT} y={1000} size={32} weight={600} from={1}>
          Andelen som svarte 4 eller 5. Samme spørsmål i gammel og ny plan.
        </MapText>
      </LineMap>
    </div>
  );
}

export const oppfolgingsplanen: Slide = {
  id: "oppfolgingsplanen",
  title: "Målet var at den nye planen ikke skulle bli dårligere",
  steps: 1,
  notes: `Ordrett: «Da vi lagde ny oppfølgingsplan, var målet at den ikke skulle bli dårligere. Vi stilte samme spørsmål i den gamle og den nye planen.»

Før klikk: «Hva tror dere skjedde?» Vent noen sekunder.

Klikk 1: «Lederne ga den gamle planen 3,8 og den nye 4,0, og andelen som ga 4 eller 5, gikk fra 66 til 77 prosent. For de sykmeldte gikk den fra 73 til 78.»

Den gamle planen ble målt i FlexJar fra oktober 2025 til mars 2026, den nye i Lumi fra februar til august 2026. Planen ble lansert for hele landet 27. april, og den datoen står som en markør i dashboardet.

Si «gikk opp», ikke at den nye er bevist bedre. Periodene er ikke de samme, og det er ikke de samme som svarte.

95 prosent av de sykmeldte kjenner seg igjen i innholdet i planen.

Poenget for salen: sett et mål for en endring, still samme spørsmål før og etter, og se på svarene.`,
  Component: Oppfolgingsplanen,
};
