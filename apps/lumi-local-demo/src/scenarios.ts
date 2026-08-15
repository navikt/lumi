import {
  createTaskPrioritySurvey,
  createTopTasksSurvey,
  DEFAULT_SURVEY_DISCOVERY,
  DEFAULT_SURVEY_NPS,
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_STARS,
  DEFAULT_SURVEY_THUMBS,
  type LumiSurveyConfig,
} from "@navikt/lumi-survey";

export interface DemoScenario {
  id: string;
  title: string;
  summary: string;
  coverage: string[];
  survey: LumiSurveyConfig;
}

const tasks = [
  { value: "apply", label: "Søke om en ytelse" },
  { value: "status", label: "Sjekke status" },
  { value: "message", label: "Sende en beskjed" },
  { value: "document", label: "Ettersende dokumentasjon" },
  { value: "payment", label: "Forstå en utbetaling" },
  { value: "change", label: "Melde fra om en endring" },
];

export const demoScenarios: DemoScenario[] = [
  {
    id: "rating-emoji",
    title: "Rating · emoji",
    summary: "Standard 1–5-opplevelse med progressiv fritekst.",
    coverage: ["rating", "emoji", "text", "visibleIf"],
    survey: DEFAULT_SURVEY_RATING,
  },
  {
    id: "rating-thumbs",
    title: "Rating · tommel",
    summary: "Binært hjelpsomhetsspørsmål med oppfølging.",
    coverage: ["rating", "thumbs", "text"],
    survey: DEFAULT_SURVEY_THUMBS,
  },
  {
    id: "rating-stars",
    title: "Rating · stjerner",
    summary: "Fem stjerner og valgfri begrunnelse.",
    coverage: ["rating", "stars", "text"],
    survey: DEFAULT_SURVEY_STARS,
  },
  {
    id: "rating-nps",
    title: "Rating · NPS",
    summary: "0–10-skala med endeetiketter.",
    coverage: ["rating", "nps", "text"],
    survey: DEFAULT_SURVEY_NPS,
  },
  {
    id: "discovery",
    title: "Discovery",
    summary: "Oppgave i fritekst, gjennomføring og eventuell hindring.",
    coverage: ["discovery", "text", "singleChoice"],
    survey: DEFAULT_SURVEY_DISCOVERY,
  },
  {
    id: "top-tasks",
    title: "Top Tasks",
    summary: "Forgrenet oppgavevalg med annet-felt og tidlig submit.",
    coverage: ["topTasks", "singleChoice", "logic", "text"],
    survey: createTopTasksSurvey({
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
    survey: createTaskPrioritySurvey({
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
    survey: createTaskPrioritySurvey({
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
      type: "custom",
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
  },
];
