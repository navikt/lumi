import "./slides.css";
import type { Slide } from "../engine";
import { deckSlides } from "./deck";

/** The deck, in order. */
export const slides: readonly Slide[] = deckSlides;
