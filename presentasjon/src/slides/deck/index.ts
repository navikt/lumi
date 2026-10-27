import type { Slide } from "../../engine";
import { ansvar } from "./Ansvar";
import { bareTeamet } from "./BareTeamet";
import { brukesVidere } from "./BrukesVidere";
import { fjernerEPosten } from "./FjernerEPosten";
import { hvaVilDereVite } from "./HvaVilDereVite";
import { iAppen } from "./IAppen";
import { komIGang } from "./KomIGang";
import { merEnnViSporOm } from "./MerEnnViSporOm";
import { oppfolgingsplanen } from "./Oppfolgingsplanen";
import { oppfolgingsplanenIntro } from "./OppfolgingsplanenIntro";
import { personvern } from "./Personvern";
import { provSelv } from "./ProvSelv";
import { regler } from "./Regler";
import { sammeUtkast } from "./SammeUtkast";
import { sammeVei } from "./SammeVei";
import { segmentering } from "./Segmentering";
import { slikVetVi } from "./SlikVetVi";
import { slutt } from "./Slutt";
import { sporsmaletFraForum } from "./SporsmaletFraForum";
import { sporsmalstyper } from "./Sporsmalstyper";
import { styrerDere } from "./StyrerDere";
import { surveyenSomKode } from "./SurveyenSomKode";
import {
  apning,
  fagsystemene,
  kapittelHvaErLumi,
  kapittelHvaKanDereGjore,
  kapittelKomIGang,
} from "./snokula/Snokula";
import { tallet } from "./Tallet";
import { ulikeBehov } from "./UlikeBehov";
import { underPanseret } from "./UnderPanseret";
import { utviklerensSteg } from "./UtviklerensSteg";
import { verktoySomFinnes } from "./VerktoySomFinnes";

/** Puts slides in a chapter, set as `data-kapittel` on each slide. */
function iKapittel(chapter: string, slides: readonly Slide[]): Slide[] {
  return slides.map((slide) => ({ ...slide, chapter }));
}

/**
 * Lumi, in the order of the story: the snow globe, what Lumi is, what you
 * can do with it, that it works, and how to start. `rooms` on a slide
 * decides which talks get it: `?rom=faggruppa`, `frontend` or
 * `produktledere`. The deck with every slide, from an old link with a
 * slide in the hash or from `?rom=alle`, leaves out the opening question,
 * which only makes sense live, so it starts on the snow globe.
 */
export const deckSlides: readonly Slide[] = [
  // Frontend forum and Produktlederakademiet: the question, before the cover.
  // Then the snow globe: the cover, and why Lumi.
  ...iKapittel("apning", [
    { ...sporsmaletFraForum, roomOnly: true },
    { ...verktoySomFinnes, roomOnly: true },
    apning,
    fagsystemene,
  ]),
  // What Lumi is, as a survey is made and answered: Surveyverksted, the
  // code, the app, the answer and the dashboard.
  ...iKapittel("lumi", [
    kapittelHvaErLumi,
    sammeUtkast,
    surveyenSomKode,
    utviklerensSteg,
    iAppen,
    sammeVei,
    merEnnViSporOm,
    fjernerEPosten,
    personvern,
    bareTeamet,
  ]),
  // What you can do with it.
  ...iKapittel("muligheter", [
    kapittelHvaKanDereGjore,
    hvaVilDereVite,
    sporsmalstyper,
    styrerDere,
    segmentering,
    brukesVidere,
    underPanseret,
    slikVetVi,
  ]),
  // It works.
  ...iKapittel("virker", [tallet, oppfolgingsplanenIntro, oppfolgingsplanen]),
  // How to start. The QR code stays up while people ask.
  ...iKapittel("i-gang", [
    kapittelKomIGang,
    ulikeBehov,
    regler,
    ansvar,
    komIGang,
    slutt,
    provSelv,
  ]),
];
