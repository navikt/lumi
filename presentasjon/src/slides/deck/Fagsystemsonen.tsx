import type { Slide } from "../../engine";
import { Answer, AppBox, Line, LineMap, Station, Zone } from "../../map";
import "./deck.css";

// The same map as «Hvor bor svaret?», so only the wall is new.
const TOP = 196;
const HEIGHT = 640;
const ZONE_WIDTH = 592;
const BROWSER_X = 72;
const NAIS_X = BROWSER_X + ZONE_WIDTH;
const VENDOR_X = NAIS_X + ZONE_WIDTH;

const VENDOR_APP_Y = 330;
const LUMI_APP_Y = 520;
const APP_X = 112;
const APP_WIDTH = 512;

const VENDOR_GATE = { x: 420, width: 120 };
const LUMI_GATE = { y: LUMI_APP_Y + 8, height: 80 };

/** A double wall around the zone, with gaps where something gets through. */
function Wall() {
  const right = BROWSER_X + ZONE_WIDTH;
  return (
    <g className="wall">
      <rect
        x={BROWSER_X}
        y={TOP}
        width={ZONE_WIDTH}
        height={HEIGHT}
        className="wall__outer"
      />
      <rect
        x={BROWSER_X}
        y={TOP}
        width={ZONE_WIDTH}
        height={HEIGHT}
        className="wall__inner"
      />
      <text x={BROWSER_X + 36} y={TOP + 66} className="map-zone__label">
        Fagsystemsonen
      </text>
      <g data-from={1}>
        <rect
          x={VENDOR_GATE.x}
          y={TOP - 18}
          width={VENDOR_GATE.width}
          height={36}
          className="wall__gap"
        />
      </g>
      <g data-from={2}>
        <rect
          x={right - 18}
          y={LUMI_GATE.y}
          width={36}
          height={LUMI_GATE.height}
          className="wall__gap"
        />
      </g>
    </g>
  );
}

function Fagsystemsonen() {
  return (
    <div className="slide">
      <LineMap label="Saksbehandlerens nettleser ligger bak en vegg, fagsystemsonen. En app med et skript fra en leverandør trenger en egen åpning ut av sonen, og svaret lagres hos leverandøren. En app med Lumi sender svaret gjennom døra appen alt har, til appens backend og Lumi API på Nais.">
        <Zone
          x={BROWSER_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="neutral"
          label="Saksbehandlerens nettleser"
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
          label="Leverandør"
          note="databehandler for Nav"
        />
        <Wall />

        <AppBox
          x={APP_X}
          y={VENDOR_APP_Y}
          width={APP_WIDTH}
          part="skript"
          partWidth={150}
        />
        <AppBox
          x={APP_X}
          y={LUMI_APP_Y}
          width={APP_WIDTH}
          part="Lumi-widget"
          partWidth={220}
        />

        <g data-from={1}>
          <Line
            points={[
              [480, VENDOR_APP_Y],
              [480, 120],
              [1400, 120],
              [1400, 640],
            ]}
            radius={56}
          />
          <Station x={1400} y={420} label="leverandørens server" />
          <Answer x={1400} y={640} r={36} />
          <Station
            x={1400}
            y={640}
            r={36}
            label="lagres der"
            className="map-station--label-only"
          />
          <text
            x={VENDOR_GATE.x + VENDOR_GATE.width + 28}
            y={TOP - 34}
            className="map-label wall__label"
          >
            egen åpning ut
          </text>
        </g>

        <g data-from={2}>
          <Line
            points={[
              [APP_X + APP_WIDTH, LUMI_APP_Y + 48],
              [760, LUMI_APP_Y + 48],
              [760, 768],
            ]}
            radius={40}
          />
          <Station
            x={760}
            y={LUMI_APP_Y + 48}
            label="appens backend"
            note="samme adresse som appen"
          />
          <Station x={760} y={668} label="Lumi API" />
          <Answer x={760} y={768} r={36} />
          <Station
            x={760}
            y={768}
            r={36}
            label="databasen"
            className="map-station--label-only"
          />
          <text
            x={NAIS_X - 40}
            y={LUMI_APP_Y - 28}
            textAnchor="end"
            className="map-label wall__label"
          >
            døra appen alt har
          </text>
        </g>
      </LineMap>

      <h2 className="slide-maptitle hvor__title">
        I fagsystemsonen trenger Lumi
        <br />
        ingen ny åpning
      </h2>
    </div>
  );
}

export const fagsystemsonen: Slide = {
  id: "fagsystemsonen",
  title: "I fagsystemsonen trenger Lumi ingen ny åpning",
  steps: 2,
  notes: `Samme kart, nå er nettleseren saksbehandlerens, bak veggen rundt fagsystemsonen.

Klikk 1: et skript fra en leverandør trenger en egen åpning ut av sonen. Skyra brukes i fagsystemer i dag, med en slik åpning.

Klikk 2: Lumi går gjennom døra appen alt har, til appens egen backend på Nais.

Ordrett: «Skyra brukes i flere fagsystemer i dag. Skal noen publisere surveyer uten utvikler, er Skyra laget for det, og ResearchOps hjelper team med det.»

Spør noen om Skyra i fagsystemer: «Skyra brukes der i dag. Poenget er at Lumi ikke trenger en egen åpning.»`,
  Component: Fagsystemsonen,
};
