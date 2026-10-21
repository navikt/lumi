import type { Slide } from "../../engine";
import { Line, LineBadge, LineMap, MapText, Station } from "../../map";
import "./bevis.css";

/**
 * Three lines of the same form and weight: placement, not ranking. In the
 * order they came into use in Nav.
 */
const TOOLS = [
  { name: "FlexJar", label: "I appens kode", note: "flere team, siden 2023" },
  { name: "Skyra", label: "Uten utvikler", note: "hele nav.no og fagsystemer" },
  { name: "Lumi", label: "I appens kode", note: "krever innlogging" },
] as const;

const BADGE_WIDTH = 220;
/*
 * Spread over the whole width: the widest label on each side, «Team Flex,
 * siden 2023» (332 px) and «innloggede brukere» (286 px), ends at the page
 * margin. The labels stop above the Teams corner.
 */
const FIRST_X = 280;
const COLUMN_GAP = 692;
const BADGE_Y = 430;
const STATION_Y = 640;

function UlikeBehov() {
  return (
    <div className="slide">
      <h2 className="slide-title">Tre surveyverktøy i Nav</h2>
      <LineMap label="Tre verktøy med lik vekt, i den rekkefølgen de kom i bruk i Nav. FlexJar: i appens kode, flere team, siden 2023. Skyra: uten utvikler, hele nav.no og fagsystemer. Lumi: i appens kode, krever innlogging. Under: teamet velger hvem som lager surveyen, og hvor svaret skal bo.">
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
        <MapText x={112} y={900} size={44} weight={800} from={1}>
          Teamet velger: hvem lager surveyen, og hvor skal svaret bo?
        </MapText>
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

Uten utvikler, ordrett: «Skal noen publisere surveyer uten utvikler, er Skyra laget for det, og ResearchOps hjelper team med det.»

Hvem dere spør: Team Flex om FlexJar, ResearchOps om Skyra og #lumi om Lumi.

Oppsettet vi dokumenterer, krever innlogget bruker, fordi appens backend veksler brukerens token.`,
  Component: UlikeBehov,
};
