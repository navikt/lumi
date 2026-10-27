import type { Slide, SlideProps } from "../../engine";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/**
 * The question from Frontend forum, without the name of a product, and with
 * the word the answer turns on as the monument. It is not word for word, so
 * it has no quotation marks: the speaker says where it came from. Frontend
 * forum gets it first, as the hook (`sporsmalet`). Produktlederakademiet
 * gets it first too. Faggruppa starts with the snow globe.
 *
 * The dot of the question mark is the answer from the snow globe, a gold
 * disc with eyes, looking up at the question. When the slide comes on, it
 * drops in beside the question mark and rolls into the dot's place.
 */
export function ForumSporsmal({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div className="slide forum-quote" data-motion={motion ? "" : undefined}>
      <p className="forum-quote__text">
        <span className="forum-quote__lead">
          Hvorfor ikke bare bruke et verktøy som
        </span>{" "}
        <span className="forum-quote__word">
          finnes
          <span className="forum-quote__mark">
            <span className="forum-quote__hook">?</span>
            <span className="forum-quote__throw" aria-hidden="true">
              <span className="forum-quote__fall">
                <svg
                  className="forum-quote__answer"
                  viewBox="-40 -40 80 80"
                  aria-hidden="true"
                >
                  <circle r={35} className="forum-quote__disc" />
                  <g className="forum-quote__eyes">
                    <ellipse cx={-14} cy={-9} rx={5} ry={7.2} />
                    <ellipse cx={8} cy={-9} rx={5} ry={7.2} />
                  </g>
                </svg>
              </span>
            </span>
          </span>
        </span>
      </p>
    </div>
  );
}

export const verktoySomFinnes: Slide = {
  id: "verktoy-som-finnes",
  title: "Hvorfor ikke bare bruke et verktøy som finnes?",
  rooms: ["produktledere"],
  Component: ForumSporsmal,
};
