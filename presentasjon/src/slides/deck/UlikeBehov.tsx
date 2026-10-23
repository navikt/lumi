import type { Slide } from "../../engine";
import { cx } from "../../engine/css";
import "./bevis.css";

/**
 * Two rows of the same form and weight: placement, not ranking. In the
 * order they came into use in Nav. Lumi's limit is set as strongly as the
 * facts, since it is what decides for the open pages on nav.no.
 */
const TOOLS = [
  { name: "Skyra", how: "Uten utvikler", where: "hele nav.no og fagsystemer" },
  {
    name: "Lumi",
    how: "I appens kode",
    where: "krever innlogging",
    limit: true,
  },
] as const;

function UlikeBehov() {
  return (
    <div className="slide verktoy">
      <h2 className="verktoy__title">Skyra og Lumi passer til ulike behov</h2>
      <ul className="verktoy__rows">
        {TOOLS.map((tool) => (
          <li key={tool.name} className="verktoy__row">
            <span className="verktoy__name">{tool.name}</span>
            <span className="verktoy__facts">
              <span className="verktoy__how">{tool.how}</span>
              <span
                className={cx(
                  "verktoy__where",
                  "limit" in tool && "verktoy__where--limit",
                )}
              >
                {tool.where}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="verktoy__choice" data-from={1}>
        Teamet velger hvem som lager surveyen,
        <br />
        og hvor svaret skal bo.
      </p>
    </div>
  );
}

export const ulikeBehov: Slide = {
  id: "ulike-behov",
  title: "Skyra og Lumi passer til ulike behov",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  notes: `Si bare hva hvert verktøy passer til. Skyra kom i bruk i Nav i januar 2025, Lumi i januar 2026.

Ordrett om Skyra: «Skal noen publisere surveyer uten utvikler, er Skyra laget for det.»

Lumi krever innlogget bruker i oppsettet vi dokumenterer, fordi appens backend veksler brukerens token. For åpne sider på nav.no er det dette som avgjør.

Klikk 1: «Teamet velger hvem som lager surveyen, og hvor svaret skal bo.»

Hvis noen spør om FlexJar: det er verktøyet til Team Flex, også med surveyen i koden og svarene på Nais. Spør Team Flex om det.`,
  Component: UlikeBehov,
};
