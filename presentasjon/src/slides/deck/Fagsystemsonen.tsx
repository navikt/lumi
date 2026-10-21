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
/** Appens backend, and the vendor's server. */
const BACKEND: readonly [number, number] = [760, LUMI_APP_Y + 48];
const VENDOR_SERVER: readonly [number, number] = [1400, 420];
/** Arrows stop at the edge of the station ring, as on «Hvor bor svaret?». */
const RING_EDGE = 26;

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
      {/* The app's own door: there from the start, it is not new. */}
      <rect
        x={right - 18}
        y={LUMI_GATE.y}
        width={36}
        height={LUMI_GATE.height}
        className="wall__gap"
      />
    </g>
  );
}

function Fagsystemsonen() {
  return (
    <div className="slide">
      <LineMap label="Saksbehandlerens nettleser ligger bak en vegg, fagsystemsonen. Appen snakker alt med sin egen backend på Nais, gjennom døra den har. En app med et skript fra en leverandør trenger en egen åpning ut av sonen til leverandørens server, og svaret lagres der. Leverandøren er databehandler for Nav. Med Lumi følger svaret linja som alt finnes, gjennom døra, til appens backend, Lumi API og databasen på Nais.">
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

        {/* From the start: the app already talks to its backend, through its door. */}
        <Line
          points={[
            [APP_X + APP_WIDTH, BACKEND[1]],
            [BACKEND[0] - RING_EDGE, BACKEND[1]],
          ]}
          dim
        />
        <Station
          x={BACKEND[0]}
          y={BACKEND[1]}
          label="Appens backend"
          note="samme adresse som appen"
        />
        <text
          x={NAIS_X - 40}
          y={LUMI_APP_Y - 28}
          textAnchor="end"
          className="map-label wall__label"
        >
          døra appen alt har
        </text>

        <g data-from={1}>
          <Line
            points={[
              [480, VENDOR_APP_Y],
              [480, 120],
              [VENDOR_SERVER[0], 120],
              [VENDOR_SERVER[0], VENDOR_SERVER[1] - RING_EDGE],
            ]}
            radius={56}
            arrow
          />
          <Line
            points={[
              [VENDOR_SERVER[0], VENDOR_SERVER[1]],
              [VENDOR_SERVER[0], 640],
            ]}
          />
          <Station
            x={VENDOR_SERVER[0]}
            y={VENDOR_SERVER[1]}
            label="Leverandørens server"
          />
          <Answer x={1400} y={640} r={36} />
          <Station
            x={1400}
            y={640}
            r={36}
            label="Lagres der"
            className="map-station--label-only"
          />
          {/* Left of the line and above the wall, clear of the bend. */}
          <text
            x={450}
            y={150}
            textAnchor="end"
            className="map-label wall__label"
          >
            egen åpning ut
          </text>
        </g>

        {/* The answer follows the line that is already there. */}
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
          <Station x={BACKEND[0]} y={BACKEND[1]} />
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
        I fagsystemsonen bruker Lumi
        <br />
        døra appen alt har
      </h2>
    </div>
  );
}

export const fagsystemsonen: Slide = {
  id: "fagsystemsonen",
  title: "I fagsystemsonen bruker Lumi døra appen alt har",
  steps: 2,
  notes: `Samme kart, nå er nettleseren saksbehandlerens, bak veggen rundt fagsystemsonen.

Fra start: appen snakker alt med sin egen backend, gjennom døra den har.

Klikk 1: et skript fra en leverandør trenger en egen åpning ut av sonen. «Skyra brukes i flere fagsystemer i dag, gjennom en åpning som er på plass.»

Klikk 2: svaret følger linja som alt finnes, gjennom døra, til appens backend og Lumi API på Nais. FlexJar trenger heller ingen ny åpning.

Ordrett: «Skal noen publisere surveyer uten utvikler, er Skyra laget for det, og ResearchOps hjelper team med det.»

Det gjelder apper med backend i prod-gcp. Fagsystemer med backend i prod-fss må avklare med oss først.`,
  Component: Fagsystemsonen,
};
