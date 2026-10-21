"use client";

export type { LumiSurveyEndpoint } from "./index.js";
// Entry point for React Server Components, such as the Next.js App Router.
// The directive makes LumiSurveyDock a client component, so a server component
// can render it with `transport={{ endpoint }}`. Only components and types
// belong here: any other value would become a client reference on the server.
// Use named exports; webpack in Next.js rejects `export *` in a client
// boundary. The main entry keeps no directive.
export { LumiSurveyDock, type LumiSurveyDockProps } from "./index.js";
