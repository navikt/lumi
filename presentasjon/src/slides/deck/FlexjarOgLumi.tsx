import type { Slide } from "../../engine";
import { NeedsLine } from "./ViTrengteMer";
import "./premiss.css";

/** The FlexJar story in one slide, for talks with little time. */
function FlexjarOgLumi() {
  return (
    <div className="slide">
      <h2 className="slide-title">
        Grunntanken i FlexJar er god. Vi trengte mer.
      </h2>
      <p className="slide-lead flexjar-kort__thanks">
        Surveyen i koden, svarene internt. Takk til Team Flex.
      </p>
      <NeedsLine />
    </div>
  );
}

export const flexjarOgLumi: Slide = {
  id: "flexjar-og-lumi",
  title: "Grunntanken i FlexJar er god. Vi trengte mer.",
  steps: 2,
  rooms: ["faggruppa"],
  notes: `Ordrett: «Vi startet med FlexJar fra Team Flex, fordi grunntanken er god: surveyen i koden og svarene internt. Det vi manglet, lagde vi selv, først som tillegg: en widget og et dashboard for analyse. I januar 2026 ble det et eget verktøy, med egen datamodell og tilgang per team.»

Klikk 1: de fire behovene. Klikk 2: Lumi, januar 2026.

Har Team Flex vist FlexJar først: «Dere har akkurat sett FlexJar. Lumi har samme grunnidé.»`,
  Component: FlexjarOgLumi,
};
