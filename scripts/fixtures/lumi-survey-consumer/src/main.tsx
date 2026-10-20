import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import {
  LumiSurveyDock,
  LumiSurveyHttpError,
  type LumiSurveyTransport,
  type SurveyDocumentV1,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
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
  </StrictMode>,
);
