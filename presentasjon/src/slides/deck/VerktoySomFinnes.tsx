import type { Slide } from "../../engine";
import "./bevis.css";

/**
 * The question from Frontend forum, without the name of a product, and with
 * the word the answer turns on as the monument. It is not word for word, so
 * it has no quotation marks: the speaker says where it came from. Frontend
 * forum gets it first, as the hook (`sporsmalet`). Produktlederakademiet
 * gets it right before the snow globe. Faggruppa goes straight to the globe.
 */
export function ForumSporsmal() {
  return (
    <div className="slide forum-quote">
      <p className="forum-quote__text">
        <span className="forum-quote__lead">
          Hvorfor ikke bare bruke et verktøy som
        </span>{" "}
        <span className="forum-quote__word">finnes?</span>
      </p>
    </div>
  );
}

export const verktoySomFinnes: Slide = {
  id: "verktoy-som-finnes",
  title: "Hvorfor ikke bare bruke et verktøy som finnes?",
  rooms: ["produktledere"],
  notes: `Ordrett inn: «Fra Frontend forum kom det et spørsmål jeg vil svare ordentlig på.»

Les spørsmålet høyt.

Svaret, ordrett: «Vi sammenlignet ikke funksjonene. Det som avgjorde, var at svaret skulle bli i Nav.»`,
  Component: ForumSporsmal,
};
