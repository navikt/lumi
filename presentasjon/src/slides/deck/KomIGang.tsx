import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { Snokula } from "./snokula/Snokula";
import "./avslutning.css";

/*
 * How to start, on one slide, all there at once: the speaker talks through
 * it without clicking. The chapter's name over the three steps on the
 * left, and the globe on the right, smaller and calm, as on the cover,
 * with the answer home in Lumi's crystal. The steps stand on a line from
 * the top down: read «Kom i gang» and the terms of use, where the docs
 * are, ask for access for the app, and make the survey in Surveyverksted,
 * which anyone on the team can do while they wait. Each station is the
 * colour of who does it: the team's green, and Lumi's blue for access,
 * the one step where the team waits, marked with an hourglass. Source:
 * «Hva er Lumi?», «Koble til backend» and «Bruksvilkår» in the docs.
 */

const LINE_X = 184;
const STEP_Y = [384, 574, 764] as const;
const STATION_R = 56;

/** The globe, right of the steps and clear above the Teams corner. */
const KAMERA = "translate(984px, 124px) scale(0.62)";

const STEPS = [
  {
    label: "Les «Kom i gang» og bruksvilkårene",
    note: "navikt.github.io/lumi",
    tone: "team",
    address: true,
  },
  {
    label: "Be om tilgang for appen deres",
    note: "En issue eller en PR i navikt/lumi.",
    tone: "lumi",
    waits: true,
  },
  {
    label: "Lag surveyen i Surveyverksted",
    note: "Alle på teamet kan, også mens dere venter. Utvikleren legger den inn i appen.",
    tone: "team",
  },
] as const;

/** Waiting: an hourglass, in Lumi's blue, turned so the sand runs. */
function Timeglass() {
  return (
    <svg
      className="kom-i-gang__timeglass"
      viewBox="0 0 40 56"
      aria-hidden="true"
    >
      <path
        d="M5 4 H35 M5 52 H35 M10 4 C10 18 18 22 18 28 C18 34 10 38 10 52 M30 4 C30 18 22 22 22 28 C22 34 30 38 30 52"
        className="kom-i-gang__glass"
      />
      <path d="M13 50 Q20 39 27 50 Z M15 12 H25 L20 19 Z" />
    </svg>
  );
}

function KomIGang({ active }: SlideProps) {
  return (
    <Snokula
      scene="k"
      step={0}
      active={active}
      kamera={KAMERA}
      rolig
      label="Snøkula til høyre, rolig, med svaret i kjernen av krystallen."
    >
      <h2 className="snokula__kapittel">Slik kommer dere i gang</h2>
      <div className="kom-i-gang">
        <svg
          className="kom-i-gang__linje"
          viewBox="0 0 1920 1080"
          aria-hidden="true"
        >
          <path
            d={`M${LINE_X} ${STEP_Y[0]} V${STEP_Y[STEP_Y.length - 1]}`}
            className="kom-i-gang__vei"
          />
          {STEPS.map((s, i) => (
            <g
              key={s.label}
              className={`kom-i-gang__stasjon kom-i-gang__stasjon--${s.tone}`}
            >
              <circle cx={LINE_X} cy={STEP_Y[i]} r={STATION_R} />
              <text
                x={LINE_X}
                y={STEP_Y[i] + 4}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        <ol className="kom-i-gang__steg">
          {STEPS.map((s, i) => (
            <li
              key={s.label}
              className={`kom-i-gang__punkt kom-i-gang__punkt--${s.tone}`}
              style={cssVars({ "--y": `${STEP_Y[i]}px` })}
            >
              <span className="kom-i-gang__navn">
                {s.label}
                {"waits" in s && <Timeglass />}
              </span>
              <span
                className={cx("kom-i-gang__note", "address" in s && "end-mono")}
              >
                {s.note}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Snokula>
  );
}

export const komIGang: Slide = {
  id: "kom-i-gang",
  title: "Slik kommer dere i gang",
  Component: KomIGang,
};
