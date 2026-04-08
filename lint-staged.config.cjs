/** @type {import('lint-staged').Config} */
module.exports = {
  "**/*.{js,jsx,ts,tsx,cjs,mjs,cts,mts,json,jsonc,css,scss}": [
    "biome check --write --files-ignore-unknown=true",
  ],
  "*.{ts,tsx}": () => "pnpm run typecheck",
};
