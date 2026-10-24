import type { Slide } from "../../engine";
import { ForumSporsmal } from "./VerktoySomFinnes";

/** Frontend forum: the question opens the talk, and the snow globe answers it. */
export const sporsmaletFraForum: Slide = {
  id: "sporsmalet",
  title: "Hvorfor ikke bare bruke et verktøy som finnes?",
  rooms: ["frontend"],
  notes: `Vis denne før tittelen. Ordrett: «Dette spørsmålet kom herfra. Jeg svarer på det når dere har sett hvordan Lumi virker.»

Etter «Pentesten fant ingen høye eller kritiske funn» kommer «Inne i Nav passer Nav selv på». Si ordrett: «Da svarer jeg på spørsmålet fra starten.»

Så svaret, ordrett: «Vi sammenlignet ikke funksjonene. Det som avgjorde, var at svaret skulle bli i Nav.»`,
  Component: ForumSporsmal,
};
