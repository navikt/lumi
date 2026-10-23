import type { Slide } from "../../engine";
import { ansvar } from "./Ansvar";
import { bareTeamet } from "./BareTeamet";
import { brukesVidere } from "./BrukesVidere";
import { fagsystemsonen } from "./Fagsystemsonen";
import { fjernerEPosten } from "./FjernerEPosten";
import { grupper } from "./Grupper";
import { hvaVilDereVite } from "./HvaVilDereVite";
import { hvorBorSvaret } from "./HvorBorSvaret";
import { iAppen } from "./IAppen";
import { merEnnViSporOm } from "./MerEnnViSporOm";
import { oppfolgingsplanen } from "./Oppfolgingsplanen";
import { personvern } from "./Personvern";
import { provSelv } from "./ProvSelv";
import { sammeUtkast } from "./SammeUtkast";
import { sammeVei } from "./SammeVei";
import { segmentering } from "./Segmentering";
import { slikVetVi } from "./SlikVetVi";
import { slutt } from "./Slutt";
import { sporsmaletFraForum } from "./SporsmaletFraForum";
import { sporsmalstyper } from "./Sporsmalstyper";
import { styrerDere } from "./StyrerDere";
import { surveyenSomKode } from "./SurveyenSomKode";
import { svaretsVei } from "./SvaretsVei";
import { svarMeg } from "./SvarMeg";
import { tallet } from "./Tallet";
import { tittel } from "./Tittel";
import { ulikeBehov } from "./UlikeBehov";
import { underPanseret } from "./UnderPanseret";
import { varSkyraVurdert } from "./VarSkyraVurdert";
import { viTrengteMer } from "./ViTrengteMer";

/**
 * «Hvor bor svaret?», in the order of the storyboard. `rooms` on a slide
 * decides which talks get it: `?rom=faggruppa`, `frontend` or
 * `produktledere`. Without `?rom`, every slide is shown except the opening
 * hook for Frontend forum and the questions for the groups, which only make
 * sense live.
 */
export const deckSlides: readonly Slide[] = [
  { ...sporsmaletFraForum, roomOnly: true },
  tittel,
  svarMeg,
  iAppen,
  merEnnViSporOm,
  fjernerEPosten,
  viTrengteMer,
  svaretsVei,
  hvaVilDereVite,
  sporsmalstyper,
  sammeUtkast,
  surveyenSomKode,
  styrerDere,
  sammeVei,
  bareTeamet,
  segmentering,
  underPanseret,
  slikVetVi,
  varSkyraVurdert,
  hvorBorSvaret,
  fagsystemsonen,
  ulikeBehov,
  tallet,
  oppfolgingsplanen,
  brukesVidere,
  ansvar,
  slutt,
  // After the last sentence, so the QR code stays up while people ask.
  provSelv,
  { ...grupper, roomOnly: true },
  // A spare, for questions about privacy. Last, so it never interrupts.
  personvern,
];
