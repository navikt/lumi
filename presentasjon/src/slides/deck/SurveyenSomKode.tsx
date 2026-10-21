import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { RouteProgress } from "./RouteProgress";
import "./verksted.css";

type MarkKind = "frame" | "underline";

/**
 * The deck's one mark, as on «Widgeten gjør ingen nettverkskall selv»: a
 * 6 px ink frame round the text, or a straight 6 px line under it. Only the
 * ink comes and goes; the text stays.
 */
function Mark({
  kind,
  from,
  children,
}: {
  kind: MarkKind;
  from: number;
  children: ReactNode;
}) {
  return (
    <span className={`som-kode__mark som-kode__mark--${kind}`}>
      {children}
      <span className="som-kode__ink" data-from={from} aria-hidden="true" />
    </span>
  );
}

const Kw = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__kw">{children}</span>
);
const Str = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__str">{children}</span>
);
const P = ({ children }: { children: ReactNode }) => (
  <span className="som-kode__punct">{children}</span>
);

function SurveyenSomKode() {
  return (
    <div className="slide">
      <h2 className="slide-title">Utvikleren får surveyen som kode</h2>

      <figure className="som-kode__block som-kode__block--file">
        <figcaption className="som-kode__label">
          <code>survey.ts</code> fra Surveyverksted
        </figcaption>
        <pre className="som-kode__code">
          <code>
            <Kw>import type</Kw> <P>{"{"}</P> SurveyDocumentV1 <P>{"}"}</P>
            {"\n  "}
            <Kw>from</Kw> <Str>"@navikt/lumi-survey"</Str>
            <P>;</P>
            {"\n\n"}
            <Kw>export const</Kw>{" "}
            <Mark kind="frame" from={1}>
              survey
            </Mark>{" "}
            <P>= {"{"}</P>
            {"\n  "}
            <Str>"pages"</Str>
            <P>: [ … ],</P>
            {"\n  "}
            <Str>"type"</Str>
            <P>:</P> <Str>"rating"</Str>
            {"\n"}
            <P>{"}"}</P> <Kw>satisfies</Kw> SurveyDocumentV1<P>;</P>
          </code>
        </pre>
      </figure>

      <figure className="som-kode__block som-kode__block--app" data-from={1}>
        <figcaption className="som-kode__label">Komponenten i appen</figcaption>
        <pre className="som-kode__code">
          <code>
            <P>{"<"}</P>
            <Kw>LumiSurveyDock</Kw>
            {"\n  "}surveyId<P>=</P>
            <Str>"min-app-tilbakemelding"</Str>
            {"\n  "}
            <Mark kind="underline" from={1}>
              survey<P>={"{"}</P>survey<P>{"}"}</P>
            </Mark>
            {"\n  "}transport<P>={"{"}</P>transport<P>{"}"}</P>
            {"\n"}
            <P>{"/>"}</P>
          </code>
        </pre>
      </figure>

      <p className="som-kode__price" data-from={2}>
        Prisen: endringer krever{" "}
        <Mark kind="underline" from={2}>
          ny versjon av appen
        </Mark>
        .
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
  notes: `Fra start: survey.ts, slik «Kopier TypeScript» lager den. Surveyen er en vanlig TypeScript-fil i appen.

Klikk 1: komponenten i appen. Den får surveyen og en transport som appen skriver selv. Surveyen bygges inn i appen og hentes ikke fra Lumi mens appen kjører.

Klikk 2, prisen: endringer krever ny versjon av appen. Brukerne ser endringen når appen er satt i produksjon.`,
  Component: SurveyenSomKode,
};
