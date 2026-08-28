import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import {
  CONDITIONAL_FLOW_DOCUMENT,
  GROUPED_PAGE_DOCUMENT,
  ONE_QUESTION_PER_PAGE_DOCUMENT,
} from "./surveyExamples";

const meta: Meta<typeof LumiSurveyDock> = {
  // Keep the former Custom story IDs alive for public bookmarks while the
  // sidebar teaches the current page-based model.
  id: "components-lumisurveydock-custom",
  title: "Datamodell/Pages og flyt",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "En page er navigasjons- og valideringsenheten i SurveyDocumentV1. questionLayout=auto bruker dokumentets pages direkte.",
      },
    },
  },
  args: {
    surveyId: "storybook-pages",
    survey: ONE_QUESTION_PER_PAGE_DOCUMENT,
    transport: SUCCESS_TRANSPORT,
    behavior: {
      storageStrategy: "consent",
      showProgress: true,
    },
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

export const LinearProgress: Story = {
  name: "Ett spørsmål per page",
  render: (args) => <ExamplePage {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "Tre eksplisitte pages gir ett spørsmål per steg uten questionLayout=steps.",
      },
    },
  },
};

export const FlereSporsmalPerSide: Story = {
  name: "Flere spørsmål per page",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-grouped-page",
    survey: GROUPED_PAGE_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Relaterte spørsmål ligger på samme page, vises sammen og valideres før brukeren går videre.",
      },
    },
  },
};

export const Custom: Story = {
  name: "Alle pages på én flate",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-single-page-layout",
    survey: GROUPED_PAGE_DOCUMENT,
    behavior: {
      storageStrategy: "consent",
      questionLayout: "singlePage",
      showProgress: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "singlePage beholder page-titler og beskrivelser, men viser hele dokumentet på én flate.",
      },
    },
  },
};

export const MedIntro: Story = {
  name: "Betinget innhold mellom pages",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-conditional-pages",
    survey: CONDITIONAL_FLOW_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Page-en «Hva hindret deg?» hoppes over når svaret er Ja. Synlighet uttrykkes deklarativt med visibleIf.all på spørsmålet.",
      },
    },
  },
};
