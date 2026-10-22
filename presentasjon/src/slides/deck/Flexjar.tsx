import type { Slide } from "../../engine";
import { Answer, AppBox, Line, LineMap, MapText, Zone } from "../../map";
import "./premiss.css";

/*
 * A zone map: the app on the dark ground to the left, and Nais, the one
 * coloured zone, running off the top and right edges. The zone ends above
 * y 800, so the Teams corner stays free.
 */
const ROW_Y = 410;
const APP_X = 112;
const APP_WIDTH = 560;
const APP_HALF_HEIGHT = 48;
const ZONE_X = 880;
const ZONE_TOP = -20;
const ZONE_BOTTOM = 720;
const ZONE_INSET = 36;
const ANSWER_R = 48;
const ANSWER_X = ZONE_X + ZONE_INSET + ANSWER_R;
/** Both captions sit on one line: under the app and under the answer. */
const CAPTION_Y = ROW_Y + APP_HALF_HEIGHT + 72;
/** The zone runs off the edge, so its name sits lower than the top. */
const ZONE_LABEL_Y = 132;

function Flexjar() {
  return (
    <div className="slide">
      <LineMap label="Et kart. Til venstre appen, med surveyen i koden. Til høyre sonen for Navs plattform (Nais), samme plattform som resten av Navs apper. En linje går fra appen inn i sonen, der svaret lyser: svarene blir på Nais.">
        <Zone
          x={ZONE_X}
          y={ZONE_TOP}
          width={1920 - ZONE_X + 40}
          height={ZONE_BOTTOM - ZONE_TOP}
          tone="nais"
          label=""
        />
        <MapText x={ZONE_X + ZONE_INSET} y={ZONE_LABEL_Y} weight={800}>
          Navs plattform (Nais)
        </MapText>
        <MapText
          x={ZONE_X + ZONE_INSET}
          y={ZONE_LABEL_Y + 44}
          size={32}
          weight={600}
          muted
        >
          samme plattform som resten av Navs apper
        </MapText>

        <AppBox
          x={APP_X}
          y={ROW_Y - APP_HALF_HEIGHT}
          width={APP_WIDTH}
          part="{ survey }"
          partWidth={236}
          className="flexjar__app"
        />
        <MapText x={APP_X} y={CAPTION_Y} size={44} weight={800}>
          Surveyen i koden
        </MapText>

        <Line
          points={[
            [APP_X + APP_WIDTH, ROW_Y],
            [ANSWER_X, ROW_Y],
          ]}
          draw
          from={1}
          className="flexjar__line"
        />
        <g className="flexjar__landing">
          <Answer x={ANSWER_X} y={ROW_Y} r={ANSWER_R} flash from={1} />
        </g>
        <MapText
          x={ZONE_X + ZONE_INSET}
          y={CAPTION_Y}
          size={44}
          weight={800}
          from={1}
          className="flexjar__caption"
        >
          Svarene blir på Nais
        </MapText>
      </LineMap>

      <div className="flexjar__titleblock">
        <h2 className="flexjar__title">Grunntanken i FlexJar er god</h2>
        <p className="flexjar__thanks">
          Takk til Team Flex, som tok imot svarene våre fra 2024 av
        </p>
      </div>
    </div>
  );
}

export const flexjar: Slide = {
  id: "flexjar",
  title: "Grunntanken i FlexJar er god",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  notes: `Ordrett: «Vi startet med FlexJar fra Team Flex, fordi surveyen ligger i koden og svarene blir på Nais.»

Klikk 1: linja tegnes inn i Nais, og svaret lyser. Ordrett: «Nais er plattformen resten av Navs apper kjører på. Der blir svarene.»

Ordrett: «Takk til Team Flex, som tok imot svarene våre fra 2024 av.»

FlexJar har tatt imot svar for flere team siden 2023, og brukes fortsatt.`,
  Component: Flexjar,
};
