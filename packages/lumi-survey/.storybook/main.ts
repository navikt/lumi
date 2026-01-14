import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const customRequire = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-a11y")],

  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },

  viteFinal: async (config) => {
    const mockPath = resolve(__dirname, "./mocks/consentMock.ts");
    console.log(
      "[Storybook] Setting up mock alias for @navikt/nav-dekoratoren-moduler",
    );
    console.log("[Storybook] Mock path:", mockPath);

    // Storybook build can produce a large amount of Rollup warnings from third-party
    // packages that ship module-level directives (e.g. "use client"). They are harmless
    // for our use (Storybook/Vite), but the spam can make builds appear stuck.
    config.build = config.build || {};
    config.build.rollupOptions = config.build.rollupOptions || {};
    const previousOnWarn = config.build.rollupOptions.onwarn;
    config.build.rollupOptions.onwarn = (warning, warn) => {
      const isUseClientDirectiveWarning =
        warning.code === "MODULE_LEVEL_DIRECTIVE" &&
        warning.message.includes('"use client"') &&
        typeof warning.id === "string";

      if (
        isUseClientDirectiveWarning &&
        (warning.id.includes("node_modules/@navikt/aksel-icons/") ||
          warning.id.includes("node_modules/@navikt/ds-react/"))
      ) {
        return;
      }

      if (typeof previousOnWarn === "function") {
        previousOnWarn(warning, warn);
        return;
      }

      warn(warning);
    };

    config.resolve = config.resolve || {};
    config.resolve.alias = Array.isArray(config.resolve.alias)
      ? config.resolve.alias
      : config.resolve.alias
        ? Object.entries(config.resolve.alias).map(([find, replacement]) => ({
            find,
            replacement,
          }))
        : [];

    // Add our mock as the first alias (highest priority)
    if (Array.isArray(config.resolve.alias)) {
      config.resolve.alias.unshift({
        find: "@navikt/nav-dekoratoren-moduler",
        replacement: mockPath,
      });
    } else {
      config.resolve.alias = {
        "@navikt/nav-dekoratoren-moduler": mockPath,
        ...config.resolve.alias,
      };
    }

    console.log("[Storybook] Vite aliases:", config.resolve.alias);
    return config;
  },
};

export default config;

function getAbsolutePath(value: string): string {
  return dirname(customRequire.resolve(join(value, "package.json")));
}
