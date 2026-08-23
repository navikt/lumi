import {
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
  DEFAULT_RATING_SURVEY_DOCUMENT,
  type LumiSurveyConfig,
  type LumiSurveyQuestionType,
  type MultiChoiceVariant,
  type RatingVariant,
  type SurveyDocumentV1,
  type SurveyQuestionV1,
  type SurveyType,
} from "@navikt/lumi-survey";

export type SurveyAuthoringFormat = "legacy-flat" | "document-v1";

interface DemoScenarioBase {
  id: string;
  title: string;
  summary: string;
  coverage: string[];
}

export type DemoScenario =
  | (DemoScenarioBase & {
      authoringFormat: "legacy-flat";
      survey: LumiSurveyConfig;
    })
  | (DemoScenarioBase & {
      authoringFormat: "document-v1";
      survey: SurveyDocumentV1;
    });

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

const legacyFlatRatingSurvey = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var opplevelsen?",
      required: true,
    },
    {
      id: "feedback",
      type: "text",
      prompt: "Hva bør vi forbedre?",
      maxLength: 500,
      visibleIf: { questionId: "rating", operator: "EXISTS" },
    },
  ],
} satisfies LumiSurveyConfig;

function defineDemoScenarios<const Id extends string>(
  scenarios: Array<DemoScenario & { id: Id }>,
): Array<DemoScenario & { id: Id }> {
  return scenarios;
}

export const demoScenarios = defineDemoScenarios([
  {
    id: "rating-emoji",
    authoringFormat: "document-v1",
    title: "Rating · emoji",
    summary: "Standard 1–5-opplevelse med progressiv fritekst.",
    coverage: ["rating", "emoji", "text", "visibleIf"],
    survey: DEFAULT_RATING_SURVEY_DOCUMENT,
  },
  {
    id: "legacy-flat-rating",
    authoringFormat: "legacy-flat",
    title: "Rating · eksisterende flat konfigurasjon",
    summary:
      "Kompatibilitetsspor for eksisterende LumiSurveyConfig; ikke anbefalt for nye surveyer.",
    coverage: ["rating", "emoji", "text", "visibleIf"],
    survey: legacyFlatRatingSurvey,
  },
  {
    id: "rating-thumbs",
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
    title: "Discovery",
    summary: "Oppgave i fritekst, gjennomføring og eventuell hindring.",
    coverage: ["discovery", "text", "singleChoice"],
    survey: DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
  },
  {
    id: "top-tasks",
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
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
    authoringFormat: "document-v1",
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
]);

export type DemoScenarioId = (typeof demoScenarios)[number]["id"];

interface SurveyContractCoverage {
  authoringFormats: Record<SurveyAuthoringFormat, DemoScenarioId[]>;
  surveyTypes: Record<SurveyType, DemoScenarioId[]>;
  questionTypes: Record<LumiSurveyQuestionType, DemoScenarioId[]>;
  ratingVariants: Record<RatingVariant, DemoScenarioId[]>;
  multiChoiceVariants: Record<MultiChoiceVariant, DemoScenarioId[]>;
}

/**
 * Derived inventory for the public survey contract. The explicit empty
 * buckets make new public union members a compile error; the runtime guard
 * requires every member to occur in a rendered full-chain scenario.
 */
export const surveyContractCoverage = buildSurveyContractCoverage();

function buildSurveyContractCoverage(): SurveyContractCoverage {
  const coverage: SurveyContractCoverage = {
    authoringFormats: { "legacy-flat": [], "document-v1": [] },
    surveyTypes: {
      rating: [],
      topTasks: [],
      discovery: [],
      taskPriority: [],
      custom: [],
    },
    questionTypes: {
      rating: [],
      text: [],
      singleChoice: [],
      multiChoice: [],
    },
    ratingVariants: { emoji: [], thumbs: [], stars: [], nps: [] },
    multiChoiceVariants: { checkbox: [], combobox: [] },
  };

  for (const scenario of demoScenarios) {
    addScenario(
      coverage.authoringFormats[scenario.authoringFormat],
      scenario.id,
    );
    addScenario(
      coverage.surveyTypes[scenario.survey.type ?? "custom"],
      scenario.id,
    );
    const questions =
      scenario.authoringFormat === "legacy-flat"
        ? scenario.survey.questions
        : scenario.survey.pages.flatMap((page) => page.questions);

    for (const question of questions) {
      addScenario(coverage.questionTypes[question.type], scenario.id);
      if (question.type === "rating") {
        addScenario(
          coverage.ratingVariants[question.variant ?? "emoji"],
          scenario.id,
        );
      }
      if (question.type === "multiChoice") {
        addScenario(
          coverage.multiChoiceVariants[question.variant ?? "checkbox"],
          scenario.id,
        );
      }
    }
  }

  assertEveryMemberCovered("authoringFormats", coverage.authoringFormats);
  assertEveryMemberCovered("surveyTypes", coverage.surveyTypes);
  assertEveryMemberCovered("questionTypes", coverage.questionTypes);
  assertEveryMemberCovered("ratingVariants", coverage.ratingVariants);
  assertEveryMemberCovered("multiChoiceVariants", coverage.multiChoiceVariants);
  return coverage;
}

function addScenario(
  scenarioIds: DemoScenarioId[],
  scenarioId: DemoScenarioId,
): void {
  if (!scenarioIds.includes(scenarioId)) {
    scenarioIds.push(scenarioId);
  }
}

function assertEveryMemberCovered<Member extends string>(
  category: string,
  members: Record<Member, DemoScenarioId[]>,
): void {
  for (const member in members) {
    if (members[member].length === 0) {
      throw new Error(`Mangler full-chain-scenario for ${category}.${member}`);
    }
  }
}
