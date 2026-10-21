import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { RouteProgress } from "./RouteProgress";
import "./verksted.css";

type Mark = "ring" | "underline";

/**
 * A pen mark drawn round or under its text, as if by hand. The path is drawn
 * in a 100×40 box that stretches to the text, with a stroke that keeps its
 * width.
 */
const PATHS: Record<Mark, string> = {
  ring: "M14 9 C 34 1, 78 0, 93 10 C 103 17, 99 31, 80 36 C 58 41, 18 40, 6 30 C -2 22, 5 11, 22 6 C 34 3, 46 3, 54 4",
  underline: "M2 22 C 18 17, 34 25, 50 20 S 82 17, 98 21",
};

function Pen({
  mark,
  from,
  children,
}: {
  mark: Mark;
  from: number;
  children: ReactNode;
}) {
  return (
    <span className={`pen pen--${mark}`}>
      {children}
      <svg
        className="pen__mark"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-from={from}
      >
        <path d={PATHS[mark]} vectorEffect="non-scaling-stroke" />
      </svg>
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
            <Pen mark="ring" from={1}>
              survey
            </Pen>{" "}
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
            <Pen mark="underline" from={1}>
              survey<P>={"{"}</P>survey<P>{"}"}</P>
            </Pen>
            {"\n  "}transport<P>={"{"}</P>transport<P>{"}"}</P>
            {"\n"}
            <P>{"/>"}</P>
          </code>
        </pre>
      </figure>

      <p className="som-kode__price" data-from={2}>
        Prisen: endringer krever{" "}
        <Pen mark="underline" from={2}>
          ny versjon av appen
        </Pen>
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
