import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import type { LumiSurveyConfig } from "../components/surveyTypes.js";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";

const DINESYKMELDTE_SURVEY: LumiSurveyConfig = {
  type: "custom",
  questions: [
    {
      id: "antall-ansatte",
      type: "singleChoice",
      prompt: "Hvor mange ansatte er det i virksomheten?",
      required: true,
      options: [
        { value: "1-4", label: "1–4" },
        { value: "5-19", label: "5–19" },
        { value: "20-49", label: "20–49" },
        { value: "50-199", label: "50–199" },
        { value: "200+", label: "200+" },
      ],
    },
    {
      id: "bransje",
      type: "singleChoice",
      prompt: "Hvilken bransje tilhører virksomheten?",
      required: true,
      options: [
        { value: "helse-og-omsorg", label: "Helse og omsorg" },
        { value: "undervisning", label: "Undervisning" },
        { value: "industri", label: "Industri" },
        { value: "bygg-og-anlegg", label: "Bygg og anlegg" },
        { value: "transport", label: "Transport" },
        {
          value: "kontor-og-administrasjon",
          label: "Kontor og administrasjon",
        },
        { value: "butikk-og-salg", label: "Butikk og salg" },
        { value: "hotell-og-servering", label: "Hotell og servering" },
        { value: "annet", label: "Annet" },
      ],
    },
    {
      id: "storste-hindring",
      type: "text",
      prompt:
        "Hva er den største hindringen du opplever når du skal følge opp en ansatt som er sykmeldt?",
      required: true,
      maxLength: 500,
      minRows: 3,
    },
    {
      id: "vanskeligst",
      type: "multiChoice",
      prompt: "Hva gjør det vanskeligst å følge opp sykmeldt ansatt?",
      required: true,
      variant: "checkbox",
      options: [
        { value: "manglende-tid", label: "Manglende tid" },
        { value: "usikkerhet-om-regelverk", label: "Usikkerhet om regelverk" },
        {
          value: "vanskelig-a-snakke-om-helse",
          label: "Vanskelig å snakke om helse med ansatte",
        },
        {
          value: "lite-rom-for-tilrettelegging",
          label: "Lite rom for tilrettelegging",
        },
        {
          value: "lite-stotte-fra-ledelsen",
          label: "Lite støtte fra ledelsen",
        },
        { value: "tekniske-utfordringer", label: "Tekniske utfordringer" },
        {
          value: "motvilje-fra-den-ansatte",
          label: "Motvilje fra den ansatte",
        },
        { value: "annet", label: "Annet" },
      ],
      logic: [
        {
          condition: {
            field: "ANSWER",
            operator: "CONTAINS",
            value: "annet",
          },
          action: { type: "JUMP_TO", targetId: "vanskeligst-annet" },
        },
        {
          condition: { field: "ANSWER", operator: "EXISTS" },
          action: { type: "JUMP_TO", targetId: "lettere" },
        },
      ],
    },
    {
      id: "vanskeligst-annet",
      type: "text",
      prompt: "Beskriv hva annet som gjør det vanskelig",
      required: true,
      maxLength: 500,
      minRows: 3,
    },
    {
      id: "lettere",
      type: "multiChoice",
      prompt:
        "Hva kan gjøre det lettere for deg å følge opp sykmeldte ansatte?",
      required: true,
      variant: "checkbox",
      options: [
        { value: "klare-steg-og-tidslinje", label: "Klare steg og tidslinje" },
        {
          value: "tydelige-varsler-i-riktig-oyeblikk",
          label: "Tydelige varsler i riktig øyeblikk",
        },
        { value: "eksempler-eller-maler", label: "Eksempler eller maler" },
        {
          value: "bedre-kommunikasjon-med-lege-nav",
          label: "Bedre kommunikasjon med lege/NAV",
        },
        { value: "bedre-interne-rutiner", label: "Bedre interne rutiner" },
      ],
    },
    {
      id: "viktigst",
      type: "text",
      prompt:
        "Utfra din erfaring, hva er viktigst for at du som arbeidsgiver skal lykkes med sykefraværsoppfølging?",
      required: true,
      maxLength: 500,
      minRows: 3,
    },
    {
      id: "hvor-ofte",
      type: "singleChoice",
      prompt: "Hvor ofte har du sykmeldte ansatte som du følger opp?",
      required: true,
      options: [
        { value: "svaert-ofte", label: "Svært ofte" },
        { value: "ofte", label: "Ofte" },
        { value: "av-og-til", label: "Av og til" },
        { value: "sjelden", label: "Sjelden" },
        { value: "aldri", label: "Aldri" },
      ],
    },
    {
      id: "erfaring",
      type: "singleChoice",
      prompt:
        "Hvor erfaren vil du si at du er når det gjelder oppfølging av sykmeldte ansatte?",
      required: true,
      options: [
        { value: "svaert-erfaren", label: "Svært erfaren" },
        { value: "ganske-erfaren", label: "Ganske erfaren" },
        { value: "litt-erfaren", label: "Litt erfaren" },
        { value: "ikke-erfaren", label: "Ikke erfaren" },
      ],
    },
  ],
};

const meta: Meta<typeof LumiSurveyDock> = {
  title: "Components/LumiSurveyDock/Dinesykmeldte",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Surveyen for dinesykmeldte – sykefraværsoppfølging for arbeidsgivere. Viser intro-skjerm, progress bar og logisk branching (vanskeligst → annet).",
      },
    },
  },
  args: {
    surveyId: "dinesykmeldte-arbeidsgiver-oppfolging",
    survey: DINESYKMELDTE_SURVEY,
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

export const MedIntroOgProgress: Story = {
  name: "Med intro og progress bar",
  render: (args) => <ExamplePage {...args} />,
  args: {
    intro: {
      title: "Hjelp oss å forbedre oppfølgingen",
      body: "Hei! Vi utforsker hvordan vi kan tilby mer konkret informasjon og veiledning til deg som leder, og til den ansatte, i sykefraværsoppfølgingen. For å kunne gjøre det, må vi lære mer om hva du trenger støtte til når du følger opp en ansatt som er sykmeldt. Vi håper du tar deg tid til å svare på noen spørsmål.",
      startLabel: "Start",
    },
    behavior: {
      questionLayout: "steps",
      storageStrategy: "consent",
      dismissCooldownDays: 30,
      showProgress: true,
    },
    context: {
      tags: {
        app: "dinesykmeldte",
        rolle: "arbeidsgiver",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Fullstendig survey med intro-skjerm, progress bar og logisk branching. Klikk «Start» for å se spørsmålene. Velg «Annet» på spørsmål 4 for å se branching til fritekst-feltet.",
      },
    },
  },
};

export const UtenIntro: Story = {
  name: "Uten intro (direkte spørsmål)",
  render: (args) => <ExamplePage {...args} />,
  args: {
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
          "Samme survey uten intro-skjerm – hopper direkte til første spørsmål.",
      },
    },
  },
};

export const AlleSporsmalPaEnSide: Story = {
  name: "Alle spørsmål på én side",
  render: (args) => <ExamplePage {...args} />,
  args: {
    intro: {
      title: "Hjelp oss å forbedre oppfølgingen",
      body: "Vi håper du tar deg tid til å svare på noen spørsmål om sykefraværsoppfølging.",
      startLabel: "Start",
    },
    behavior: {
      questionLayout: "singlePage",
      storageStrategy: "consent",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Samme survey med inline layout – alle spørsmål vises samtidig på én side. Nyttig for sammenligning med steps-layout.",
      },
    },
  },
};
