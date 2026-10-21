import type { Slide } from "../../engine";
import { Answer, Line, LineMap } from "../../map";
import "./deck.css";

function Tittel() {
  return (
    <div className="slide tittel">
      <LineMap label="En linje som går fram til et svar, tegnet som en gyllen skive. Etter svaret fortsetter linja stiplet, den er ikke bygget ennå.">
        <Line
          points={[
            [-20, 880],
            [540, 880],
            [780, 640],
            [1240, 640],
          ]}
          radius={120}
        />
        <Line
          points={[
            [1500, 640],
            [1940, 640],
          ]}
          dashed
        />
        <Answer x={1370} y={640} r={112} />
      </LineMap>
      <h1 className="slide-display tittel__title">Hvor bor svaret?</h1>
      <p className="slide-lead tittel__lead">
        Lumi: surveyer i appen, svar på Navs plattform
      </p>
      <p className="tittel__byline">Audun Sørheim, Team eSyfo</p>
    </div>
  );
}

export const tittel: Slide = {
  id: "tittel",
  title: "Hvor bor svaret?",
  notes: `Ordrett: «Jeg heter Audun Sørheim og er utvikler i Team eSyfo. Jeg har laget Lumi. Den gule prikken er et svar fra en bruker, og i dag skal jeg vise hvor det havner.»`,
  Component: Tittel,
};
