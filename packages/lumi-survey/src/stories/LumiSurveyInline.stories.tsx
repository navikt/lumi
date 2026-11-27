import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumiSurveyInline } from "../components/LumiSurveyInline";
import { SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import { InlineExamplePage } from "./LumiSurveyInlineExamplePage";
import {
  INLINE_CONTENT_DOCUMENT,
  INLINE_NARROW_COLUMN_DOCUMENT,
  INLINE_REPEATED_DOCUMENT,
  RECOMMENDED_SURVEY_DOCUMENT,
} from "./surveyExamples";

const UNDER_CONTENT_SOURCE = `import { LumiSurveyInline } from "@navikt/lumi-survey";
import { survey } from "./survey";

export function KalkulatorSide() {
  return (
    <>
      <Kalkulator />
      <LumiSurveyInline
        surveyId="kalkulator-tilbakemelding"
        survey={survey}
        transport={{ endpoint: "/api/lumi/feedback" }}
        headingLevel="3"
        context={{
          tags: { surface: "inline", placement: "under-kalkulator" },
        }}
      />
    </>
  );
}`;

const NARROW_COLUMN_SOURCE = `<aside className="sidekolonne">
  <LumiSurveyInline
    surveyId="oversikt-tilbakemelding"
    survey={survey}
    transport={{ endpoint: "/api/lumi/feedback" }}
    headingLevel="3"
    context={{
      tags: { surface: "inline", placement: "sidekolonne" },
    }}
  />
</aside>`;

const REPEATED_SOURCE = `<ForsteArtikkel />
<LumiSurveyInline
  surveyId="artikkel-nytte"
  survey={survey}
  transport={{ endpoint: "/api/lumi/feedback" }}
  headingLevel="3"
  context={{ tags: { surface: "inline", placement: "artikkel-1" } }}
/>

<AndreArtikkel />
<LumiSurveyInline
  surveyId="artikkel-nytte"
  survey={survey}
  transport={{ endpoint: "/api/lumi/feedback" }}
  headingLevel="3"
  context={{ tags: { surface: "inline", placement: "artikkel-2" } }}
/>`;

const PAGES_SOURCE = `<LumiSurveyInline
  surveyId="tjeneste-tilbakemelding"
  survey={survey}
  transport={{ endpoint: "/api/lumi/feedback" }}
  headingLevel="3"
  behavior={{ showProgress: true }}
  context={{
    tags: { surface: "inline", placement: "under-kalkulator" },
  }}
/>`;

const meta: Meta<typeof LumiSurveyInline> = {
  title: "Plassering/Ved innholdet",
  component: LumiSurveyInline,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "LumiSurveyInline viser surveyen som en del av siden, der appen plasserer den. Den bruker samme SurveyDocumentV1 og innsending som LumiSurveyDock, men har ingen lukkeknapp og lagrer ingenting i nettleseren.",
      },
    },
  },
  args: {
    surveyId: "storybook-inline",
    survey: INLINE_CONTENT_DOCUMENT,
    transport: SUCCESS_TRANSPORT,
    headingLevel: "3",
    context: {
      tags: {
        surface: "inline",
        placement: "under-kalkulator",
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
    headingLevel: {
      control: "inline-radio",
      options: ["2", "3", "4", "5"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof LumiSurveyInline>;

export const UnderContent: Story = {
  name: "Under innholdet",
  render: (args) => (
    <InlineExamplePage {...args} sourceCode={UNDER_CONTENT_SOURCE} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Surveyen står rett under kalkulatoren den spør om. Rammen følger bredden på beholderen, og kvitteringen blir stående der surveyen var.",
      },
    },
  },
};

export const NarrowColumn: Story = {
  name: "I en smal kolonne",
  render: (args) => (
    <InlineExamplePage
      {...args}
      layout="column"
      sourceCode={NARROW_COLUMN_SOURCE}
    />
  ),
  args: {
    surveyId: "storybook-inline-column",
    survey: INLINE_NARROW_COLUMN_DOCUMENT,
    context: {
      tags: {
        surface: "inline",
        placement: "sidekolonne",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "I en kolonne på 16rem bryter skalaen fra 0 til 10 over flere rader. Surveyen blir aldri bredere enn beholderen.",
      },
    },
  },
};

export const SeveralOnOnePage: Story = {
  name: "Flere på samme side",
  render: (args) => (
    <InlineExamplePage
      {...args}
      layout="repeated"
      sourceCode={REPEATED_SOURCE}
    />
  ),
  args: {
    surveyId: "storybook-inline-repeated",
    survey: INLINE_REPEATED_DOCUMENT,
    context: {
      tags: {
        surface: "inline",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "To artikler bruker samme surveyId. Hver survey har sine egne svar og sin egen kvittering, og context.tags.placement forteller hvilken artikkel svaret gjelder.",
      },
    },
  },
};

export const PagesAndIntro: Story = {
  name: "Flere sider med velkomstside",
  render: (args) => <InlineExamplePage {...args} sourceCode={PAGES_SOURCE} />,
  args: {
    surveyId: "storybook-inline-pages",
    survey: RECOMMENDED_SURVEY_DOCUMENT,
    behavior: {
      showProgress: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Et dokument med velkomstside, to sider og egen takkeside. Sidene vises én om gangen, og fokus følger med til neste side.",
      },
    },
  },
};
