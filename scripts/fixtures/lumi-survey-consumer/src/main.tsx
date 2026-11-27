import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import {
  classifyDeviceTypeByViewport,
  LumiSurveyDock,
  LumiSurveyHttpError,
  LumiSurveyInline,
  type LumiSurveyInlineBehavior,
  type LumiSurveyInlineProps,
  type LumiSurveyInlineStyle,
  type LumiSurveyTransport,
  resolveDocumentVisibility,
  type SurveyDocumentV1,
  type SurveyQuestionV1,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import {
  LumiSurveyDock as ClientEntryDock,
  LumiSurveyInline as ClientEntryInline,
} from "@navikt/lumi-survey/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const survey = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "experience",
      questions: [
        {
          id: "rating",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var opplevelsen?",
          required: true,
        },
        {
          id: "details",
          type: "text",
          prompt: "Fortell mer",
          visibleIf: { questionId: "rating", operator: "EXISTS" },
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

validateSurveyDocumentV1(survey);

// A preview can tell which questions a document shows, from the questions of
// a SurveyDocumentV1 as they are, also a condition on metadata without value.
const previewed: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  pages: [
    {
      id: "page",
      questions: [
        {
          id: "on-phones",
          type: "text",
          prompt: "Hvordan var det på mobil?",
          visibleIf: {
            field: "METADATA",
            key: "deviceType",
            operator: "EQ",
            value: "mobile",
          },
        },
        {
          id: "tagged",
          type: "text",
          prompt: "Hvordan var resultatlisten?",
          visibleIf: {
            field: "METADATA",
            key: "placement",
            operator: "EXISTS",
          },
        },
      ],
    },
  ],
};
const shown: SurveyQuestionV1[] = resolveDocumentVisibility(
  previewed.pages.flatMap((page) => page.questions),
  {},
  { deviceType: classifyDeviceTypeByViewport(360), placement: "under-content" },
).visibleQuestions;
if (shown.length !== 2) throw new Error("Forventet to synlige spørsmål");

const transport: LumiSurveyTransport = {
  submit: async ({ transportPayload }, options) => {
    if (transportPayload.schemaVersion !== 2) {
      throw new Error("Forventet submission schema v2");
    }
    const response = await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transportPayload),
      signal: options?.signal ?? null,
    });
    if (!response.ok) {
      throw LumiSurveyHttpError.fromResponse(response);
    }
  },
};

const inlineBehavior = {
  questionLayout: "singlePage",
  showProgress: true,
} satisfies LumiSurveyInlineBehavior;

const inlineStyle = {
  panelBackground: "neutral-soft",
} satisfies LumiSurveyInlineStyle;

const inlineProps = {
  surveyId: "packed-consumer-inline",
  survey,
  transport,
  behavior: inlineBehavior,
  style: inlineStyle,
  headingLevel: "3",
  context: { tags: { surface: "inline", placement: "under-content" } },
} satisfies LumiSurveyInlineProps;

const root = document.getElementById("root");
if (!root) throw new Error("Mangler #root");

createRoot(root).render(
  <StrictMode>
    <LumiSurveyDock
      surveyId="packed-consumer-verification"
      survey={survey}
      transport={transport}
      behavior={{ initialOpen: true, storageStrategy: "none" }}
    />
    {/* The "use client" entry for React Server Components resolves too. */}
    <ClientEntryDock
      surveyId="packed-consumer-endpoint"
      survey={survey}
      transport={{ endpoint: "/api/lumi/feedback" }}
      behavior={{ initialOpen: false, storageStrategy: "none" }}
    />
    {/* A survey in the page flow, from both entries. */}
    <LumiSurveyInline {...inlineProps} />
    <ClientEntryInline
      surveyId="packed-consumer-inline-endpoint"
      survey={survey}
      transport={{ endpoint: "/api/lumi/feedback" }}
    />
  </StrictMode>,
);
