import type { Slide } from "../../engine";
import { Answer, AppBox, Line, LineMap, MapText, Zone } from "../../map";
import "./premiss.css";

/** The line from the app to the answer on Nais. */
const Y = 520;
const APP_X = 112;
const APP_WIDTH = 560;
const APP_HALF_HEIGHT = 48;
const ZONE_X = 880;
const ZONE_TOP = 360;
const ZONE_WIDTH = 600;
const ZONE_HEIGHT = 340;
const ZONE_INSET = 36;
const ANSWER_R = 48;
const ANSWER_X = ZONE_X + ZONE_INSET + ANSWER_R;
/** Both captions sit on one line: under the app and under the answer. */
const CAPTION_Y = Y + APP_HALF_HEIGHT + 72;

function Flexjar() {
  return (
    <div className="slide">
      <h2 className="slide-title">Grunntanken i FlexJar er god</h2>
      <LineMap label="Et lite kart. Til venstre appen, med surveyen i koden. En linje går fra appen til et svar i sonen for Navs plattform (Nais): svarene blir på Nais.">
        <g data-from={1}>
          <AppBox
            x={APP_X}
            y={Y - APP_HALF_HEIGHT}
            width={APP_WIDTH}
            part="{ survey }"
            partWidth={236}
            className="flexjar__app"
          />
          <MapText x={APP_X} y={CAPTION_Y} size={44} weight={800}>
            Surveyen i koden
          </MapText>
        </g>

        <g data-from={2}>
          <Zone
            x={ZONE_X}
            y={ZONE_TOP}
            width={ZONE_WIDTH}
            height={ZONE_HEIGHT}
            tone="nais"
            label="Navs plattform (Nais)"
            labelAt="top"
          />
          <Line
            points={[
              [APP_X + APP_WIDTH, Y],
              [ANSWER_X, Y],
            ]}
          />
          <Answer x={ANSWER_X} y={Y} r={ANSWER_R} />
          <MapText x={ZONE_X + ZONE_INSET} y={CAPTION_Y} size={44} weight={800}>
            Svarene blir på Nais
          </MapText>
        </g>

        <MapText x={APP_X} y={840} size={52} weight={800} from={3}>
          Takk til Team Flex
        </MapText>
      </LineMap>
    </div>
  );
}

export const flexjar: Slide = {
  id: "flexjar",
  title: "Grunntanken i FlexJar er god",
  rooms: ["frontend", "produktledere"],
  steps: 3,
  notes: `Ordrett: «Vi startet med FlexJar fra Team Flex, fordi grunntanken er god: surveyen i koden og svarene internt.»

Klikk 1: surveyen i koden. Klikk 2: svarene blir på Nais. Klikk 3: takk til Team Flex.

Team Flex har laget og driftet FlexJar siden 2023.`,
  Component: Flexjar,
};
