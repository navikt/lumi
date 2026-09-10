import { Theme } from "@navikt/ds-react/Theme";
import type { Preview } from "@storybook/react-vite";
import { ExampleStoryInfoContext } from "../stories/LumiSurveyDockExamplePage.js";

interface DocsDescription {
  component?: string;
  story?: string;
}

export const previewAnnotations: Preview = {
  decorators: [
    (Story, context) => {
      const docsDescription = context.parameters.docs
        ?.description as DocsDescription;
      const description =
        docsDescription?.story ??
        docsDescription?.component ??
        "Utforsk konfigurasjonen og test hele surveyflyten.";

      return (
        <Theme>
          <ExampleStoryInfoContext.Provider
            value={{ name: context.name, description }}
          >
            <Story />
          </ExampleStoryInfoContext.Provider>
        </Theme>
      );
    },
  ],
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: [
          "Kom i gang",
          "Datamodell",
          ["Pages og flyt", "Spørsmålstyper"],
          "Surveytyper",
          ["Rating", "Discovery og oppgaver"],
          "Kompatibilitet",
          "*",
        ],
      },
    },
  },
};
