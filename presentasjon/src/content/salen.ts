import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

/**
 * The survey the room answers on the opening slide, and the one on the
 * phone page. Defined once so both show the same thing.
 */
export const SALEN_SURVEY: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "dagen",
      questions: [
        {
          id: "dagen",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan har dagen vært så langt?",
          required: true,
        },
        {
          id: "mer",
          type: "text",
          prompt: "Vil du fortelle mer?",
          required: false,
          maxLength: 500,
          visibleIf: { questionId: "dagen", operator: "EXISTS" },
        },
      ],
    },
  ],
};

/** The phone page. The QR code on the «Prøv selv» slide leads here. */
export const TRIAL_URL = "https://navikt.github.io/lumi/presentasjon/?prov";
