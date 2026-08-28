import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyDock } from "../components/LumiSurveyDock";
import {
  createRatingSurveyDocument,
  DEFAULT_RATING_SURVEY_DOCUMENT,
} from "../presets/index.js";
import { ExamplePage, SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";

const SERVICE_RATING_DOCUMENT = createRatingSurveyDocument({
  ratingPrompt: "Hvordan opplevde du å svare på spørsmålene?",
  ratingDescription: "Svarene brukes til å videreutvikle tjenesten.",
  followUpQuestions: [
    {
      id: "feedback",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      maxLength: 1000,
    },
  ],
});

const STARS_DOCUMENT = createRatingSurveyDocument({
  variant: "stars",
  ratingPrompt: "Hvordan opplevde du å bruke tjenesten?",
  followUpQuestions: [
    {
      id: "feedback",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      maxLength: 1000,
    },
  ],
});

const THUMBS_DOCUMENT = createRatingSurveyDocument({
  variant: "thumbs",
  ratingPrompt: "Var dette til hjelp?",
  followUpQuestions: [
    {
      id: "feedback",
      type: "text",
      prompt: "Har du forslag til forbedringer?",
      maxLength: 500,
    },
  ],
});

const NPS_DOCUMENT = createRatingSurveyDocument({
  variant: "nps",
  ratingPrompt: "Hvor sannsynlig er det at du vil anbefale tjenesten?",
  lowLabel: "Lite sannsynlig",
  highLabel: "Svært sannsynlig",
  followUpQuestions: [
    {
      id: "reason",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      maxLength: 500,
    },
  ],
});

const meta: Meta<typeof LumiSurveyDock> = {
  id: "components-lumisurveydock-rating",
  title: "Surveytyper/Rating",
  component: LumiSurveyDock,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Rating-varianter bygget med createRatingSurveyDocument. Alle eksemplene bruker SurveyDocumentV1.",
      },
    },
  },
  args: {
    surveyId: "storybook-dock",
    survey: DEFAULT_RATING_SURVEY_DOCUMENT,
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

export const Rating: Story = {
  name: "Emoji",
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "sykepengesoknad-kvittering",
    survey: SERVICE_RATING_DOCUMENT,
    context: {
      tags: {
        abTest: "A",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tjenesteorientert rating-dokument med emoji-skala, betinget tekstfelt og context.tags for segmentering.",
      },
    },
  },
};

export const Stars: Story = {
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "dittnav-modul-rating",
    survey: STARS_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Fem-punkts stjerner i et SurveyDocumentV1 laget med createRatingSurveyDocument.",
      },
    },
  },
};

export const Thumbs: Story = {
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "am-veiviser-nytteverdi",
    survey: THUMBS_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Binært rating-spørsmål for «Var dette til hjelp?» med variant=thumbs.",
      },
    },
  },
};

export const Nps: Story = {
  render: (args) => <ExamplePage {...args} />,
  args: {
    surveyId: "nav-no-hovedside-nps",
    survey: NPS_DOCUMENT,
  },
  parameters: {
    docs: {
      description: {
        story:
          "NPS-skala fra 0–10 med egne ytteretiketter og betinget begrunnelse.",
      },
    },
  },
};
