import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import { LEGACY_SURVEY_CONFIG } from "./surveyExamples";

const meta: Meta<typeof LumiSurveyDock> = {
  title: "Kompatibilitet/Legacy LumiSurveyConfig",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Flat LumiSurveyConfig med questions[] støttes i 2.x for eksisterende integrasjoner. Ikke bruk denne modellen for nye surveyer.",
      },
    },
  },
  args: {
    surveyId: "storybook-legacy-flat",
    survey: LEGACY_SURVEY_CONFIG,
    transport: SUCCESS_TRANSPORT,
    behavior: {
      storageStrategy: "consent",
    },
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

export const FlatQuestions: Story = {
  name: "Flat questions[]",
  render: (args) => <ExamplePage {...args} />,
};

export const QuestionBasedSteps: Story = {
  name: "Spørsmålsbaserte steg",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-legacy-steps",
    behavior: {
      storageStrategy: "consent",
      questionLayout: "steps",
      showProgress: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "questionLayout=steps på en flat config er en kompatibilitetsmekanisme. Nye surveyer lager én page per steg og bruker auto.",
      },
    },
  },
};
