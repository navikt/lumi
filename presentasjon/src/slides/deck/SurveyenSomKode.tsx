import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, type Point, Station } from "../../map";
import "./verksted.css";

const Kw = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__kw">{children}</span>
);
const Str = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__str">{children}</span>
);
const P = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__punct">{children}</span>
);
const Rest = () => <span className="som-kode__comment">…</span>;

/** A question the team wrote, marked in the team's green. */
const Mark = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__mark som-kode__mark--team">
    <span className="som-kode__marker" aria-hidden="true" />
    {children}
  </span>
);

/*
 * survey.ts as Surveyverksted exports it, cut down to the two questions
 * from the film before: «Kopier TypeScript» writes every key in quotes.
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
 * The two questions the team wrote, each with a line from the end of its
 * row. The lines meet in one stop in the team's green, beside the code.
 */
const QUESTION_ROWS = [
  { row: 3, columns: 47 },
  { row: 5, columns: 38 },
] as const;
const MEET_X = 1236;
const MEET_Y = (lineY(3) + lineY(5)) / 2;
const NOTE_X = MEET_X + 40;

function questionLine(row: number, columns: number): Point[] {
  const y = lineY(row);
  const bendX = MEET_X - Math.abs(MEET_Y - y);
  return [
    [lineEnd(columns) + 22, y],
    [bendX, y],
    [MEET_X, MEET_Y],
  ];
}

/**
 * The hand-over as a line from edge to edge: the team shares a version,
 * gives the link to a developer, the developer copies the code into the
 * app, and the users see the survey with the next version of the app.
 * Labels and notes sit above the line, so nothing reaches the Teams corner.
 */
const LINE_Y = 776;
const STOP_X = [150, 590, 1030, 1470] as const;
const LABEL_Y = LINE_Y - 150;
const STOPS = [
  {
    label: "«Del med utvikler»",
    note: ["dere, i Surveyverksted"],
    tone: "team",
  },
  {
    label: "En issue",
    note: ["med lenken til versjonen"],
    tone: "team",
  },
  {
    label: "«Kopier TypeScript»",
    note: ["utvikleren limer", "koden inn i appen"],
    tone: "team",
  },
  {
    label: "Hos brukerne",
    note: ["når den nye versjonen", "av appen er ute"],
    tone: "ute",
  },
] as const;

function SurveyenSomKode() {
  return (
    <div
      className="slide som-kode"
      style={cssVars({
        "--kode-x": `${CODE_X}px`,
        "--kode-top": `${CODE_TOP}px`,
        "--kode-size": `${CODE_SIZE}px`,
        "--kode-line": `${CODE_LINE}px`,
      })}
    >
      <h2 className="som-kode__title">Utvikleren får surveyen som kode</h2>

      <pre className="som-kode__code">
        <code>
          <span className="som-kode__comment">
            {"// survey.ts er kopiert fra Surveyverksted"}
          </span>
          {"\n"}
          <Kw>export</Kw> <Kw>const</Kw> survey <P>=</P> <P>{"{"}</P>
          {"\n  "}
          <Rest />
          {"\n  "}
          <Str>"prompt"</Str>
          <P>:</P>{" "}
          <Mark>
            <Str>"Hvordan har dagen vært så langt?"</Str>
          </Mark>
          <P>,</P>
          {"\n  "}
          <Rest />
          {"\n  "}
          <Str>"prompt"</Str>
          <P>:</P>{" "}
          <Mark>
            <Str>"Hva kan vi gjøre bedre?"</Str>
          </Mark>
          <P>,</P>
          {"\n  "}
          <Rest />
          {"\n"}
          <P>{"}"}</P> <Kw>satisfies</Kw> SurveyDocumentV1<P>;</P>
        </code>
      </pre>

      <LineMap label="Utdrag av survey.ts, kopiert fra Surveyverksted. Der står spørsmålene teamet skrev: «Hvordan har dagen vært så langt?» og «Hva kan vi gjøre bedre?». Utviklere kan også skrive surveyen rett i TypeScript. Så overleveringen, fra venstre: dere trykker «Del med utvikler» i Surveyverksted, gir lenken til versjonen til en utvikler i en issue, utvikleren trykker «Kopier TypeScript» og limer koden inn i appen, og brukerne ser surveyen når den nye versjonen av appen er ute.">
        {/* The questions the team wrote, in the code. */}
        <g className="som-kode__sporsmal">
          {QUESTION_ROWS.map(({ row, columns }) => (
            <Line
              key={row}
              points={questionLine(row, columns)}
              radius={20}
              width={8}
              className="som-kode__leder"
            />
          ))}
          <Station x={MEET_X} y={MEET_Y} r={18} className="som-kode__mote" />
          <MapText
            x={NOTE_X}
            y={MEET_Y - 22}
            size={44}
            weight={800}
            className="som-kode__dere"
          >
            Spørsmålene dere skrev
          </MapText>
          <MapText x={NOTE_X} y={MEET_Y + 24} size={32} weight={600} muted>
            i Surveyverksted
          </MapText>
          <MapText x={NOTE_X} y={MEET_Y + 104} size={32} weight={600} muted>
            Utviklere kan også skrive
          </MapText>
          <MapText x={NOTE_X} y={MEET_Y + 142} size={32} weight={600} muted>
            surveyen rett i TypeScript.
          </MapText>
        </g>

        {/* Click 1: the hand-over, drawn from the left. */}
        <Line
          points={[
            [0, LINE_Y],
            [1920, LINE_Y],
          ]}
          draw
          from={1}
          className="som-kode__arbeid"
        />
        {STOPS.map((stop, index) => (
          <g
            key={stop.label}
            className={`som-kode__stopp som-kode__stopp--${stop.tone}`}
            style={cssVars({ "--stopp-x": STOP_X[index] / 1920 })}
            data-from={1}
          >
            <Station x={STOP_X[index]} y={LINE_Y} />
            <MapText
              x={STOP_X[index] - 22}
              y={LABEL_Y}
              size={40}
              weight={800}
              className="som-kode__stoppnavn"
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

      <p className="som-kode__price" data-from={2}>
        <span>
          Surveyen <span className="som-kode__pris">går ikke live</span> når
          dere trykker «Del med utvikler».
        </span>{" "}
        <span>Utviklerne må oppdatere surveyen i appen.</span>
      </p>
    </div>
  );
}

export const surveyenSomKode: Slide = {
  id: "surveyen-som-kode",
  title: "Utvikleren får surveyen som kode",
  rooms: ["faggruppa", "frontend"],
  steps: 2,
  Component: SurveyenSomKode,
};
