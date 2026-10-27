import type { ReactNode } from "react";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import { useBuildMotion } from "./bevisMotion";
import "./premiss.css";

interface PersonalProps {
  /** The name is marked first, then the phone number, then the e-mail address. */
  order: "first" | "second" | "third";
  children: ReactNode;
}

/**
 * Personal data in the answer. The words stay as they were typed. On click
 * 1 an orange marker, what the team must know, sweeps over the name, the
 * phone number and the e-mail address, and the words under it turn dark.
 * The marked copy is for the eye only.
 */
function Personal({ order, children }: PersonalProps) {
  return (
    <mark className={`mer__personal mer__personal--${order}`}>
      {children}
      <span className="mer__marker" data-from={1} aria-hidden="true">
        {children}
      </span>
    </mark>
  );
}

/**
 * The answer, as in the snow globe: a gold disc with eyes. It hangs in
 * front of the first line. When the marker comes, it looks at what it
 * wrote.
 */
function AnswerFace() {
  return (
    <svg className="mer__face" viewBox="-40 -40 80 80" aria-hidden="true">
      <circle r={34} className="mer__face-disc" />
      <g className="mer__eyes">
        <ellipse cx={-11} cy={-5} rx={5} ry={7.2} />
        <ellipse cx={11} cy={-5} rx={5} ry={7.2} />
      </g>
    </svg>
  );
}

function MerEnnViSporOm({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div
      className={cx("slide mer", step >= 1 && "mer--marked")}
      data-motion={motion ? "" : undefined}
    >
      <h2 className="mer__title">Folk skriver mer enn vi spør om</h2>
      <p className="mer__question">
        Svar på «Hva kan vi gjøre bedre?»
        <Tag kind="example" />
      </p>
      <p className="mer__quote">
        <AnswerFace />
        Lederen min, <Personal order="first">Kari Nordmann</Personal>
        <span className="mer__after">,</span>
        <br />
        svarer ikke. Ring henne på
        <br />
        <Personal order="second">912 34 567</Personal> eller skriv til
        <br />
        <Personal order="third">kari.nordmann@example.com</Personal>
      </p>
    </div>
  );
}

export const merEnnViSporOm: Slide = {
  id: "mer-enn-vi-spor-om",
  title: "Folk skriver mer enn vi spør om",
  steps: 1,
  Component: MerEnnViSporOm,
};
