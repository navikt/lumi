import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  // `./index.js` is external so dist/client.js re-exports the built main entry
  // instead of bundling a second copy of the widget. esbuild keeps the
  // "use client" directive at the top of an entry file. No other module in
  // src may import "./index.js"; verify-lumi-survey-package.mjs checks it.
  external: ["@navikt/ds-react", "@navikt/aksel-icons", /^\.\/index\.js$/],
  loader: {
    ".css": "css",
  },
});
