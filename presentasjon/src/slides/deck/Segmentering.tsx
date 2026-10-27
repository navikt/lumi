import { useLayoutEffect, useState } from "react";
import film from "../../assets/video/segmentering-filter.mp4";
import poster from "../../assets/video/segmentering-filter.webp";
import { SlideVideo } from "../../components/SlideVideo";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { LineMap } from "../../map";
import "./segmentering.css";

/*
 * The app sends its own data with the answer, as tags, and the dashboard
 * splits the answers on them.
 *
 * Step 0: the line in the app, large, and an answer from a user with the
 * tag it gets: when the slide opens, the "A" drops from the code into the
 * tag. Step 1: the line moves up under the title, and a recording of the
 * mock dashboard plays (light theme, test data). It is two windows on the
 * same page, 1120 × 744 at its own size, so the UI text is about 28 px on
 * the stage: the top of the dashboard (336 px) and, 40 px under it, the
 * Segmentering card further down the page (368 px), with the tag
 * «Opptak med testdata» under it. Step 2: what else an app can send, on a
 * board beside the film, each value on a tag like the one on step 0.
 */

/** Shown on step 0 only. */
function onlyAtStart(step: number) {
  return {
    "data-reveal": "",
    "data-revealed": step === 0 ? "" : undefined,
  };
}

/*
 * Where the "A" is in the large line on step 0: column 28 of the code, in
 * Overpass Mono at 32 px (0.616 em a character), scaled 2.25 from x 112.
 */
const A_X = 112 + 28.5 * 32 * 0.616 * 2.25;
const TAG_Y = 674;
const TAG_HALF = 44;
const ANSWER_X = A_X - 170;

function Segmentering({ step, active }: SlideProps) {
  // Opened at the first step, the "A" drops into the tag. Opened from the
  // slide after, or stepped back to, the tag simply has it.
  const [entre, setEntre] = useState(false);
  useLayoutEffect(() => {
    if (!active) setEntre(false);
    else if (step === 0) setEntre(true);
  }, [active, step]);

  return (
    <div
      className="slide segmentering"
      data-start={step === 0 ? "" : undefined}
      data-entre={entre ? "" : undefined}
    >
      <h2 className="segmentering__title">
        Send med egne data, <span data-from={1}>og se svarene per gruppe</span>
      </h2>

      <p className="segmentering__kode">
        <code>
          <span className="segmentering__tegn">{"context={{ tags: { "}</span>
          <strong className="segmentering__nokkel">abTest</strong>
          <span className="segmentering__tegn">{": "}</span>
          <strong className="segmentering__verdi">"A"</strong>
          <span className="segmentering__tegn">{" } }}"}</span>
        </code>
      </p>
      <p className="segmentering__hvor" {...onlyAtStart(step)}>
        på widgeten i appen
      </p>

      {/* The answer and its tag, on step 0 only. */}
      <div className="segmentering__merke" {...onlyAtStart(step)}>
        <LineMap label="Et svar fra en bruker, en gul skive med øyne, har fått en lapp med A, verdien fra koden.">
          <path
            d={`M${A_X} 510 V${TAG_Y - TAG_HALF - 12}`}
            className="segmentering__dryss"
          />
          <path
            d={`M${ANSWER_X + 46} ${TAG_Y} H${A_X - TAG_HALF}`}
            className="segmentering__snor"
          />
          <rect
            x={A_X - TAG_HALF}
            y={TAG_Y - TAG_HALF}
            width={TAG_HALF * 2}
            height={TAG_HALF * 2}
            rx={16}
            className="segmentering__lapp"
          />
          <text
            x={A_X}
            y={TAG_Y + 4}
            textAnchor="middle"
            dominantBaseline="middle"
            className="segmentering__lappverdi"
          >
            A
          </text>
          <g transform={`translate(${ANSWER_X} ${TAG_Y})`}>
            <circle r={46} className="segmentering__gull" />
            <ellipse
              cx={-6}
              cy={-12}
              rx={6}
              ry={8.6}
              className="segmentering__oye"
            />
            <ellipse
              cx={20}
              cy={-12}
              rx={6}
              ry={8.6}
              className="segmentering__oye"
            />
          </g>
        </LineMap>
      </div>

      <div className="segmentering__film" data-from={1}>
        <SlideVideo
          src={film}
          poster={poster}
          width={1120}
          height={744}
          playFrom={1}
          className="segmentering__video"
          label="Opptak fra dashboardet med testdata, i to utsnitt av samme side. Øverst Tilbakemeldinger 67 og Snitt vurdering 3,5. Lenger ned kortet Segmentering med Ab Test: B 34 og A 33. Et klikk på B gir filteret Ab Test: B, 34 tilbakemeldinger og snittet 3,1. Filteret fjernes, og et klikk på A gir 33 tilbakemeldinger og snittet 3,9."
        />
      </div>
      <div className="segmentering__tag" data-from={1}>
        <Tag kind="film" />
      </div>

      <dl className="segmentering__tavle" data-from={2}>
        <div className="segmentering__rad">
          <dt>Rolle</dt>
          <dd>
            <code>arbeidsgiver</code>
          </dd>
        </div>
        <div className="segmentering__rad">
          <dt>Steg</dt>
          <dd>
            <code>kvittering</code>
          </dd>
        </div>
        <div className="segmentering__rad segmentering__rad--her">
          <dt>A/B-test</dt>
          <dd>
            <code>A</code> eller <code>B</code>
          </dd>
        </div>
        <div className="segmentering__rad segmentering__rad--selv">
          <dt>Enhetstype</dt>
          <dd>mobil eller PC, samler widgeten selv</dd>
        </div>
      </dl>
      <p className="segmentering__personvern" data-from={2}>
        <span>Verdier med få varianter.</span>{" "}
        <span>Aldri person- eller saksnummer.</span>
      </p>
    </div>
  );
}

export const segmentering: Slide = {
  id: "segmentering",
  title: "Send med egne data, og se svarene per gruppe",
  steps: 2,
  Component: Segmentering,
};
