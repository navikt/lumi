import type { Slide } from "../../engine";
import { Line, LineBadge, LineMap, Station } from "../../map";
import "./bevis.css";

/**
 * Three lines of the same form and weight: placement, not ranking. In the
 * order they came into use in Nav.
 */
const TOOLS = [
  { name: "FlexJar", label: "Team Flex", note: "siden 2023" },
  { name: "Skyra", label: "Uten utvikler", note: "hele nav.no" },
  { name: "Lumi", label: "I appens kode", note: "innloggede brukere" },
] as const;

const BADGE_WIDTH = 220;
/** The first badge starts at the margin, under the title. */
const FIRST_X = 112 + BADGE_WIDTH / 2;
const COLUMN_GAP = 565;
const BADGE_Y = 430;
const STATION_Y = 640;

function UlikeBehov() {
  return (
    <div className="slide">
      <h2 className="slide-title">Tre surveyverktøy i Nav</h2>
      <LineMap label="Tre verktøy med lik vekt, i den rekkefølgen de kom i bruk i Nav. FlexJar: Team Flex, siden 2023. Skyra: uten utvikler, hele nav.no. Lumi: i appens kode, innloggede brukere.">
        {TOOLS.map((tool, i) => {
          const x = FIRST_X + COLUMN_GAP * i;
          return (
            <g key={tool.name} data-from={1}>
              <Line
                points={[
                  [x, BADGE_Y],
                  [x, STATION_Y],
                ]}
              />
              <LineBadge
                x={x}
                y={BADGE_Y}
                text={tool.name}
                width={BADGE_WIDTH}
              />
              <Station
                x={x}
                y={STATION_Y}
                side="below"
                label={tool.label}
                note={tool.note}
              />
            </g>
          );
        })}
      </LineMap>
    </div>
  );
}

export const ulikeBehov: Slide = {
  id: "ulike-behov",
  title: "Tre surveyverktøy i Nav",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  notes: `Bare plassering, ingen rangering. Rekkefølgen er når de kom i bruk i Nav: FlexJar i 2023, Skyra i januar 2025, Lumi i januar 2026.

Uten utvikler, ordrett: «Skal noen publisere surveyer uten utvikler, er Skyra laget for det, og ResearchOps hjelper team med det.»`,
  Component: UlikeBehov,
};
