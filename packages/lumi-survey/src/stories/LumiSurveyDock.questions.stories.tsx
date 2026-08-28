import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import {
  MULTI_CHOICE_DOCUMENT,
  SEARCHABLE_MULTI_CHOICE_DOCUMENT,
  SINGLE_CHOICE_DOCUMENT,
  TEXT_QUESTION_DOCUMENT,
} from "./surveyExamples";

const meta: Meta<typeof LumiSurveyDock> = {
  title: "Datamodell/Spørsmålstyper",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "De offentlige spørsmålstypene i SurveyDocumentV1: text, singleChoice og multiChoice. Rating-varianter har en egen samling under Surveytyper.",
      },
    },
  },
  args: {
    surveyId: "storybook-question-types",
    survey: TEXT_QUESTION_DOCUMENT,
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
    intro: { control: false },
    success: { control: false },
  },
};

export default meta;
type Story = StoryObj<typeof LumiSurveyDock>;

export const Text: Story = {
  name: "Text",
  render: (args) => <ExamplePage {...args} />,
};

export const SingleChoice: Story = {
  name: "Single choice",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-single-choice",
    survey: SINGLE_CHOICE_DOCUMENT,
  },
};

export const MultiChoice: Story = {
  name: "Multi choice",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-multi-choice",
    survey: MULTI_CHOICE_DOCUMENT,
  },
};

export const SearchableMultiChoice: Story = {
  name: "Søkbart multi choice",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "storybook-searchable-multi-choice",
    survey: SEARCHABLE_MULTI_CHOICE_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "combobox-varianten passer for lange lister og kan kombineres med maxSelections og randomize.",
      },
    },
  },
};
