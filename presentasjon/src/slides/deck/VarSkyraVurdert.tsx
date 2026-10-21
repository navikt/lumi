import type { Slide } from "../../engine";
import "./bevis.css";

/**
 * The question from Frontend forum, as a quote and nothing else. Frontend
 * forum gets it first, as the hook (`sporsmalet`). Produktlederakademiet
 * gets it right before the map. Faggruppa goes straight to the map.
 */
export function SkyraQuestion() {
  return (
    <div className="slide skyra-quote">
      <figure className="skyra-quote__figure">
        <blockquote className="skyra-quote__text">
          <p>
            <span className="skyra-quote__open">«</span>Hva løser dette
            <br />
            som ikke Skyra løser?
            <br />
            Var det i det hele tatt vurdert?»
          </p>
        </blockquote>
        <figcaption className="skyra-quote__source">
          Spørsmål fra Frontend forum
        </figcaption>
      </figure>
    </div>
  );
}

export const varSkyraVurdert: Slide = {
  id: "var-skyra-vurdert",
  title: "Var Skyra vurdert?",
  rooms: ["produktledere"],
  notes: `Ordrett inn: «Fra Frontend forum kom det et spørsmål jeg vil svare ordentlig på.»

Les spørsmålet høyt.

Svaret, ordrett: «Nei, vi sammenlignet ikke funksjonene. Vi startet med et annet spørsmål: hvor skal svarene ligge?»`,
  Component: SkyraQuestion,
};
