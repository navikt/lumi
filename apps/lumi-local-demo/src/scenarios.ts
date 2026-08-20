import {
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
  DEFAULT_RATING_SURVEY_DOCUMENT,
  type LumiSurveyDefinition,
  type SurveyDocumentV1,
  type SurveyQuestionV1,
} from "@navikt/lumi-survey";

export interface DemoScenario {
  id: string;
  title: string;
  summary: string;
  coverage: string[];
  survey: LumiSurveyDefinition;
}

const tasks = [
  { value: "apply", label: "Søke om en ytelse" },
  { value: "status", label: "Sjekke status" },
  { value: "message", label: "Sende en beskjed" },
  { value: "document", label: "Ettersende dokumentasjon" },
  { value: "payment", label: "Forstå en utbetaling" },
  { value: "change", label: "Melde fra om en endring" },
];

function ratingDocument(
  id: string,
  firstQuestion: SurveyQuestionV1,
  ...followUps: SurveyQuestionV1[]
): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: "rating",
    pages: [{ id, questions: [firstQuestion, ...followUps] }],
  };
}

export const demoScenarios: DemoScenario[] = [
  {
    id: "rating-emoji",
    title: "Rating · emoji",
    summary: "Standard 1–5-opplevelse med progressiv fritekst.",
    coverage: ["rating", "emoji", "text", "visibleIf"],
    survey: DEFAULT_RATING_SURVEY_DOCUMENT,
  },
  {
    id: "rating-thumbs",
    title: "Rating · tommel",
    summary: "Binært hjelpsomhetsspørsmål med oppfølging.",
    coverage: ["rating", "thumbs", "text"],
    survey: ratingDocument(
      "helpful",
      {
        id: "helpful",
        type: "rating",
        variant: "thumbs",
        prompt: "Var dette til hjelp?",
        required: true,
      },
      {
        id: "feedback",
        type: "text",
        prompt: "Har du forslag til forbedringer?",
        required: false,
        maxLength: 500,
        visibleIf: { questionId: "helpful", operator: "EXISTS" },
      },
    ),
  },
  {
    id: "rating-stars",
    title: "Rating · stjerner",
    summary: "Fem stjerner og valgfri begrunnelse.",
    coverage: ["rating", "stars", "text"],
    survey: ratingDocument(
      "stars",
      {
        id: "stars",
        type: "rating",
        variant: "stars",
        prompt: "Hvordan opplevde du å bruke tjenesten?",
        required: true,
      },
      {
        id: "feedback",
        type: "text",
        prompt: "Legg gjerne til en begrunnelse",
        required: false,
        maxLength: 1000,
        visibleIf: { questionId: "stars", operator: "EXISTS" },
      },
    ),
  },
  {
    id: "rating-nps",
    title: "Rating · NPS",
    summary: "0–10-skala med endeetiketter.",
    coverage: ["rating", "nps", "text"],
    survey: ratingDocument(
      "nps",
      {
        id: "nps",
        type: "rating",
        variant: "nps",
        prompt:
          "Hvor sannsynlig er det at du vil anbefale denne tjenesten til en venn eller kollega?",
        lowLabel: "Lite sannsynlig",
        highLabel: "Svært sannsynlig",
        required: true,
      },
      {
        id: "reason",
        type: "text",
        prompt: "Legg gjerne til en begrunnelse",
        required: false,
        maxLength: 500,
        visibleIf: { questionId: "nps", operator: "EXISTS" },
      },
    ),
  },
  {
    id: "discovery",
    title: "Discovery",
    summary: "Oppgave i fritekst, gjennomføring og eventuell hindring.",
    coverage: ["discovery", "text", "singleChoice"],
    survey: DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
  },
  {
    id: "top-tasks",
    title: "Top Tasks",
    summary: "Sidebasert oppgavevalg med annet-felt og relevante oppfølginger.",
    coverage: ["topTasks", "singleChoice", "visibleIf", "pages", "text"],
    survey: createTopTasksSurveyDocument({
      tasks,
      includeOtherTask: true,
      includeBlockerQuestion: true,
    }),
  },
  {
    id: "task-priority-checkbox",
    title: "Task Priority · avkryssing",
    summary: "Flervalg i kompakt checkbox-variant.",
    coverage: ["taskPriority", "multiChoice", "checkbox"],
    survey: createTaskPrioritySurveyDocument({
      tasks,
      maxSelections: 3,
      randomize: false,
      variant: "checkbox",
    }),
  },
  {
    id: "task-priority-combobox",
    title: "Task Priority · komboboks",
    summary: "Søkbar flervalgsliste med chips.",
    coverage: ["taskPriority", "multiChoice", "combobox"],
    survey: createTaskPrioritySurveyDocument({
      tasks,
      maxSelections: 3,
      randomize: false,
      variant: "combobox",
    }),
  },
  {
    id: "custom-field-matrix",
    title: "Custom · feltmatrise",
    summary: "Alle generiske felttyper i én eksplisitt stegflyt.",
    coverage: ["custom", "text", "singleChoice", "multiChoice"],
    survey: {
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "field-matrix",
          questions: [
            {
              id: "customText",
              type: "text",
              prompt: "Hva vil du teste i dag?",
              placeholder: "Skriv en kort testmerknad",
              maxLength: 300,
              required: true,
            },
            {
              id: "customSingle",
              type: "singleChoice",
              prompt: "Velg én kanal",
              options: [
                { value: "web", label: "Web" },
                { value: "phone", label: "Telefon" },
                { value: "office", label: "Kontor" },
              ],
              required: true,
            },
            {
              id: "customMulti",
              type: "multiChoice",
              variant: "checkbox",
              prompt: "Velg én eller flere egenskaper",
              options: [
                { value: "clear", label: "Tydelig" },
                { value: "fast", label: "Rask" },
                { value: "safe", label: "Trygg" },
              ],
              required: true,
            },
          ],
        },
      ],
    },
  },
  {
    id: "pages-multi-question",
    title: "Pages · flere spørsmål",
    summary:
      "To eksplisitte sider med samlet validering og betinget felt på siste side.",
    coverage: ["SurveyDocumentV1", "pages", "multi-question", "visibleIf"],
    survey: {
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "experience",
          title: "Om opplevelsen",
          description: "Begge spørsmålene valideres før du går videre.",
          questions: [
            {
              id: "pageRating",
              type: "rating",
              variant: "stars",
              prompt: "Hvor fornøyd er du med testflyten?",
              required: true,
            },
            {
              id: "pageReason",
              type: "text",
              prompt: "Hva la du særlig merke til?",
              placeholder: "Skriv en kort testmerknad",
              maxLength: 300,
              required: true,
            },
          ],
        },
        {
          id: "follow-up",
          title: "Oppfølging",
          description: "Det siste feltet vises bare når du velger ja.",
          questions: [
            {
              id: "pageFollowUp",
              type: "singleChoice",
              prompt: "Vil du beskrive noe vi bør forbedre?",
              options: [
                { value: "yes", label: "Ja" },
                { value: "no", label: "Nei" },
              ],
              required: true,
            },
            {
              id: "pageImprovement",
              type: "text",
              prompt: "Hva bør vi forbedre?",
              maxLength: 500,
              required: true,
              visibleIf: {
                questionId: "pageFollowUp",
                operator: "EQ",
                value: "yes",
              },
            },
          ],
        },
      ],
    },
  },
];
