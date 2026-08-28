import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import {
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
} from "../presets/index.js";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";

// Example tasks for Storybook Top Tasks surveys (8 items per Gerry McGovern methodology)
const TOP_TASKS = [
  { value: "lese-om-dialogmote", label: "Lese om dialogmøte" },
  { value: "melde-motebehov", label: "Melde behov for møte" },
  { value: "svare-pa-innkalling", label: "Svare på innkalling" },
  { value: "sjekke-status", label: "Sjekke status på sak" },
  { value: "laste-opp-dokument", label: "Laste opp dokumentasjon" },
  { value: "se-tidligere-mote", label: "Se tidligere møtereferater" },
  { value: "endre-tidspunkt", label: "Endre møtetidspunkt" },
  { value: "kontakte-nav", label: "Kontakte NAV om møtet" },
];

// Example Task Priority list for Storybook (McGovern methodology)
const TASK_PRIORITY_TASKS = [
  // TOP TASKS (will get ~60% of all votes combined - the "Long Neck")
  { value: "sjekke-utbetaling", label: "Sjekke utbetalinger" },
  { value: "sok-dagpenger", label: "Søke dagpenger" },
  { value: "melde-sykefravaer", label: "Melde sykefravær" },
  { value: "sjekke-status", label: "Sjekke søknadsstatus" },

  // MEDIUM TASKS (next ~25%)
  { value: "meldekort", label: "Sende meldekort" },
  { value: "finne-skjema", label: "Finne riktig skjema" },
  { value: "kontakte-nav", label: "Kontakte NAV" },
  { value: "lese-rettigheter", label: "Lese om mine rettigheter" },

  // TINY TASKS (the long tail - ~15% combined)
  { value: "endre-kontonummer", label: "Endre kontonummer" },
  { value: "bestille-legeerklaring", label: "Bestille legeerklæring" },
  { value: "se-vedtak", label: "Se vedtak" },
  { value: "klage-vedtak", label: "Klage på vedtak" },
  { value: "sok-foreldrepenger", label: "Søke foreldrepenger" },
  { value: "aktivitetsplan", label: "Oppdatere aktivitetsplan" },
  { value: "cv-registrering", label: "Registrere CV" },
];

const TOP_TASKS_SURVEY = createTopTasksSurveyDocument({
  tasks: TOP_TASKS,
  includeBlockerQuestion: true,
  includeOtherTask: true,
});

const TASK_PRIORITY_SURVEY = createTaskPrioritySurveyDocument({
  tasks: TASK_PRIORITY_TASKS,
  maxSelections: 5,
});

const meta: Meta<typeof LumiSurveyDock> = {
  id: "components-lumisurveydock-tasks",
  title: "Surveytyper/Discovery og oppgaver",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Sidebaserte SurveyDocumentV1-maler med faste felt-ID-er for Lumi-dashboardets spesialiserte analyser.",
      },
    },
  },
  args: {
    surveyId: "storybook-dock",
    survey: DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
    transport: SUCCESS_TRANSPORT,
  },
  argTypes: {
    transport: { control: false },
    survey: { control: false },
    events: { control: false },
    context: { control: false },
    intro: { control: false },
    success: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof LumiSurveyDock>;

export const Discovery: Story = {
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "nav-no-forside-discovery",
    survey: DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Sidebasert discovery-dokument med de faste felt-ID-ene som Lumi-dashboardets discovery-analyse forventer.",
      },
    },
  },
};

export const TaskPriority: Story = {
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "minside-arbeidsgiver-priority",
    survey: TASK_PRIORITY_SURVEY,
  },
  parameters: {
    docs: {
      description: {
        story:
          "McGovern Task Priority-undersøkelse. Brukere velger sine viktigste oppgaver. Bruker `createTaskPrioritySurveyDocument`.",
      },
    },
  },
};

export const TopTasks: Story = {
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "sykefravaer-oppgaver-toptasks",
    survey: TOP_TASKS_SURVEY,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Top Tasks-undersøkelse for å måle suksessrate på oppgaver. Bruker `createTopTasksSurveyDocument` med oppgaveliste.",
      },
    },
  },
};
