import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import { AppBox, Line, LineMap, MapText, Station, Zone } from "../../map";
import { Reise } from "./KartReise";
import "./deck.css";

// The same zones as «Hvor bor svaret?». The wall is what is new.
const TOP = 196;
/** The zones end 46 px above the Teams corner, with their labels. */
const HEIGHT = 628;
const BOTTOM = TOP + HEIGHT;
const ZONE_WIDTH = 592;
const BROWSER_X = 72;
const NAIS_X = BROWSER_X + ZONE_WIDTH;
const VENDOR_X = NAIS_X + ZONE_WIDTH;

const VENDOR_APP_Y = 330;
const LUMI_APP_Y = 520;
const APP_X = 112;
const APP_WIDTH = 512;
const APP_RIGHT = APP_X + APP_WIDTH;

/** The vendor's line leaves the app and goes up through its own opening. */
const VENDOR_LINE_X = 480;
const OPENING = { from: 420, to: 540 } as const;
/** The app's own door, in the wall to Nais. */
const DOOR = { from: LUMI_APP_Y + 8, to: LUMI_APP_Y + 88 } as const;
/** Appens backend, and the vendor's server. */
const BACKEND = [760, LUMI_APP_Y + 48] as const;
const VENDOR_SERVER = [1400, 420] as const;

/*
 * The vendor's opening is closed by two halves of wall. On click 1 each half
 * slides into the wall beside it. They overlap the wall and each other by a
 * little, under it, so the closed wall has no seams.
 */
const OVERLAP = 2;
const HALVES = [
  {
    from: OPENING.from - OVERLAP,
    to: VENDOR_LINE_X + OVERLAP,
    origin: OPENING.from - OVERLAP,
  },
  {
    from: VENDOR_LINE_X - OVERLAP,
    to: OPENING.to + OVERLAP,
    origin: OPENING.to + OVERLAP,
  },
] as const;

/**
 * A double wall around the zone. It has the app's door from the start. The
 * vendor's own opening is closed until click 1, when the wall opens.
 */
function Wall({ open }: { open: boolean }) {
  const parts = [
    `M${OPENING.to} ${TOP} H${NAIS_X} V${DOOR.from}`,
    `M${NAIS_X} ${DOOR.to} V${BOTTOM} H${BROWSER_X} V${TOP} H${OPENING.from}`,
  ];
  return (
    <g className="kart-wall">
      {HALVES.map(({ from, to, origin }) => (
        <g
          key={origin}
          className={cx(
            "kart-wall__closing",
            open && "kart-wall__closing--open",
          )}
          style={{ transformOrigin: `${origin}px ${TOP}px` }}
        >
          <path d={`M${from} ${TOP} H${to}`} className="kart-wall__outer" />
          <path d={`M${from} ${TOP} H${to}`} className="kart-wall__inner" />
        </g>
      ))}
      {parts.map((d) => (
        <g key={d}>
          <path d={d} className="kart-wall__outer" />
          <path d={d} className="kart-wall__inner" />
        </g>
      ))}
      <text x={BROWSER_X + 36} y={TOP + 66} className="map-zone__label">
        Fagsystemer
      </text>
    </g>
  );
}

function Fagsystemsonen({ step }: SlideProps) {
  return (
    <div className="slide">
      <LineMap label="Saksbehandlerens nettleser ligger bak en vegg rundt fagsystemene. Appen snakker allerede med sin egen backend på Nais, gjennom døra den har. En app med et skript fra en leverandør trenger en egen åpning ut av sonen til leverandørens server, og svaret lagres der. Leverandøren er databehandler for Nav. Med Lumi følger svaret linja som allerede finnes, gjennom døra, til appens backend, Lumi API og databasen på Nais.">
        <Zone
          x={BROWSER_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="neutral"
          label="Saksbehandlerens nettleser"
          className="kart-wall__zone"
        />
        <Zone
          x={NAIS_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="nais"
          label="Navs plattform (Nais)"
          note={["gjelder apper med", "backend i prod-gcp"]}
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
        <Wall open={step >= 1} />

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
            [APP_RIGHT, BACKEND[1]],
            [BACKEND[0], BACKEND[1]],
          ]}
          dim
        />
        <Station
          x={BACKEND[0]}
          y={BACKEND[1]}
          label="Appens backend"
          note="samme adresse som appen"
        />
        <MapText
          x={APP_RIGHT}
          y={LUMI_APP_Y - 40}
          anchor="end"
          size={36}
          weight={800}
        >
          døra
        </MapText>

        {/* Click 1: the wall opens, then the answer goes out to the vendor. */}
        <Reise
          points={[
            [VENDOR_LINE_X, VENDOR_APP_Y],
            [VENDOR_LINE_X, 120],
            [VENDOR_SERVER[0], 120],
            [VENDOR_SERVER[0], 640],
          ]}
          radius={56}
          from={1}
          start={300}
          duration={1200}
        >
          <Station
            x={VENDOR_SERVER[0]}
            y={VENDOR_SERVER[1]}
            label="Leverandørens server"
          />
          <Station
            x={VENDOR_SERVER[0]}
            y={640}
            r={36}
            label="Lagres der"
            className="map-station--label-only"
          />
          {/* Left of the line and above the wall, clear of the bend. */}
          <MapText x={450} y={138} anchor="end" size={36} weight={800}>
            egen åpning ut
          </MapText>
        </Reise>

        {/* Click 2: the answer follows the line that is already there. */}
        <Reise
          points={[
            [APP_RIGHT, BACKEND[1]],
            [BACKEND[0], BACKEND[1]],
            [BACKEND[0], 768],
          ]}
          radius={18}
          from={2}
          duration={900}
        >
          <Station x={BACKEND[0]} y={BACKEND[1]} />
          <Station x={760} y={668} label="Lumi API" />
          <Station
            x={760}
            y={768}
            r={36}
            label="Databasen"
            className="map-station--label-only"
          />
        </Reise>
      </LineMap>

      <h2 className="slide-maptitle hvor__title">
        I fagsystemer går svaret
        <br />
        gjennom appens egen backend
      </h2>
    </div>
  );
}

export const fagsystemsonen: Slide = {
  id: "fagsystemsonen",
  title: "I fagsystemer går svaret gjennom appens egen backend",
  steps: 2,
  notes: `Samme kart. Nå er nettleseren saksbehandlerens, bak veggen rundt fagsystemene.

Fra start: appen snakker allerede med sin egen backend, gjennom døra den har.

Klikk 1: veggen åpnes for leverandøren, og svaret går ut og lagres der. «Skyra brukes i flere fagsystemer i dag, gjennom en åpning som er på plass.»

Klikk 2: svaret følger linja som allerede finnes, gjennom døra, til appens backend og Lumi API på Nais. FlexJar trenger heller ingen ny åpning.

Faggruppa, ordrett: «Skal noen publisere surveyer uten utvikler, er Skyra laget for det.»

Det gjelder apper med backend i prod-gcp, og det står i Nais-sonen på sliden. Fagsystemer med backend i prod-fss må avklare med oss først, for Lumi API tar bare imot kall fra prod-gcp.`,
  Component: Fagsystemsonen,
};
