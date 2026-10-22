import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import { RouteProgress } from "./RouteProgress";
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

/**
 * The developer's work as a line from edge to edge, in the order the guide
 * «Koble til backend» gives it: access first, since it is the only step
 * where the team waits for others. Labels and notes sit above the line, so
 * nothing reaches the Teams corner.
 */
const LINE_Y = 760;
const STOP_X = [150, 590, 1030, 1470] as const;
const LABEL_Y = LINE_Y - 150;
const STOPS = [
  { label: "Tilgang til Lumi API", note: ["det eneste dere venter på"] },
  { label: "Pakken", note: ["React 18 eller nyere,", "Aksel 8 eller nyere"] },
  {
    label: "Ruta i backend",
    note: ["veksler token og sender", "svaret videre"],
  },
  { label: "Miljøvariablene", note: ["tre verdier i Nais"] },
] as const;

function SurveyenSomKode() {
  return (
    <div className="slide som-kode">
      <h2 className="som-kode__title">Utvikleren får surveyen som kode</h2>

      <pre className="som-kode__code">
        <code>
          <span className="som-kode__comment">
            {"// survey.ts er kopiert fra Surveyverksted"}
          </span>
          {"\n"}
          <Kw>import</Kw> <P>{"{"}</P> survey <P>{"}"}</P> <Kw>from</Kw>{" "}
          <Str>"./survey"</Str>
          <P>;</P>
          {"\n"}
          <P>{"<"}</P>
          <Kw>LumiSurveyDock</Kw>
          {"\n  "}surveyId<P>=</P>
          <Str>"min-app-tilbakemelding"</Str>
          {"\n  "}survey<P>={"{"}</P>survey<P>{"}"}</P>
          {"\n  "}transport<P>={"{{"}</P> endpoint<P>:</P>{" "}
          <span className="som-kode__mark">
            <Str>"/api/lumi/feedback"</Str>
            <span className="som-kode__ink" data-from={1} aria-hidden="true" />
          </span>{" "}
          <P>{"}}"}</P>
          {"\n"}
          <P>{"/>"}</P>
        </code>
      </pre>

      <LineMap label="Det utvikleren gjør, i rekkefølge: tilgang til Lumi API, det eneste dere venter på. Pakken, som krever React 18 eller nyere og Aksel 8 eller nyere. Ruta i backend, som veksler token og sender svaret videre. Miljøvariablene, tre verdier i Nais.">
        <g data-from={1}>
          <Line
            points={[
              [0, LINE_Y],
              [1920, LINE_Y],
            ]}
          />
          {STOPS.map((stop, index) => (
            <g key={stop.label}>
              <Station x={STOP_X[index]} y={LINE_Y} />
              <MapText
                x={STOP_X[index] - 22}
                y={LABEL_Y}
                size={40}
                weight={800}
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
        </g>
      </LineMap>

      <p className="som-kode__price" data-from={2}>
        Endringer i surveyen krever en ny versjon av appen.
      </p>
      <RouteProgress at={1} />
    </div>
  );
}

export const surveyenSomKode: Slide = {
  id: "surveyen-som-kode",
  title: "Utvikleren får surveyen som kode",
  rooms: ["faggruppa", "frontend"],
  steps: 2,
  notes: `Fra start: koden i appen. survey.ts er kopiert fra Surveyverksted med «Kopier TypeScript». Komponenten får surveyen og stien til et endepunkt i appens egen backend. Fra versjon 2.5.0 sender widgeten svaret selv dit, med tidsgrense og ett nytt forsøk.

Klikk 1: dette gjør utvikleren. Be om tilgang først, for det er det eneste steget der dere venter på andre: appen må inn i tilgangslista til Lumi API. Så pakken. Den krever React 18 eller nyere og Aksel 8 eller nyere. Så ruta i backend, den som står i koden. Den veksler brukerens token med TokenX eller Entra ID og sender svaret videre til Lumi API. Til slutt tre miljøvariabler i Nais-manifestet: host, audience og sti.

Klikk 2, prisen: endringer i surveyen krever en ny versjon av appen. Brukerne ser endringen når appen er satt i produksjon.

Hvor lang tid det tar, varierer. Si ikke et tall.`,
  Component: SurveyenSomKode,
};
