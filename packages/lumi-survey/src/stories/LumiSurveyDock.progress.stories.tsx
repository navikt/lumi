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

const OPPFOLGINGSPLAN_SM_SURVEY: LumiSurveyConfig = {
  type: "custom",
  questions: [
    {
      id: "opplevelse",
      type: "rating",
      variant: "emoji",
      required: true,
      prompt: "Hvordan opplevde du å lage oppfølgingsplanen med lederen din?",
      description:
        "Vi vil gjerne vite mer om opplevelsen din. Svarene er anonyme.",
    },
    {
      id: "samarbeid",
      type: "singleChoice",
      required: true,
      prompt: "Hvordan samarbeidet dere om å lage oppfølgingsplanen?",
      visibleIf: {
        field: "ANSWER",
        questionId: "opplevelse",
        operator: "EXISTS",
      },
      options: [
        { value: "sammen", label: "Vi satt sammen og lagde den" },
        {
          value: "snakket",
          label: "Vi snakket sammen, og lederen skrev den etterpå",
        },
        {
          value: "uten-meg",
          label: "Lederen lagde den uten at vi snakket om den",
        },
        { value: "annet", label: "Annet" },
      ],
    },
    {
      id: "samarbeid-annet",
      type: "text",
      prompt: "Fortell gjerne mer",
      required: false,
      minRows: 2,
      maxLength: 500,
      visibleIf: {
        field: "ANSWER",
        questionId: "samarbeid",
        operator: "EQ",
        value: "annet",
      },
    },
    {
      id: "behov",
      type: "rating",
      variant: "emoji",
      required: true,
      prompt: "Tar planen opp det som er viktig for deg?",
      description:
        "For eksempel tilrettelegging, arbeidstid eller arbeidsoppgaver",
      visibleIf: {
        field: "ANSWER",
        questionId: "samarbeid",
        operator: "EXISTS",
      },
    },
    {
      id: "hva-savner-du",
      type: "text",
      prompt: "Hva savner du i planen?",
      required: false,
      minRows: 2,
      maxLength: 500,
      visibleIf: {
        field: "ANSWER",
        questionId: "behov",
        operator: "LT",
        value: 4,
      },
    },
    {
      id: "hva-fungerer",
      type: "text",
      prompt: "Hva fungerer bra?",
      required: false,
      minRows: 2,
      maxLength: 500,
      visibleIf: {
        field: "ANSWER",
        questionId: "behov",
        operator: "GT",
        value: 3,
      },
    },
    {
      id: "deling-kunnskap",
      type: "singleChoice",
      required: true,
      prompt: "Visste du at lederen din kan dele planen med lege og Nav?",
      visibleIf: {
        field: "ANSWER",
        questionId: "behov",
        operator: "EXISTS",
      },
      options: [
        { value: "ja", label: "Ja" },
        { value: "nei", label: "Nei" },
        { value: "usikker", label: "Usikker" },
      ],
    },
    {
      id: "deling-holdning",
      type: "singleChoice",
      required: true,
      prompt:
        "Lederen din kan dele planen med lege og Nav uten at du godkjenner den. Hvor greit er dette for deg?",
      visibleIf: {
        field: "ANSWER",
        questionId: "deling-kunnskap",
        operator: "EXISTS",
      },
      options: [
        { value: "helt-greit", label: "Helt greit" },
        { value: "ganske-greit", label: "Ganske greit" },
        { value: "verken-eller", label: "Verken eller" },
        { value: "lite-greit", label: "Lite greit" },
        { value: "ikke-greit", label: "Ikke greit" },
      ],
    },
    {
      id: "forbedring",
      type: "singleChoice",
      required: false,
      prompt: "Hva ville vært viktigst for deg?",
      visibleIf: {
        field: "ANSWER",
        questionId: "deling-holdning",
        operator: "EXISTS",
      },
      options: [
        {
          value: "lese-for-deling",
          label: "Kunne lese planen før den deles videre",
        },
        { value: "gi-innspill", label: "Kunne gi flere innspill til planen" },
        { value: "godkjenne", label: "Måtte godkjenne planen før deling" },
        { value: "si-fra", label: "Lettere å si fra ved uenighet" },
        { value: "ingen-endring", label: "Ingen endring nødvendig" },
        { value: "annet", label: "Annet" },
      ],
    },
    {
      id: "annet",
      type: "text",
      prompt: "Har du noe annet du vil si om planen?",
      required: false,
      minRows: 2,
      maxLength: 500,
      visibleIf: {
        field: "ANSWER",
        questionId: "deling-holdning",
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

export const OppfolgingsplanSM: Story = {
  name: "Oppfølgingsplan SM",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-dock-progress-oppfolgingsplan-sm",
    survey: OPPFOLGINGSPLAN_SM_SURVEY,
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
          "Eksakt kopi av SM-surveyen fra syfo-oppfolgingsplan-frontend. Har chained visibleIf, LT/GT-branching, og lang kjede med 10 spørsmål. Progressbar uten intro.",
      },
    },
  },
};

export const OppfolgingsplanSMMedIntro: Story = {
  name: "Oppfølgingsplan SM med intro",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-dock-progress-oppfolgingsplan-sm-intro",
    survey: OPPFOLGINGSPLAN_SM_SURVEY,
    intro: {
      title: "Hjelp oss å forbedre oppfølgingsplanen",
      body: "Vi vil gjerne vite mer om opplevelsen din med oppfølgingsplanen. Svarene er anonyme og brukes til å forbedre tjenesten.",
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
          "Samme SM-survey med intro-skjerm. Progress bar vises fra steg 0 etter intro. Tester den reelle use casen fra oppfølgingsplan-frontend.",
      },
    },
  },
};
