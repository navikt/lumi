import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import type { LumiSurveyConfig } from "../components/surveyTypes.js";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";

const CHAINED_SURVEY: LumiSurveyConfig = {
  type: "custom",
  questions: [
    {
      id: "opplevelse",
      type: "rating",
      prompt: "Hvordan opplevde du oppfølgingsplanen?",
      variant: "emoji",
      required: true,
    },
    {
      id: "hva-fungerte",
      type: "singleChoice",
      prompt: "Hva fungerte best?",
      required: true,
      options: [
        { value: "veiledning", label: "Veiledningen" },
        { value: "tidslinje", label: "Tidslinjen" },
        { value: "kommunikasjon", label: "Kommunikasjonen" },
        { value: "annet", label: "Annet" },
      ],
      visibleIf: {
        field: "ANSWER",
        questionId: "opplevelse",
        operator: "EXISTS",
      },
    },
    {
      id: "annet-detaljer",
      type: "text",
      prompt: "Beskriv hva som fungerte",
      required: true,
      maxLength: 500,
      minRows: 3,
      visibleIf: {
        field: "ANSWER",
        questionId: "hva-fungerte",
        operator: "EQ",
        value: "annet",
      },
    },
    {
      id: "forbedring",
      type: "text",
      prompt: "Hva kan forbedres?",
      required: false,
      maxLength: 500,
      minRows: 3,
      visibleIf: {
        field: "ANSWER",
        questionId: "hva-fungerte",
        operator: "EXISTS",
      },
    },
  ],
};

const BRANCHING_SURVEY: LumiSurveyConfig = {
  type: "custom",
  questions: [
    {
      id: "fornoyd",
      type: "rating",
      prompt: "Hvor fornøyd er du med oppfølgingsplanen?",
      variant: "emoji",
      required: true,
    },
    {
      id: "nyttig",
      type: "singleChoice",
      prompt: "Hva var mest nyttig?",
      required: true,
      options: [
        { value: "planstruktur", label: "Tydelig planstruktur" },
        { value: "varsler", label: "Varsler og påminnelser" },
        { value: "dialog", label: "Dialog med arbeidsgiver" },
        { value: "annet", label: "Annet" },
      ],
      visibleIf: {
        field: "ANSWER",
        questionId: "fornoyd",
        operator: "EXISTS",
      },
    },
    {
      id: "nyttig-annet",
      type: "text",
      prompt: "Beskriv hva som var mest nyttig",
      required: true,
      maxLength: 500,
      minRows: 3,
      visibleIf: {
        field: "ANSWER",
        questionId: "nyttig",
        operator: "EQ",
        value: "annet",
      },
    },
    {
      id: "hjelp",
      type: "singleChoice",
      prompt: "Fikk du den hjelpen du trengte?",
      required: true,
      options: [
        { value: "ja", label: "Ja" },
        { value: "delvis", label: "Delvis" },
        { value: "nei", label: "Nei" },
      ],
      visibleIf: {
        field: "ANSWER",
        questionId: "nyttig",
        operator: "EXISTS",
      },
    },
    {
      id: "manglet",
      type: "text",
      prompt: "Hva manglet?",
      required: true,
      maxLength: 500,
      minRows: 3,
      visibleIf: {
        field: "ANSWER",
        questionId: "hjelp",
        operator: "EQ",
        value: "nei",
      },
    },
    {
      id: "bedre",
      type: "text",
      prompt: "Hva kunne vært bedre?",
      required: true,
      maxLength: 500,
      minRows: 3,
      visibleIf: {
        field: "ANSWER",
        questionId: "hjelp",
        operator: "EQ",
        value: "delvis",
      },
    },
    {
      id: "annet-tilbakemelding",
      type: "text",
      prompt: "Andre tilbakemeldinger?",
      required: false,
      maxLength: 500,
      minRows: 3,
      visibleIf: {
        field: "ANSWER",
        questionId: "hjelp",
        operator: "EXISTS",
      },
    },
  ],
};

const meta: Meta<typeof LumiSurveyDock> = {
  title: "Components/LumiSurveyDock/Progress",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Stories for visuell testing av progress bar med chained visibleIf, intro og branching i step-layout.",
      },
    },
  },
  args: {
    surveyId: "storybook-dock-progress",
    survey: CHAINED_SURVEY,
    transport: SUCCESS_TRANSPORT,
  },
  argTypes: {
    transport: { control: false },
    survey: { control: false },
    events: { control: false },
    context: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof LumiSurveyDock>;

export const ChainedVisibleIf: Story = {
  name: "Chained VisibleIf",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-dock-progress-chained-no-intro",
    survey: CHAINED_SURVEY,
    behavior: {
      questionLayout: "steps",
      storageStrategy: "consent",
      showProgress: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Survey uten intro med chained visibleIf. Progress bar skal ikke vises på steg 0, men vises fra første spørsmål (steg 1).",
      },
    },
  },
};

export const MedIntroOgChainedVisibleIf: Story = {
  name: "Med intro og chained VisibleIf",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-dock-progress-chained-with-intro",
    survey: CHAINED_SURVEY,
    intro: {
      title: "Hjelp oss å forbedre oppfølgingsplanen",
      body: "Vi vil forstå hva som fungerer bra og hva som kan bli bedre. Svar gjerne på noen korte spørsmål.",
      startLabel: "Start",
    },
    behavior: {
      questionLayout: "steps",
      storageStrategy: "consent",
      showProgress: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Samme chained survey med intro. Progress bar skal vises fra steg 0 etter intro-skjermen.",
      },
    },
  },
};

export const LangSurveyMedBranching: Story = {
  name: "Lang survey med branching",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-dock-progress-branching",
    survey: BRANCHING_SURVEY,
    intro: {
      title: "Fortell oss om oppfølgingen",
      body: "Denne undersøkelsen har flere spor avhengig av svarene dine. Vi bruker den til å verifisere at progress bar holder seg stabil.",
      startLabel: "Start undersøkelse",
    },
    behavior: {
      questionLayout: "steps",
      storageStrategy: "consent",
      showProgress: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Lengre survey med flere branching-paths (ja/nei/delvis og annet). Brukes for å sjekke at progress bar ikke hopper eller oscillerer.",
      },
    },
  },
};
