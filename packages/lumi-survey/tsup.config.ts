import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@navikt/ds-react", "@navikt/aksel-icons"],
  loader: {
    ".module.css": "local-css",
    ".css": "css",
  },
});
