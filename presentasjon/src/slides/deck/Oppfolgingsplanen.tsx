import type { Slide } from "../../engine";
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
    before: "66 %",
    after: "77 %",
    detail: "Snitt 3,8 og 4,0. 9 523 og 1 757 svar.",
    y: 500,
  },
  {
    who: "Sykmeldte",
    question: "«Er oppfølgingsplanen til hjelp for deg?»",
    before: "73 %",
    after: "78 %",
    detail: "Snitt 4,0 og 4,1. 13 319 og 3 033 svar.",
    y: 760,
  },
] as const;

const LEFT = 112;
const OLD_X = 1000;
const NEW_X = 1400;
/** The values sit above the stations, the plan names below. */
const VALUE_ABOVE = 78;
const NAME_BELOW = 62;

function Oppfolgingsplanen() {
  return (
    <div className="slide">
      <h2 className="slide-title">
        Målet var at den nye oppfølgingsplanen ikke skulle bli dårligere
      </h2>
      <LineMap label="To rader med andelen som svarte 4 eller 5 av 5, i den gamle og den nye oppfølgingsplanen. Ledere, «Hvordan var det å bruke oppfølgingsplanen?»: 66 prosent i den gamle, 77 prosent i den nye. Snitt 3,8 og 4,0, med 9 523 og 1 757 svar. Sykmeldte, «Er oppfølgingsplanen til hjelp for deg?»: 73 prosent i den gamle, 78 prosent i den nye. Snitt 4,0 og 4,1, med 13 319 og 3 033 svar. Samme spørsmål i gammel og ny plan.">
        {ROWS.map((row) => (
          <g key={row.who}>
            <MapText x={LEFT} y={row.y - 34} size={44} weight={800}>
              {row.who}
            </MapText>
            <MapText x={LEFT} y={row.y + 20} size={32} weight={600} muted>
              {row.question}
            </MapText>
            <MapText
              x={OLD_X}
              y={row.y - VALUE_ABOVE}
              anchor="middle"
              size={72}
              weight={800}
              muted
            >
              {row.before}
            </MapText>
            <Station x={OLD_X} y={row.y} dim />
            <MapText
              x={OLD_X}
              y={row.y + NAME_BELOW}
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
                  [OLD_X + 22, row.y],
                  [NEW_X - 22, row.y],
                ]}
                arrow
              />
              <MapText
                x={NEW_X}
                y={row.y - VALUE_ABOVE}
                anchor="middle"
                size={72}
                weight={800}
              >
                {row.after}
              </MapText>
              <Station x={NEW_X} y={row.y} />
              <MapText
                x={NEW_X}
                y={row.y + NAME_BELOW}
                anchor="middle"
                size={32}
                weight={600}
              >
                ny plan
              </MapText>
              <MapText x={LEFT} y={row.y + 70} size={32} weight={500} muted>
                {row.detail}
              </MapText>
            </g>
          </g>
        ))}
        <MapText x={LEFT} y={960} size={32} weight={600} from={1}>
          Andelen som svarte 4 eller 5. Samme spørsmål i gammel og ny plan.
        </MapText>
      </LineMap>
    </div>
  );
}

export const oppfolgingsplanen: Slide = {
  id: "oppfolgingsplanen",
  title: "Målet var at den nye oppfølgingsplanen ikke skulle bli dårligere",
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
