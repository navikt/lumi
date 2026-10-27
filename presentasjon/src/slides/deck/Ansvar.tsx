import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import "./avslutning.css";

/*
 * The claim as the title, and three columns under it: what the team must
 * do, what Lumi does, and what the team must know, each in its colour:
 * the team's green, Lumi's blue, and orange for what to know. Each has a
 * picture in a ring of its colour beside its name, and the picture moves
 * on its click: the answer goes round the year once and is gone, and
 * something slips through the filter. The rest is said aloud. Sources:
 * «Hva er Lumi?» and «Bruksvilkår» in the docs.
 */

/** Twelve ticks round the inside of the ring: the months of a year. */
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = ((-90 + i * 30) * Math.PI) / 180;
  const at = (r: number) =>
    `${(120 + r * Math.cos(a)).toFixed(2)} ${(120 + r * Math.sin(a)).toFixed(2)}`;
  return `M${at(74)} L${at(86)}`;
}).join(" ");

function Bilde({ children }: { children: ReactNode }) {
  return (
    <svg className="ansvar__bilde" viewBox="0 0 240 240" aria-hidden="true">
      {children}
    </svg>
  );
}

/** The survey and an answer, inside the team's ring. */
const DERE = (
  <Bilde>
    <circle cx="120" cy="120" r="104" className="ansvar__ring" />
    <rect
      x="70"
      y="56"
      width="92"
      height="120"
      rx="12"
      className="ansvar__ark"
    />
    <path d="M90 90 H142 M90 114 H142 M90 138 H122" className="ansvar__strek" />
    <circle cx="160" cy="164" r="30" className="ansvar__svar" />
  </Bilde>
);

/** A year as a dial. The answer goes round once, and is gone. */
const LUMI = (
  <Bilde>
    <circle cx="120" cy="120" r="104" className="ansvar__ring" />
    <path d={TICKS} className="ansvar__tikk" />
    <text
      x="120"
      y="124"
      textAnchor="middle"
      dominantBaseline="middle"
      className="ansvar__tolv"
    >
      12
    </text>
    <g className="ansvar__aaret">
      <circle
        cx="120"
        cy="16"
        r="24"
        className="ansvar__svar ansvar__slettes"
      />
    </g>
  </Bilde>
);

/** The filter: known patterns stay in it, and one answer slips through. */
const FILTER = (
  <Bilde>
    <circle cx="120" cy="120" r="104" className="ansvar__ring" />
    <rect
      x="106"
      y="164"
      width="28"
      height="28"
      rx="7"
      className="ansvar__gjennom"
    />
    <path d="M60 62 H180 L134 122 V152 H106 V122 Z" className="ansvar__trakt" />
  </Bilde>
);

const COLUMNS = [
  {
    name: "Dere",
    tone: "team",
    picture: DERE,
    text: "Lag en kopi av etterlevelsesmalen E726, og vurder om dere trenger en PVK.",
  },
  {
    name: "Lumi",
    tone: "lumi",
    picture: LUMI,
    text: "Lumi sletter svarene automatisk etter 12\u00a0måneder.",
  },
  {
    name: "Filteret",
    tone: "varsel",
    picture: FILTER,
    text: "Lumi fjerner kjente mønstre, men svar med personopplysninger som slipper gjennom, må teamet deres slette selv i dashboardet.",
  },
] as const;

function Ansvar() {
  return (
    <div className="slide ansvar">
      <h2 className="slide-title ansvar__tittel">
        Teamet deres har ansvaret for surveyen og svarene
      </h2>
      <p className="ansvar__nav">Nav er behandlingsansvarlig.</p>
      <ul className="ansvar__kolonner">
        {COLUMNS.map((column, i) => (
          <li
            key={column.name}
            className="ansvar__kolonne"
            data-tone={column.tone}
            {...(i === 0 ? {} : { "data-from": i })}
          >
            <div className="ansvar__hode">
              {column.picture}
              <h3 className="ansvar__name">{column.name}</h3>
            </div>
            <p className="ansvar__text">{column.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ansvar: Slide = {
  id: "ansvar",
  title: "Teamet deres har ansvaret for surveyen og svarene",
  steps: 2,
  Component: Ansvar,
};
