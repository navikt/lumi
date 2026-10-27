import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, type Point, Station } from "../../map";
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

/**
 * A part of the code that one of the reasons points at, marked on click 1.
 * `index` is the reason's place in the cascade.
 */
const Mark = ({
  tone,
  index,
  children,
}: {
  tone: Tone;
  index: number;
  children: ReactNode;
}) => (
  <span className={`utvikler__mark utvikler__mark--${tone}`}>
    <span
      className="utvikler__marker"
      style={cssVars({ "--grunn": index })}
      data-from={1}
      aria-hidden="true"
    />
    {children}
  </span>
);

/*
 * The code is set in Overpass Mono, where every character is 0.616 em
 * wide, so the map can find the end of a line: x = CODE_X + column * ADV.
 * The size and line height go to the CSS from here, so they stay in step.
 */
const CODE_X = 112;
const CODE_TOP = 196;
const CODE_SIZE = 34;
const CODE_LINE = 46;
const ADV = CODE_SIZE * 0.616;
const lineY = (row: number) => CODE_TOP + (row + 0.5) * CODE_LINE;
const lineEnd = (columns: number) => CODE_X + columns * ADV;

/*
 * Why the survey as code is good, one reason per marked part of the code:
 * the widget package, the survey file and the route in the app's backend.
 * Each reason has a leader from the end of its line to a column on the
 * right, in the colour of who owns the part: Lumi's widget in blue, the
 * team's code and backend in green.
 */
const REASON_X = 1320;
const REASONS = [
  {
    row: 0,
    columns: 53,
    labelY: lineY(0),
    tone: "lumi",
    label: "Bygd inn, låst versjon",
    note: ["ingen skript fra en leverandør", "og ingen ny kilde i CSP"],
  },
  {
    row: 2,
    columns: 34,
    labelY: lineY(2) + 50,
    tone: "team",
    label: "I appens kode",
    note: ["samme review og versjon", "som resten av appen"],
  },
  {
    row: 6,
    columns: 48,
    labelY: lineY(6),
    tone: "team",
    label: "Appens egen backend",
    note: ["svaret går gjennom den"],
  },
] as const satisfies ReadonlyArray<{
  row: number;
  columns: number;
  labelY: number;
  tone: Tone;
  label: string;
  note: readonly string[];
}>;

/** From the end of the line to the column, bending down where it must. */
function leader(row: number, columns: number, labelY: number): Point[] {
  const startX = lineEnd(columns) + 22;
  const y = lineY(row);
  const endX = REASON_X - 24;
  if (labelY === y) {
    return [
      [startX, y],
      [endX, y],
    ];
  }
  const drop = labelY - y;
  const bendX = endX - 24 - drop;
  return [
    [startX, y],
    [bendX, y],
    [bendX + drop, labelY],
    [endX, labelY],
  ];
}

/**
 * The developer's work as a line from edge to edge, in the order the guide
 * «Koble til backend» gives it: access first, since it is the only step
 * where the team waits for others, asked for with an issue in navikt/lumi.
 * Labels and notes sit above the line, so nothing reaches the Teams corner.
 */
const LINE_Y = 776;
const STOP_X = [150, 590, 1030, 1470] as const;
const LABEL_Y = LINE_Y - 150;
/**
 * The developer's steps. Access to Lumi API is the one the team waits on,
 * in Lumi's blue. The rest is the team's own work, in the team's green.
 */
const STOPS = [
  {
    label: "Tilgang til Lumi API",
    note: ["en issue i navikt/lumi"],
    tone: "lumi",
  },
  {
    label: "Pakken",
    note: ["React 18 eller nyere,", "Aksel 8 eller nyere"],
    tone: "team",
  },
  {
    label: "Endepunktet",
    note: ["i backend, veksler token", "og sender svaret videre"],
    tone: "team",
  },
  { label: "Miljøvariablene", note: ["tre verdier i Nais"], tone: "team" },
] as const;

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
          <Mark tone="lumi" index={0}>
            <Str>"@navikt/lumi-survey"</Str>
          </Mark>
          <P>;</P>
          {"\n"}
          <span className="utvikler__comment">
            {"// survey.ts er kopiert fra Surveyverksted"}
          </span>
          {"\n"}
          <Kw>import</Kw> <P>{"{"}</P> survey <P>{"}"}</P> <Kw>from</Kw>{" "}
          <Mark tone="team" index={1}>
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
          <Mark tone="team" index={2}>
            <Str>"/api/lumi/feedback"</Str>
          </Mark>{" "}
          <P>{"}}"}</P>
          {"\n"}
          <P>{"/>"}</P>
        </code>
      </pre>

      <LineMap label="Hvorfor surveyen som kode er lurt, pekt ut i koden. Pakken @navikt/lumi-survey: widgeten er bygd inn i en låst versjon, uten skript fra en leverandør og uten ny kilde i CSP. Filen survey.ts: surveyen ligger i appens kode og går gjennom samme review og versjon som resten av appen. Stien /api/lumi/feedback: svaret går gjennom appens egen backend. Så det utvikleren gjør, i rekkefølge: tilgang til Lumi API, som dere ber om i en issue i navikt/lumi. Pakken, som krever React 18 eller nyere og Aksel 8 eller nyere. Endepunktet i backend, som veksler token og sender svaret videre. Miljøvariablene, tre verdier i Nais.">
        {/* Click 1: why. A leader from each marked line to its reason. */}
        {REASONS.map((reason, index) => {
          const points = leader(reason.row, reason.columns, reason.labelY);
          return (
            <g
              key={reason.label}
              className={`utvikler__grunn utvikler__grunn--${reason.tone}`}
              style={cssVars({ "--grunn": index })}
            >
              <circle
                cx={points[0][0]}
                cy={points[0][1]}
                r={11}
                className="utvikler__prikk"
                data-from={1}
              />
              <Line
                points={points}
                radius={20}
                width={8}
                draw
                from={1}
                className="utvikler__leder"
              />
              <g className="utvikler__grunntekst" data-from={1}>
                <MapText
                  x={REASON_X}
                  y={reason.labelY}
                  size={40}
                  weight={800}
                  className="utvikler__grunnavn"
                >
                  {reason.label}
                </MapText>
                {reason.note.map((line, row) => (
                  <MapText
                    key={line}
                    x={REASON_X}
                    y={reason.labelY + 44 + row * 38}
                    size={32}
                    weight={600}
                    muted
                  >
                    {line}
                  </MapText>
                ))}
              </g>
            </g>
          );
        })}

        {/* Click 2: the developer's work, drawn from the left. */}
        <Line
          points={[
            [0, LINE_Y],
            [1920, LINE_Y],
          ]}
          draw
          from={2}
          className="utvikler__arbeid"
        />
        {STOPS.map((stop, index) => (
          <g
            key={stop.label}
            className={`utvikler__stopp utvikler__stopp--${stop.tone}`}
            style={cssVars({ "--stopp-x": STOP_X[index] / 1920 })}
            data-from={2}
          >
            <Station x={STOP_X[index]} y={LINE_Y} />
            <MapText
              x={STOP_X[index] - 22}
              y={LABEL_Y}
              size={40}
              weight={800}
              className="utvikler__stoppnavn"
            >
              {stop.label}
            </MapText>
            {stop.note.map((line, row) => (
              <MapText
                key={line}
                x={STOP_X[index] - 22}
                y={LABEL_Y + 52 + row * 40}
                size={32}
                weight={600}
                muted
              >
                {line}
              </MapText>
            ))}
          </g>
        ))}
      </LineMap>
    </div>
  );
}

export const utviklerensSteg: Slide = {
  id: "utviklerens-steg",
  title: "Dette gjør utvikleren",
  rooms: ["frontend"],
  steps: 2,
  Component: UtviklerensSteg,
};
