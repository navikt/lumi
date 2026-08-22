import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@navikt/ds-react", "@navikt/aksel-icons"],
  loader: {
    ".css": "css",
  },
});
