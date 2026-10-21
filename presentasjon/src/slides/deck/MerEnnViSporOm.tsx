import type { ReactNode } from "react";
import { Tag } from "../../components/Tag";
import type { Slide } from "../../engine";
import "./premiss.css";

interface PersonalProps {
  /** Build step at which the frame comes on. */
  from: number;
  children: ReactNode;
}

/** Personal data in the answer. The text stays, an ink frame comes on. */
function Personal({ from, children }: PersonalProps) {
  return (
    <mark className="mer__personal">
      {children}
      <span className="mer__frame" data-from={from} aria-hidden="true" />
    </mark>
  );
}

function MerEnnViSporOm() {
  return (
    <div className="slide">
      <h2 className="slide-title">Folk skriver mer enn vi spør om</h2>
      <figure className="mer__example">
        <p className="mer__question">Hva kan vi gjøre bedre?</p>
        <div className="mer__answer">
          <Tag kind="example" className="mer__tag" />
          <p className="mer__field">
            Lederen min, <Personal from={1}>Kari Nordmann</Personal>
            <span className="mer__after">,</span> svarer ikke.
            <br />
            Kontakt henne på{" "}
            <Personal from={2}>kari.nordmann@example.com</Personal>
          </p>
        </div>
      </figure>
    </div>
  );
}

export const merEnnViSporOm: Slide = {
  id: "mer-enn-vi-spor-om",
  title: "Folk skriver mer enn vi spør om",
  steps: 2,
  notes: `Ordrett inn: «Det jeg skrev, var laget for anledningen, men vi ser det samme i ekte svar.»

Ordrett: «Vi ber ikke om personopplysninger, men de kommer inn i fritekst likevel. Da skal de ligge der Nav kan finne og slette dem.»

Klikk 1: pek på navnet. Klikk 2: pek på e-postadressen.

Svaret er et laget eksempel.`,
  Component: MerEnnViSporOm,
};
