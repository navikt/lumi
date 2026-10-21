import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineBadge, LineMap, MapText, Station } from "../../map";
import "./premiss.css";

const Y = 600;
const MARGIN = 112;
const BADGE_WIDTH = 152;
const BADGE_X = MARGIN + BADGE_WIDTH / 2;
/** Lumi's line starts where its name badge ends. */
const LINE_START = MARGIN + BADGE_WIDTH;
const SPACING = 340;
const RING_R = 32;
/** Eight dashes round the ring, so the dashed ring closes evenly. */
const RING_SEGMENT = (2 * Math.PI * RING_R) / 8;

interface Need {
  label: string;
  side: "above" | "below";
}

const NEEDS: readonly Need[] = [
  { label: "Lik widget i alle apper", side: "above" },
  { label: "Ulike surveytyper", side: "below" },
  { label: "Analyse i dashboardet", side: "above" },
  { label: "Tilgang per team", side: "below" },
];

/** Stations at equal steps from the badge. */
function stationX(index: number): number {
  return LINE_START + SPACING * (index + 1);
}

const END_X = stationX(NEEDS.length - 1);

/** The four needs on a line that Lumi builds. Also used on the short version. */
export function NeedsLine() {
  return (
    <LineMap label="Linjekart. En stiplet linje med fire stasjoner som ikke er bygget: lik widget i alle apper, ulike surveytyper, analyse i dashboardet og tilgang per team. Så kommer Lumi, januar 2026, og linja blir heltrukket.">
      {/* The needs: a line that is not built yet. */}
      <Line
        points={[
          [MARGIN, Y],
          [END_X, Y],
        ]}
        dashed
        from={1}
      />
      {/* Lumi builds it. The line draws itself under the stations. */}
      <Line
        points={[
          [LINE_START, Y],
          [END_X, Y],
        ]}
        draw
        from={2}
      />
      <g
        className="trengte__gap"
        style={cssVars({
          "--trengte-dash": `${RING_SEGMENT * 0.6} ${RING_SEGMENT * 0.4}`,
        })}
      >
        {NEEDS.map((need, i) => (
          <Station
            key={need.label}
            x={stationX(i)}
            y={Y}
            r={RING_R}
            side={need.side}
            label={need.label}
            from={1}
          />
        ))}
      </g>

      {/* The stations fill: solid rings over the dashed ones. */}
      {NEEDS.map((need, i) => (
        <Station key={need.label} x={stationX(i)} y={Y} r={RING_R} from={2} />
      ))}
      <g data-from={2}>
        <LineBadge x={BADGE_X} y={Y} text="Lumi" width={BADGE_WIDTH} />
        <MapText x={MARGIN} y={Y + 82} weight={600} muted>
          januar 2026
        </MapText>
      </g>
    </LineMap>
  );
}

function ViTrengteMer() {
  return (
    <div className="slide">
      <h2 className="slide-title">Men vi trengte mer</h2>
      <NeedsLine />
    </div>
  );
}

export const viTrengteMer: Slide = {
  id: "vi-trengte-mer",
  title: "Men vi trengte mer",
  rooms: ["frontend", "produktledere"],
  steps: 2,
  notes: `Ordrett: «Det vi manglet, lagde vi selv, først som tillegg: en widget og et dashboard for analyse. I januar 2026 ble det et eget verktøy, med egen datamodell og tilgang per team.»

Dette var behovene våre i eSyfo.
Klikk 1: de fire behovene. Hullene på linja er behovene våre.
Klikk 2: Lumi, januar 2026. Eget verktøy.`,
  Component: ViTrengteMer,
};
