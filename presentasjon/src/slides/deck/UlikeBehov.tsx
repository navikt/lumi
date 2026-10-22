import type { Slide } from "../../engine";
import { cx } from "../../engine/css";
import "./bevis.css";

/**
 * Three rows of the same form and weight: placement, not ranking. In the
 * order they came into use in Nav. Lumi's limit is set as strongly as the
 * facts, since it is what decides for the open pages on nav.no.
 */
const TOOLS = [
  { name: "FlexJar", how: "I appens kode", where: "flere team, siden 2023" },
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
      <h2 className="verktoy__title">Tre surveyverktøy i Nav</h2>
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
  title: "Tre surveyverktøy i Nav",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  notes: `Si bare hva hvert verktøy passer til. Rekkefølgen er når de kom i bruk i Nav: FlexJar i 2023, Skyra i januar 2025 og Lumi i januar 2026.

Ordrett om Skyra: «Skal noen publisere surveyer uten utvikler, er Skyra laget for det.»

Lumi krever innlogget bruker i oppsettet vi dokumenterer, fordi appens backend veksler brukerens token. For åpne sider på nav.no er det dette som avgjør.

Klikk 1: «Teamet velger hvem som lager surveyen, og hvor svaret skal bo.»

Spør Team Flex om FlexJar og #lumi om Lumi.`,
  Component: UlikeBehov,
};
