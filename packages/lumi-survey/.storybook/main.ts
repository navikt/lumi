import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const customRequire = createRequire(import.meta.url);

const config: StorybookConfig = {
  // The explicit entries make the public learning path deterministic. The
  // final glob still discovers future stories; Storybook de-duplicates files
  // matched by more than one entry.
  stories: [
    "../src/stories/LumiSurveyDock.overview.stories.tsx",
    "../src/stories/LumiSurveyDock.pages.stories.tsx",
    "../src/stories/LumiSurveyDock.questions.stories.tsx",
    "../src/stories/LumiSurveyDock.rating.stories.tsx",
    "../src/stories/LumiSurveyDock.tasks.stories.tsx",
    "../src/stories/LumiSurveyDock.legacy.stories.tsx",
    "../src/**/*.stories.@(ts|tsx)",
  ],
  addons: [getAbsolutePath("@storybook/addon-a11y")],

  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
};

export default config;

function getAbsolutePath(value: string): string {
  return dirname(customRequire.resolve(join(value, "package.json")));
}
