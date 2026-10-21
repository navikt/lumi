import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the built deck works from any sub-path.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // React, Aksel and the widget ship as one bundle on purpose: a talk
    // loads once and must not wait for chunks mid-way.
    chunkSizeWarningLimit: 800,
  },
});
