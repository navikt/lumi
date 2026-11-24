import { ROOMS, type Room, type Slide } from "../../engine";
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
import { serverkoden } from "./Serverkoden";
import { slikVetVi } from "./SlikVetVi";
import { slutt } from "./Slutt";
import { sporsmalstyper } from "./Sporsmalstyper";
import { styrerDere } from "./StyrerDere";
import { surveyenSomKode } from "./SurveyenSomKode";
import {
  apning,
  fagsystemene,
  kapittelHvaErLumi,
  kapittelHvaKanDereGjore,
} from "./snokula/Snokula";
import { tallet } from "./Tallet";
import { tanstackStart } from "./TanstackStart";
import { ulikeBehov } from "./UlikeBehov";
import { underPanseret } from "./UnderPanseret";
import { utviklerensSteg } from "./UtviklerensSteg";
import { verktoySomFinnes } from "./VerktoySomFinnes";

/** Puts slides in a chapter, set as `data-kapittel` on each slide. */
function iKapittel(chapter: string, slides: readonly Slide[]): Slide[] {
  return slides.map((slide) => ({ ...slide, chapter }));
}

/**
 * Leaves a slide out of the talks named. Other rooms that had the slide
 * keep it, so a slide left out of every room it had, like `fagsystemene`,
 * is left only in the deck with every slide.
 */
function utenom(left: readonly Room[], slide: Slide): Slide {
  const rooms = (slide.rooms ?? ROOMS).filter((room) => !left.includes(room));
  return { ...slide, rooms };
}

/**
 * The same slide at another place in one talk. It has its own id there,
 * and stays out of the deck with every slide, which has the slide already.
 */
function flyttetFor(room: Room, id: string, slide: Slide): Slide {
  return { ...slide, id, rooms: [room], roomOnly: true };
}

/**
 * Lumi, in the order of the story: the snow globe, what Lumi is, what you
 * can do with it, that it works, and how to start. `rooms` on a slide
 * decides which talks get it: `?rom=faggruppa`, `frontend` or
 * `produktledere`. Without `?rom` the deck is the talk for faggruppa. An
 * unknown room, like `?rom=alle`, shows every slide except the opening
 * question, which only makes sense live, so it starts on the snow globe.
 *
 * Frontend forum gets the talk for faggruppa, from the same cover, and a
 * little more: what the team decides in the widget, how the developer
 * takes the survey in, and why the dashboard is built with TanStack Start.
 */
export const deckSlides: readonly Slide[] = [
  // Produktlederakademiet: the question, before the cover. Then the snow
  // globe: the cover, and why Lumi.
  ...iKapittel("apning", [
    { ...verktoySomFinnes, roomOnly: true },
    apning,
    utenom(["faggruppa"], fagsystemene),
  ]),
  // What Lumi is: the map of its parts, then a survey as it is made and
  // answered, in the map's order: Surveyverksted and the question types,
  // the code, the app, the answer and the dashboard. Frontend forum gets
  // what the team decides in the widget here, right after the types.
  ...iKapittel("lumi", [
    kapittelHvaErLumi,
    delene,
    sammeUtkast,
    sporsmalstyper,
    flyttetFor("frontend", "hva-kan-dere-endre", styrerDere),
    surveyenSomKode,
    utviklerensSteg,
    iAppen,
    utenom(["frontend"], sammeVei),
    merEnnViSporOm,
    fjernerEPosten,
    personvern,
    bareTeamet,
  ]),
  // What you can do with it. Frontend forum gets why the dashboard is
  // built with TanStack Start instead. The code behind it is in no room.
  ...iKapittel("muligheter", [
    utenom(["faggruppa", "frontend"], kapittelHvaKanDereGjore),
    utenom(["faggruppa", "frontend"], hvaVilDereVite),
    utenom(["faggruppa", "frontend"], styrerDere),
    segmentering,
    tanstackStart,
    utenom(["frontend"], serverkoden),
    utenom(["frontend"], brukesVidere),
    utenom(["frontend"], underPanseret),
    utenom(["frontend"], slikVetVi),
  ]),
  // It works. Frontend forum sees what is out now in the demo instead.
  ...iKapittel("virker", [
    utenom(["faggruppa", "frontend"], tallet),
    utenom(["faggruppa", "frontend"], oppfolgingsplanenIntro),
    utenom(["faggruppa", "frontend"], oppfolgingsplanen),
  ]),
  // How to start, on one slide. The last slide stays up while people ask.
  ...iKapittel("i-gang", [
    utenom(["frontend"], ulikeBehov),
    utenom(["faggruppa", "frontend"], regler),
    utenom(["faggruppa", "frontend"], ansvar),
    komIGang,
    slutt,
    utenom(["frontend"], provSelv),
  ]),
];
