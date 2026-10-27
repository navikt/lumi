import { useId } from "react";
import type { Slide, SlideProps } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, Station } from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/*
 * What every team can take out today, the export formats from the
 * dashboard, as three badges in Lumi's blue: what Lumi gives. Under them
 * two lines in the team's green, as in the key of a line map: solid for
 * what is in use, dashed for what is on the way. On click 1 the dashed line
 * is laid, dash by dash. All of it ends left of x 1520 below y 800, clear
 * of the Teams corner.
 */
const FORMATS = ["CSV", "Excel", "JSON"] as const;

const KEY_FROM = 112;
/* Seven whole dashes (30, gap 24) end at the ring's left edge. */
const DASHES = 7;
const DASH_PITCH = 54;
const RING = 26;
const KEY_TO = KEY_FROM + DASHES * DASH_PITCH - 24 + RING;
const LABEL_X = KEY_TO + RING + 32;
const STORY_Y = 668;
const BIGQUERY_Y = 796;

function BrukesVidere({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  // A clip id per instance: the overview and the print view show the slide twice.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className="slide eksport" data-motion={motion ? "" : undefined}>
      <h2 className="eksport__title">Svarene kan tas ut til analyse</h2>
      <ul className="eksport__formats" aria-label="CSV, Excel og JSON">
        {FORMATS.map((format, i) => (
          <li
            key={format}
            className="eksport__format"
            style={cssVars({ "--i": i })}
          >
            {format}
          </li>
        ))}
      </ul>
      <p className="eksport__where">Eksport fra dashboardet</p>
      <LineMap label="Under eksporten to grønne linjer, for det teamene gjør med svarene. Heltrukket: iSyfos datafortelling, som finnes. Stiplet: BigQuery i teamets eget prosjekt, som kommer, først for eSyfo og iSyfo og uten fritekst.">
        <g className="eksport__line">
          <Line
            points={[
              [KEY_FROM + 10, STORY_Y],
              [KEY_TO, STORY_Y],
            ]}
          />
          <Station x={KEY_TO} y={STORY_Y} r={RING} />
          <MapText x={LABEL_X} y={STORY_Y + 2} size={48} weight={800}>
            iSyfos datafortelling
          </MapText>
        </g>

        <g className="eksport__line eksport__line--coming" data-from={1}>
          {/* The clip that lays the dashes, inside the group that is revealed. */}
          <defs>
            <clipPath id={`${id}-lay`}>
              <rect
                className="eksport__lay"
                x={KEY_FROM}
                y={BIGQUERY_Y - 30}
                width={DASHES * DASH_PITCH}
                height={60}
              />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-lay)`}>
            <Line
              points={[
                [KEY_FROM, BIGQUERY_Y],
                [KEY_TO, BIGQUERY_Y],
              ]}
              dashed
            />
          </g>
          <Station x={KEY_TO} y={BIGQUERY_Y} r={RING} />
          <MapText x={LABEL_X} y={BIGQUERY_Y + 2} size={48} weight={800}>
            BigQuery i teamets eget prosjekt
          </MapText>
          <MapText x={LABEL_X} y={BIGQUERY_Y + 58} size={36} weight={600} muted>
            kommer, først for eSyfo og iSyfo, uten fritekst
          </MapText>
        </g>
      </LineMap>
    </div>
  );
}

export const brukesVidere: Slide = {
  id: "brukes-videre",
  title: "Svarene kan tas ut til analyse",
  steps: 1,
  // In faggruppa the export is one sentence on «Dere ser bare svarene …».
  rooms: ["frontend", "produktledere"],
  Component: BrukesVidere,
};
