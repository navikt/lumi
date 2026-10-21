import type { Slide, SlideProps } from "../../engine";
import { Answer, AppBox, Line, LineMap, Station, Zone } from "../../map";
import "./deck.css";

const TOP = 196;
const HEIGHT = 640;
const ZONE_WIDTH = 592;
const BROWSER_X = 72;
const NAIS_X = BROWSER_X + ZONE_WIDTH;
const VENDOR_X = NAIS_X + ZONE_WIDTH;

const SKYRA_APP_Y = 330;
const LUMI_APP_Y = 520;
const APP_X = 112;
const APP_WIDTH = 512;
/** The script line, far enough in for «etter samtykke» to start at the zone label. */
const SCRIPT_X = 400;
/** Appens backend, on the Lumi line. */
const BACKEND: readonly [number, number] = [760, LUMI_APP_Y + 48];
/** Arrows stop at the edge of the station ring, as on the Skyra line. */
const RING_EDGE = 26;

/** The consent switch on the line that loads the vendor's script. */
function ConsentSwitch({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x - 46}
        y={y - 26}
        width={92}
        height={52}
        rx={26}
        className="map-switch__track"
      />
      <circle cx={x + 20} cy={y} r={15} className="map-switch__knob" />
      <text
        x={x - 70}
        y={y + 2}
        textAnchor="end"
        dominantBaseline="middle"
        className="map-note"
      >
        etter samtykke
      </text>
    </g>
  );
}

function HvorBorSvaret({ step }: SlideProps) {
  return (
    <div className="slide">
      <LineMap label="Tre soner: brukerens nettleser, Navs plattform Nais og Skyra AS. Med Skyra hentes et skript fra survey.skyra.no etter samtykke, og svaret går fra nettleseren til Skyras server og lagres hos Skyra AS i EU. Med Lumi går svaret fra nettleseren til appens backend, videre til Lumi API og databasen på Nais.">
        <Zone
          x={BROWSER_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="neutral"
          label="Brukerens nettleser"
        />
        <Zone
          x={NAIS_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="nais"
          label="Navs plattform (Nais)"
          note={["samme plattform som", "resten av Navs apper"]}
          labelAt="top"
        />
        <Zone
          x={VENDOR_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="neutral"
          label="Skyra AS"
          note="databehandler for Nav"
        />

        <AppBox
          x={APP_X}
          y={SKYRA_APP_Y}
          width={APP_WIDTH}
          part="Skyra-skript"
          partWidth={236}
        />
        <AppBox
          x={APP_X}
          y={LUMI_APP_Y}
          width={APP_WIDTH}
          part="Lumi-widget"
          partWidth={220}
        />

        {/* Skyra: the script comes in, the answer goes out over Nav's zone. */}
        <g data-from={1}>
          <Line
            points={[
              [1440, 330],
              [1440, 96],
              [SCRIPT_X, 96],
              [SCRIPT_X, SKYRA_APP_Y],
            ]}
            radius={56}
            arrow
          />
          <ConsentSwitch x={SCRIPT_X} y={250} />
          <Station x={1440} y={330} label="survey.skyra.no" mono side="right" />
          <Line
            points={[
              [1360, 500],
              [1360, 640],
            ]}
          />
          <Line
            points={[
              [520, SKYRA_APP_Y],
              [520, 150],
              [1360, 150],
              [1360, 474],
            ]}
            radius={56}
            arrow
          />
          <Station x={1360} y={500} label="Skyras server" side="right" />
          <Answer x={1360} y={640} r={36} />
          <Station
            x={1360}
            y={640}
            r={36}
            label="Lagres hos Skyra AS"
            note="Scaleway i EU"
            className="map-station--label-only"
          />
        </g>

        {/* Lumi: the answer goes the way the app's own data goes. */}
        <g data-from={2}>
          <Line
            points={[
              [APP_X + APP_WIDTH, BACKEND[1]],
              [BACKEND[0] - RING_EDGE, BACKEND[1]],
            ]}
            arrow
          />
          <Line
            points={[
              [BACKEND[0], BACKEND[1]],
              [BACKEND[0], 768],
            ]}
          />
          <Station
            x={BACKEND[0]}
            y={BACKEND[1]}
            label="Appens backend"
            note="samme adresse som appen"
          />
          <Station x={760} y={668} label="Lumi API" />
          <Answer x={760} y={768} r={36} />
          <Station
            x={760}
            y={768}
            r={36}
            label="Databasen"
            className="map-station--label-only"
          />
        </g>
      </LineMap>

      <h2 className="slide-maptitle hvor__title">
        {step >= 3 ? (
          <>
            Begge brukes i Nav.
            <br />
            Forskjellen er hvor svaret bor.
          </>
        ) : (
          "Hvor bor svaret?"
        )}
      </h2>
    </div>
  );
}

export const hvorBorSvaret: Slide = {
  id: "hvor-bor-svaret",
  title: "Hvor bor svaret?",
  steps: 3,
  notes: `Bare veiene, ingen vurdering.

Frontend forum, ordrett: «Da svarer jeg på spørsmålet fra starten. Nei, vi sammenlignet ikke funksjonene. Vi startet med et annet spørsmål: hvor skal svarene ligge?»

Klikk 1, Skyra: skriptet hentes fra Skyra etter samtykke. Svaret går rett fra nettleseren til Skyra AS og lagres i EU.

Klikk 2, Lumi: svaret går via appens backend til Lumi API og databasen. Lumi legger ikke til en ny leverandør.

Klikk 3: «Begge brukes i Nav. Forskjellen er hvor svaret bor.»

Google Cloud-spørsmålet: «Nais kjører i Google Cloud, og det gjelder alle Nais-appene. Lumi ligger der resten av Nav ligger, med samme sikkerhetsmodell.»`,
  Component: HvorBorSvaret,
};
