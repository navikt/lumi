import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import {
  LumiSurveyDock,
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
  submit: async ({ transportPayload }) => {
    if (transportPayload.schemaVersion !== 2) {
      throw new Error("Forventet submission schema v2");
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
