import type { ReactNode } from "react";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import { Answer } from "../../map";
import "./premiss.css";

interface PersonalProps {
  /** The name is framed first, the e-mail address right after it. */
  order: "first" | "second";
  children: ReactNode;
}

/** Personal data in the answer. The text stays, a frame is drawn round it. */
function Personal({ order, children }: PersonalProps) {
  return (
    <mark className={`mer__personal mer__personal--${order}`}>
      {children}
      <span className="mer__frame" data-from={1}>
        <svg className="mer__frame-svg" aria-hidden="true">
          <rect className="mer__frame-line" pathLength={1} />
        </svg>
      </span>
    </mark>
  );
}

/** The answer's disc, 80 px with its edge, in front of the first line. */
const DOT_SIZE = 80;
const DOT_R = 36;

function MerEnnViSporOm({ step }: SlideProps) {
  return (
    <div className="slide">
      <h2 className="mer__title">Folk skriver mer enn vi spør om</h2>
      <p className="mer__question">
        Svar på «Hva kan vi gjøre bedre?»
        <Tag kind="example" />
      </p>
      <p className={cx("mer__quote", step >= 1 && "mer__quote--framed")}>
        <svg
          className="mer__dot"
          viewBox={`0 0 ${DOT_SIZE} ${DOT_SIZE}`}
          aria-hidden="true"
        >
          <Answer x={DOT_SIZE / 2} y={DOT_SIZE / 2} r={DOT_R} />
        </svg>
        Lederen min, <Personal order="first">Kari Nordmann</Personal>
        <span className="mer__after">,</span>
        <br />
        svarer ikke. Kontakt henne på
        <br />
        <Personal order="second">kari.nordmann@example.com</Personal>
      </p>
    </div>
  );
}

export const merEnnViSporOm: Slide = {
  id: "mer-enn-vi-spor-om",
  title: "Folk skriver mer enn vi spør om",
  steps: 1,
  notes: `Ordrett inn: «Varselet i fritekstfeltet står der av en grunn. Svaret jeg skrev i stad, var laget for anledningen, men vi ser det samme i ekte svar.»

La salen lese svaret et par sekunder.

Klikk 1: rammene tegnes rundt navnet og e-postadressen. Ordrett: «Vi ber ikke om personopplysninger, men de kommer inn i fritekst likevel. Da må teamet kunne finne og slette dem. I Lumi gjør dere det i dashboardet.»

Svaret er et laget eksempel. Navn i fritekst maskeres ikke.

Ut mot FlexJar: «Derfor var det første spørsmålet vårt: hvor bor svaret?»`,
  Component: MerEnnViSporOm,
};
