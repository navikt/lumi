import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      "@navikt/nav-dekoratoren-moduler": path.resolve(
        __dirname,
        ".storybook/mocks/consentMock.ts",
      ),
    },
  },
});
