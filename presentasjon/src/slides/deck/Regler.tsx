import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import "./avslutning.css";

/*
 * What the terms of use rule out, as three prohibition signs, with the
 * source in the title. Source: «Bruksvilkår» in the docs. The signs stand
 * as plain white signs with a black drawing from the start, and each click
 * strikes one of them: the red ring draws itself round the drawing from the
 * top left, and the bar strikes across. Red is the one place the deck uses
 * it: it means «not». With the third, an orange warning sign says what the
 * terms add: no promise of anonymity.
 */

/**
 * The ring, as a path from the top left, clockwise, so it can draw itself.
 * It runs a little past its start, so the two ends leave no seam.
 */
const RING =
  "M49.29 49.29 A100 100 0 0 1 190.71 190.71 A100 100 0 0 1 49.29 49.29 A100 100 0 0 1 65.54 36.13";
const BAR = "M49.29 49.29 L190.71 190.71";

function Skilt({ from, children }: { from: number; children: ReactNode }) {
  return (
    <svg className="regler__skilt" viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r="118" className="regler__flate" />
      {children}
      <g className="regler__forbud" data-from={from}>
        <path d={RING} pathLength={1} className="regler__ring" />
        <path d={BAR} pathLength={1} className="regler__strek" />
      </g>
    </svg>
  );
}

const REGLER = [
  {
    tekst: "Rekruttering til brukertester",
    tegning: (
      <g className="regler__tegning">
        <path d="M86 104 L150 76 L150 164 L86 136 Z" />
        <rect x="66" y="102" width="24" height="36" rx="6" />
        <path d="M100 140 L108 174" className="regler__strok" />
        <path d="M166 102 Q178 120 166 138" className="regler__strok" />
        <path d="M180 88 Q200 120 180 152" className="regler__strok" />
      </g>
    ),
  },
  {
    tekst: "Surveyer rettet mot brukere med kode 6 eller 7",
    tegning: (
      <g className="regler__tegning">
        <path
          d="M120 44 L182 68 L182 118 C182 160 154 182 120 198 C86 182 58 160 58 118 L58 68 Z"
          className="regler__strok"
        />
        <text x="90" y="139" textAnchor="middle" className="regler__kode">
          6
        </text>
        <text x="150" y="139" textAnchor="middle" className="regler__kode">
          7
        </text>
      </g>
    ),
  },
  {
    tekst: "Å samle inn personopplysninger med vilje",
    tegning: (
      <g className="regler__tegning">
        <rect
          x="54"
          y="76"
          width="132"
          height="92"
          rx="12"
          className="regler__strok"
        />
        <circle cx="86" cy="118" r="13" />
        <path d="M64 160 Q86 130 108 160 Z" />
        <path
          d="M128 104 H166 M128 122 H160 M128 140 H150"
          className="regler__strok"
        />
      </g>
    ),
  },
] as const;

/** What to know: a warning sign, in orange. */
function Varsel() {
  return (
    <svg className="regler__varsel" viewBox="0 0 64 56" aria-hidden="true">
      <path d="M32 5 L60 52 H4 Z" className="regler__varsel-kant" />
      <path d="M32 21 V36" className="regler__varsel-tegn" />
      <circle cx="32" cy="44" r="3.6" />
    </svg>
  );
}

function Regler() {
  return (
    <div className="slide regler">
      <h2 className="slide-title regler__tittel">
        Bruksvilkårene sier nei til tre ting
      </h2>
      <ul className="regler__liste">
        {REGLER.map((regel, i) => (
          <li key={regel.tekst} className="regler__regel">
            <Skilt from={i + 1}>{regel.tegning}</Skilt>
            <span className="regler__tekst">{regel.tekst}</span>
          </li>
        ))}
      </ul>
      <p className="regler__obs" data-from={3}>
        <Varsel />
        Lov heller ikke brukerne at de er anonyme.
      </p>
    </div>
  );
}

export const regler: Slide = {
  id: "regler",
  title: "Bruksvilkårene sier nei til tre ting",
  steps: 3,
  Component: Regler,
};
