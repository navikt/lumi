import type { Slide } from "../../engine";
import { ForumSporsmal } from "./VerktoySomFinnes";

/** Frontend forum: the question opens the talk, and the snow globe answers it. */
export const sporsmaletFraForum: Slide = {
  id: "sporsmalet",
  title: "Hvorfor ikke bare bruke et verktøy som finnes?",
  rooms: ["frontend"],
  Component: ForumSporsmal,
};
