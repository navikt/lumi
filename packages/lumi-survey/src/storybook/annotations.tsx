import { Theme } from "@navikt/ds-react/Theme";
import type { Preview } from "@storybook/react";

export const previewAnnotations: Preview = {
  decorators: [
    (Story) => (
      <Theme>
        <Story />
      </Theme>
    ),
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
          "Welcome",
          "Components",
          ["LumiSurveyDock", ["Rating", "Tasks", "Custom"]],
        ],
      },
    },
  },
};
