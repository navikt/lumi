import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Line, LineMap, MapText, type Point, Zone } from "../../map";
import "./tanstack.css";

const Kw = ({ children }: { children: ReactNode }) => (
  <span className="serverkode__kw">{children}</span>
);
const Str = ({ children }: { children: ReactNode }) => (
  <span className="serverkode__str">{children}</span>
);
const P = ({ children }: { children: ReactNode }) => (
  <span className="serverkode__punct">{children}</span>
);

/**
 * A part of the code marked with Lumi's blue highlighter: the call and its
 * name on the server, and the three parts the reasons point at.
 */
const Mark = ({ children }: { children: ReactNode }) => (
  <span className="serverkode__mark">
    <span className="serverkode__marker" aria-hidden="true" />
    {children}
  </span>
);

/*
 * The dashboard's own code, shortened: the hook that asks for the
 * feedback in the browser, and the server function it calls, on Nais.
 * Set in Overpass Mono, where every character is 0.616 em wide, so the
 * map can find a word in a line: x = CODE_X + column * ADV.
 */
const CODE_X = 112;
const CODE_SIZE = 30;
const CODE_LINE = 38;
const ADV = CODE_SIZE * 0.616;
const BROWSER_TOP = 236;
const SERVER_TOP = 544;
const rowY = (top: number, row: number) => top + (row + 0.5) * CODE_LINE;
const colX = (column: number) => CODE_X + column * ADV;

/** The zones: the browser over Nais, with room between them for the call. */
const BROWSER_ZONE = { y: 150, height: 254 } as const;
const NAIS_ZONE = { y: 456, height: 384 } as const;
const BORDER_Y = (BROWSER_ZONE.y + BROWSER_ZONE.height + NAIS_ZONE.y) / 2;

/*
 * The call: from fetchFeedbackServerFn in the browser's third line
 * (columns 17 to 38) down to its name on the server (columns 13 to 34),
 * across the edge between the zones, where Start makes it a request.
 */
const CALL_FROM_X = colX(27.5);
const CALL_TO_X = colX(23.5);
const CALL: Point[] = [
  [CALL_FROM_X, BROWSER_TOP + 3 * CODE_LINE + 4],
  [CALL_FROM_X, BORDER_Y],
  [CALL_TO_X, BORDER_Y],
  [CALL_TO_X, SERVER_TOP - 4],
];

/*
 * Why it is good, one reason per marked part of the server function, each
 * with a leader from the end of its line to a column on the right. The
 * middle one is level with its line; the others bend. All there at once,
 * without clicks.
 */
const REASON_X = 1190;
const REASONS = [
  {
    row: 2,
    columns: 33,
    labelY: rowY(SERVER_TOP, 2) - 58,
    label: "Tokenet byttes her",
    note: "med @navikt/oasis, nettleseren ser det aldri",
  },
  {
    row: 3,
    columns: 36,
    labelY: rowY(SERVER_TOP, 3),
    label: "Input sjekkes",
    note: "med zod, før handleren kjører",
  },
  {
    row: 4,
    columns: 43,
    labelY: rowY(SERVER_TOP, 4) + 58,
    label: "Kjører bare på serveren",
    note: "koden kommer ikke med til nettleseren",
  },
] as const;

/** From the end of the line to the column, bending up or down where it must. */
function leader(row: number, columns: number, labelY: number): Point[] {
  const startX = colX(columns) + 22;
  const y = rowY(SERVER_TOP, row);
  const endX = REASON_X - 24;
  if (labelY === y) {
    return [
      [startX, y],
      [endX, y],
    ];
  }
  const drop = Math.abs(labelY - y);
  const bendX = endX - 24 - drop;
  return [
    [startX, y],
    [bendX, y],
    [bendX + drop, labelY],
    [endX, labelY],
  ];
}

function Serverkoden() {
  return (
    <div
      className="slide serverkode"
      style={cssVars({
        "--kode-x": `${CODE_X}px`,
        "--kode-size": `${CODE_SIZE}px`,
        "--kode-line": `${CODE_LINE}px`,
      })}
    >
      <LineMap
        className="serverkode__soner"
        label="To soner: nettleseren øverst, og dashboardets server på Nais under."
      >
        <Zone
          x={64}
          y={BROWSER_ZONE.y}
          width={1792}
          height={BROWSER_ZONE.height}
          tone="neutral"
          label="I nettleseren"
          labelAt="top"
        />
        <Zone
          x={64}
          y={NAIS_ZONE.y}
          width={1792}
          height={NAIS_ZONE.height}
          tone="nais"
          label="På serveren (Nais)"
          labelAt="top"
        />
      </LineMap>

      <h2 className="serverkode__title">
        Serverkoden kalles som en vanlig funksjon
      </h2>

      <pre
        className="serverkode__code"
        style={cssVars({ "--kode-top": `${BROWSER_TOP}px` })}
      >
        <code>
          <Kw>const</Kw> <P>{"{"}</P> data <P>{"}"}</P> <P>=</P> useQuery
          <P>{"({"}</P>
          {"\n  "}queryKey<P>:</P> <P>[</P>
          <Str>"feedback"</Str>
          <P>,</P> params<P>],</P>
          {"\n  "}queryFn<P>:</P> <P>()</P> <P>{"=>"}</P>{" "}
          <Mark>fetchFeedbackServerFn</Mark>
          <P>({"{"}</P> data<P>:</P> params <P>{"}"}),</P>
          {"\n"}
          <P>{"});"}</P>
        </code>
      </pre>

      <pre
        className="serverkode__code"
        style={cssVars({ "--kode-top": `${SERVER_TOP}px` })}
      >
        <code>
          <Kw>export const</Kw> <Mark>fetchFeedbackServerFn</Mark> <P>=</P>
          {"\n  "}createServerFn<P>({"{"}</P> method<P>:</P> <Str>"GET"</Str>{" "}
          <P>{"})"}</P>
          {"\n    "}
          <Mark>
            <P>.</P>middleware<P>([</P>authMiddleware<P>])</P>
          </Mark>
          {"\n    "}
          <Mark>
            <P>.</P>validator<P>(</P>FeedbackParamsSchema<P>)</P>
          </Mark>
          {"\n    "}
          <Mark>
            <P>.</P>handler
          </Mark>
          <P>(</P>
          <Kw>async</Kw> <P>({"{"}</P> data<P>,</P> context <P>{"})"}</P>{" "}
          <P>{"=> {"}</P>
          {"\n      "}
          <span className="serverkode__comment">
            {"// kaller Lumi API med context.oboToken"}
          </span>
          {"\n    "}
          <P>{"});"}</P>
        </code>
      </pre>

      <LineMap
        className="serverkode__kart"
        label={`Funksjonskallet fetchFeedbackServerFn i nettleseren blir en forespørsel, GET /_serverFn, til den samme funksjonen på serveren. Der ${REASONS.map((reason) => `${reason.label.toLowerCase()}: ${reason.note}`).join(". ")}.`}
      >
        {/* The call crosses into Nais as a request. */}
        <Line
          points={CALL}
          radius={16}
          width={8}
          arrow
          className="serverkode__kall"
        />
        <MapText
          x={CALL_FROM_X + 32}
          y={BORDER_Y}
          size={28}
          weight={600}
          mono
          className="serverkode__get"
        >
          GET /_serverFn/…
        </MapText>

        {/* Why: a leader from each marked line to its reason. */}
        {REASONS.map((reason) => {
          const points = leader(reason.row, reason.columns, reason.labelY);
          return (
            <g key={reason.label}>
              <circle
                cx={points[0][0]}
                cy={points[0][1]}
                r={10}
                className="serverkode__prikk"
              />
              <Line
                points={points}
                radius={18}
                width={7}
                className="serverkode__leder"
              />
              <g>
                <MapText
                  x={REASON_X}
                  y={reason.labelY}
                  size={38}
                  weight={800}
                  className="serverkode__grunnavn"
                >
                  {reason.label}
                </MapText>
                <MapText
                  x={REASON_X}
                  y={reason.labelY + 40}
                  size={30}
                  weight={600}
                  muted
                >
                  {reason.note}
                </MapText>
              </g>
            </g>
          );
        })}
      </LineMap>

      <p className="slide-source">
        Forkortet fra fetchFeedback.ts og useFeedback.ts i lumi-dashboard
      </p>
    </div>
  );
}

export const serverkoden: Slide = {
  id: "serverkoden",
  title: "Serverkoden kalles som en vanlig funksjon",
  rooms: ["frontend"],
  Component: Serverkoden,
};
