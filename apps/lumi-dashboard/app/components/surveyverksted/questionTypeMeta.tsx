import {
  CheckmarkCircleIcon,
  FaceSmileIcon,
  NumberListIcon,
  PencilWritingIcon,
  StarIcon,
  TasklistIcon,
  ThumbUpIcon,
} from "@navikt/aksel-icons";
import type { SurveyQuestionV1 } from "@navikt/lumi-survey";
import type { ComponentType } from "react";
import type { QuestionTypeId } from "~/utils/surveyDocument";

interface QuestionTypeMeta {
  id: QuestionTypeId;
  label: string;
  description: string;
  Icon: ComponentType<{ "aria-hidden"?: boolean; fontSize?: string }>;
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  {
    id: "rating",
    label: "Vurdering",
    description: "Svar på en skala med emoji, tommel, stjerner eller NPS",
    Icon: FaceSmileIcon,
  },
  {
    id: "text",
    label: "Fritekst",
    description: "Åpne svar med brukerens egne ord",
    Icon: PencilWritingIcon,
  },
  {
    id: "singleChoice",
    label: "Enkeltvalg",
    description: "Ett svar fra en liste med alternativer",
    Icon: CheckmarkCircleIcon,
  },
  {
    id: "multiChoice",
    label: "Flervalg",
    description: "Flere svar fra en liste med alternativer",
    Icon: TasklistIcon,
  },
];

export function questionTypeMeta(type: QuestionTypeId): QuestionTypeMeta {
  const meta = QUESTION_TYPES.find((candidate) => candidate.id === type);
  if (!meta) throw new Error(`Ukjent spørsmålstype: ${type}`);
  return meta;
}

export type RatingVariantId = "emoji" | "thumbs" | "stars" | "nps";

export const RATING_VARIANTS: {
  id: RatingVariantId;
  label: string;
  Icon: ComponentType<{ "aria-hidden"?: boolean }>;
}[] = [
  { id: "emoji", label: "Emoji", Icon: FaceSmileIcon },
  { id: "thumbs", label: "Tommel", Icon: ThumbUpIcon },
  { id: "stars", label: "Stjerner", Icon: StarIcon },
  { id: "nps", label: "NPS", Icon: NumberListIcon },
];

export function describeQuestion(question: SurveyQuestionV1): string {
  if (question.type === "rating") {
    const variant = RATING_VARIANTS.find(
      (candidate) => candidate.id === (question.variant ?? "emoji"),
    );
    return `${questionTypeMeta("rating").label} · ${variant?.label ?? "Emoji"}`;
  }
  if (question.type === "singleChoice" || question.type === "multiChoice") {
    const presentation =
      question.type === "multiChoice" && question.variant === "combobox"
        ? "Søkbart felt"
        : undefined;
    return [
      questionTypeMeta(question.type).label,
      presentation,
      `${question.options.length} alternativer`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return questionTypeMeta(question.type).label;
}
