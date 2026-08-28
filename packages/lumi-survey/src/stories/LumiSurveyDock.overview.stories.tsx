import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import { RECOMMENDED_SURVEY_DOCUMENT } from "./surveyExamples";

const meta: Meta<typeof LumiSurveyDock> = {
  title: "Kom i gang/SurveyDocumentV1",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Start her. SurveyDocumentV1 er formatet for nye surveyer og samler intro, pages, spørsmål og success i ett serialiserbart dokument.",
      },
    },
  },
  args: {
    surveyId: "storybook-current-document",
    survey: RECOMMENDED_SURVEY_DOCUMENT,
    transport: SUCCESS_TRANSPORT,
    behavior: {
      storageStrategy: "consent",
      showProgress: true,
    },
    context: {
      tags: {
        app: "eksempel-app",
        variant: "A",
      },
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

export const RecommendedStructure: Story = {
  name: "Anbefalt grunnstruktur",
  render: (args) => <ExamplePage {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "Et komplett SurveyDocumentV1 med intro, to eksplisitte pages, betinget synlighet og egen success-tekst. Kodepanelet er kopierbar TypeScript.",
      },
    },
  },
};
