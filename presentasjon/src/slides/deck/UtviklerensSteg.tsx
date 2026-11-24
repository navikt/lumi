import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, type Point } from "../../map";
import "./verksted.css";

type Tone = "team" | "lumi";

const Kw = ({ children }: { children: ReactNode }) => (
  <span className="utvikler__kw">{children}</span>
);
const Str = ({ children }: { children: ReactNode }) => (
  <span className="utvikler__str">{children}</span>
);
const P = ({ children }: { children: ReactNode }) => (
  <span className="utvikler__punct">{children}</span>
);

/** A part of the code that one of the developer's steps points at. */
const Mark = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`utvikler__mark utvikler__mark--${tone}`}>
    <span className="utvikler__marker" aria-hidden="true" />
    {children}
  </span>
);

/*
 * The code is set in Overpass Mono, where every character is 0.616 em
 * wide, so the map can find the end of a line: x = CODE_X + column * ADV.
 * The size and line height go to the CSS from here, so they stay in step.
 * The code stands midway between the title and the foot of the slide.
 */
const CODE_X = 112;
const CODE_TOP = 380;
const CODE_SIZE = 36;
const CODE_LINE = 50;
const ADV = CODE_SIZE * 0.616;
const lineY = (row: number) => CODE_TOP + (row + 0.5) * CODE_LINE;
const lineEnd = (columns: number) => CODE_X + columns * ADV;

/*
 * What the developer does, one step per marked part of the code: the
 * widget package, the survey file and the route in the app's backend.
 * Each step has a leader from the end of its line to a column on the
 * right, level with the line, in the colour of who owns the part: Lumi's
 * widget in blue, the team's code and backend in green. All there at
 * once, without clicks.
 */
const STEP_X = 1380;
const STEPS = [
  {
    row: 0,
    columns: 53,
    tone: "lumi",
    label: "Installerer pakken",
    note: "ingen skript fra en leverandør",
  },
  {
    row: 2,
    columns: 34,
    tone: "team",
    label: "Limer inn surveyen",
    note: "koden fra Surveyverksted",
  },
  {
    row: 6,
    columns: 48,
    tone: "team",
    label: "Lager ett endepunkt",
    note: "svaret går via appens backend",
  },
] as const satisfies ReadonlyArray<{
  row: number;
  columns: number;
  tone: Tone;
  label: string;
  note: string;
}>;

/** From the end of the line straight to the column. */
function leader(row: number, columns: number): Point[] {
  const y = lineY(row);
  return [
    [lineEnd(columns) + 22, y],
    [STEP_X - 24, y],
  ];
}

function UtviklerensSteg() {
  return (
    <div
      className="slide utvikler"
      style={cssVars({
        "--kode-x": `${CODE_X}px`,
        "--kode-top": `${CODE_TOP}px`,
        "--kode-size": `${CODE_SIZE}px`,
        "--kode-line": `${CODE_LINE}px`,
      })}
    >
      <h2 className="utvikler__title">Dette gjør utvikleren</h2>

      <pre className="utvikler__code">
        <code>
          <Kw>import</Kw> <P>{"{"}</P> LumiSurveyDock <P>{"}"}</P> <Kw>from</Kw>{" "}
          <Mark tone="lumi">
            <Str>"@navikt/lumi-survey"</Str>
          </Mark>
          <P>;</P>
          {"\n"}
          <span className="utvikler__comment">
            {"// survey.ts er kopiert fra Surveyverksted"}
          </span>
          {"\n"}
          <Kw>import</Kw> <P>{"{"}</P> survey <P>{"}"}</P> <Kw>from</Kw>{" "}
          <Mark tone="team">
            <Str>"./survey"</Str>
          </Mark>
          <P>;</P>
          {"\n"}
          <P>{"<"}</P>
          <Kw>LumiSurveyDock</Kw>
          {"\n  "}surveyId<P>=</P>
          <Str>"min-app-tilbakemelding"</Str>
          {"\n  "}survey<P>={"{"}</P>survey<P>{"}"}</P>
          {"\n  "}transport<P>={"{{"}</P> endpoint<P>:</P>{" "}
          <Mark tone="team">
            <Str>"/api/lumi/feedback"</Str>
          </Mark>{" "}
          <P>{"}}"}</P>
          {"\n"}
          <P>{"/>"}</P>
        </code>
      </pre>

      <LineMap
        label={`Det utvikleren gjør, pekt ut i koden. ${STEPS.map((step) => `${step.label}: ${step.note}`).join(". ")}.`}
      >
        {STEPS.map((step) => {
          const points = leader(step.row, step.columns);
          const y = lineY(step.row);
          return (
            <g
              key={step.label}
              className={`utvikler__grunn utvikler__grunn--${step.tone}`}
            >
              <circle
                cx={points[0][0]}
                cy={points[0][1]}
                r={11}
                className="utvikler__prikk"
              />
              <Line points={points} width={8} className="utvikler__leder" />
              <MapText
                x={STEP_X}
                y={y}
                size={40}
                weight={800}
                className="utvikler__grunnavn"
              >
                {step.label}
              </MapText>
              <MapText x={STEP_X} y={y + 44} size={32} weight={600} muted>
                {step.note}
              </MapText>
            </g>
          );
        })}
      </LineMap>
    </div>
  );
}

export const utviklerensSteg: Slide = {
  id: "utviklerens-steg",
  title: "Dette gjør utvikleren",
  rooms: ["frontend"],
  Component: UtviklerensSteg,
};
