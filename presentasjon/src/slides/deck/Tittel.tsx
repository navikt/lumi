import { type Slide, type SlideProps, useRenderMode } from "../../engine";
import { Answer, Line, LineMap } from "../../map";
import "./deck.css";

/**
 * The opening: the line draws in to the answer, the answer lights, and the
 * title follows. It runs each time the slide comes on the stage, never in
 * thumbnails, the presenter preview or the PDF.
 */
function Tittel({ active }: SlideProps) {
  const intro = useRenderMode() === "stage" && active;
  return (
    <div className="slide tittel" data-intro={intro ? "" : undefined}>
      <LineMap label="En linje som går fram til et svar, tegnet som en gyllen skive. Etter svaret fortsetter linja stiplet, den er ikke bygget ennå.">
        <Line
          points={[
            [-20, 880],
            [540, 880],
            [780, 640],
            [1240, 640],
          ]}
          radius={120}
          draw
          className="tittel__line"
        />
        <g className="tittel__after">
          <Line
            points={[
              [1500, 640],
              [1940, 640],
            ]}
            dashed
          />
        </g>
        <Answer x={1370} y={640} r={112} className="tittel__answer" />
      </LineMap>
      <div className="tittel__text">
        <h1 className="slide-display tittel__title">Hvor bor svaret?</h1>
        <p className="slide-lead tittel__lead">
          Lumi: surveyer i appen, svar på Navs plattform
        </p>
        <p className="tittel__byline">Audun Sørheim, Team eSyfo</p>
      </div>
    </div>
  );
}

export const tittel: Slide = {
  id: "tittel",
  title: "Hvor bor svaret?",
  notes: `Ordrett: «Jeg heter Audun Sørheim og er utvikler i Team eSyfo, som lager og drifter Lumi. Den gule prikken er et svar fra en bruker.»

Faggruppa: «Om tjue minutter vet dere hvordan dere kan spørre brukerne av fagsystemet deres, og hvor svaret bor. Ha ett spørsmål i bakhodet: hva skulle dere gjerne visst om hvordan fagsystemet deres blir brukt? Det tar vi med i gruppene.»

Linja tegnes inn og prikken tennes når sliden kommer. Vent til tittelen står, og begynn å snakke.`,
  Component: Tittel,
};
