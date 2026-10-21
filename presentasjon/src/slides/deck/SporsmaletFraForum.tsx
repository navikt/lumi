import type { Slide } from "../../engine";
import { SkyraQuestion } from "./VarSkyraVurdert";

/** Frontend forum: the question opens the talk, and the map answers it. */
export const sporsmaletFraForum: Slide = {
  id: "sporsmalet",
  title: "Var Skyra vurdert?",
  rooms: ["frontend"],
  notes: `Vis denne før tittelen. Ordrett: «Dette spørsmålet kom herfra. Jeg svarer på det når dere har sett hvordan Lumi virker.»

Kort svar: nei. Hvorfor, viser jeg når dere har sett hvordan Lumi virker.

Etter «Pentesten fant ingen høye eller kritiske funn» kommer kartet. Si ordrett: «Da svarer jeg på spørsmålet fra starten.»

Så svaret, ordrett: «Nei, vi sammenlignet ikke funksjonene. Vi startet med et annet spørsmål: hvor skal svarene ligge?»`,
  Component: SkyraQuestion,
};
