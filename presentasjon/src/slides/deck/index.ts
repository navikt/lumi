import { ROOMS, type Slide } from "../../engine";
import { ansvar } from "./Ansvar";
import { bareTeamet } from "./BareTeamet";
import { brukesVidere } from "./BrukesVidere";
import { delene } from "./Delene";
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
 * Left out of the talk for faggruppa, the one the address without `?rom`
 * shows. Other rooms that had the slide keep it, so a slide only for
 * faggruppa, like `fagsystemene`, is left only in the deck with every slide.
 */
function utenFaggruppa(slide: Slide): Slide {
  const rooms = (slide.rooms ?? ROOMS).filter((room) => room !== "faggruppa");
  return { ...slide, rooms };
}

/**
 * Lumi, in the order of the story: the snow globe, what Lumi is, what you
 * can do with it, that it works, and how to start. `rooms` on a slide
 * decides which talks get it: `?rom=faggruppa`, `frontend` or
 * `produktledere`. Without `?rom` the deck is the talk for faggruppa. An
 * unknown room, like `?rom=alle`, shows every slide except the opening
 * question, which only makes sense live, so it starts on the snow globe.
 */
export const deckSlides: readonly Slide[] = [
  // Frontend forum and Produktlederakademiet: the question, before the cover.
  // Then the snow globe: the cover, and why Lumi.
  ...iKapittel("apning", [
    { ...sporsmaletFraForum, roomOnly: true },
    { ...verktoySomFinnes, roomOnly: true },
    apning,
    utenFaggruppa(fagsystemene),
  ]),
  // What Lumi is: the map of its parts, then a survey as it is made and
  // answered, in the map's order: Surveyverksted and the question types,
  // the code, the app, the answer and the dashboard.
  ...iKapittel("lumi", [
    kapittelHvaErLumi,
    delene,
    sammeUtkast,
    sporsmalstyper,
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
    utenFaggruppa(kapittelHvaKanDereGjore),
    utenFaggruppa(hvaVilDereVite),
    utenFaggruppa(styrerDere),
    segmentering,
    brukesVidere,
    underPanseret,
    slikVetVi,
  ]),
  // It works.
  ...iKapittel("virker", [
    utenFaggruppa(tallet),
    utenFaggruppa(oppfolgingsplanenIntro),
    utenFaggruppa(oppfolgingsplanen),
  ]),
  // How to start. The last slide stays up while people ask.
  ...iKapittel("i-gang", [
    kapittelKomIGang,
    ulikeBehov,
    utenFaggruppa(regler),
    utenFaggruppa(ansvar),
    komIGang,
    slutt,
    provSelv,
  ]),
];
