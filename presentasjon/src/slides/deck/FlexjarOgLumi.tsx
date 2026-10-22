import type { Slide } from "../../engine";
import "./premiss.css";

/** The FlexJar story in one sentence, for the talk with the least time. */
function FlexjarOgLumi() {
  return (
    <div className="slide flexjar-kort">
      <h2 className="flexjar-kort__claim">
        Surveyen ligger i appens kode,
        <br />
        og svaret blir på Nais.
      </h2>
      <p className="flexjar-kort__names">
        FlexJar
        <span data-from={1}>
          {" "}
          <span className="flexjar-kort__and">og</span> Lumi
        </span>
      </p>
    </div>
  );
}

export const flexjarOgLumi: Slide = {
  id: "flexjar-og-lumi",
  title: "Samme grunntanke som FlexJar",
  steps: 1,
  rooms: ["faggruppa"],
  notes: `Har Team Flex vist FlexJar først, begynn med: «Dere har akkurat sett FlexJar.»

Ordrett: «Vi startet med FlexJar fra Team Flex, fordi surveyen ligger i koden og svarene blir på Nais. Takk til Team Flex, som tok imot svarene våre fra 2024 av.»

Klikk 1: «og Lumi» kommer. Ordrett: «Lumi bygger på samme grunntanke. Det vi manglet, lagde vi selv, først som et tillegg til FlexJar, med en widget og et dashboard for analyse. I januar 2026 ble Lumi et eget verktøy, med egen datamodell og tilgang per team.»

Viser Team Flex FlexJar etter Lumi, slutt med: «Etterpå viser Team Flex FlexJar.»

FlexJar har tatt imot svar for flere team siden 2023, og brukes fortsatt.`,
  Component: FlexjarOgLumi,
};
