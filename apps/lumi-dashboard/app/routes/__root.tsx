// Import Aksel and global styles as regular CSS so they are emitted as manifest assets.
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
import { Theme } from "@navikt/ds-react/Theme";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type * as React from "react";
import { useState } from "react";
import lumiLogo from "~/assets/lumi.png";
import { ErrorComponent } from "~/components/shared/ErrorComponent";
import { NotFoundComponent } from "~/components/shared/NotFoundComponent";
import { THEME_INIT_SCRIPT } from "~/config/themeInit";
import { ThemeProvider } from "~/context/ThemeContext";
import { BrowserRouteTracker } from "~/observability/BrowserRouteTracker";
import { fetchBrowserObservabilityMetaServerFn } from "~/server/browserObservabilityConfig";
import "~/styles/global.css";
import { redirectToDashboardTeam } from "~/utils/dashboardTeam";
import { createDashboardQueryClient } from "~/utils/queryClient";

export const Route = createRootRoute({
  // Runs before the dashboard routes' own beforeLoad, so their data queries
  // start with the team already in the address.
  beforeLoad: ({ location }) => redirectToDashboardTeam(location),
  loader: () => fetchBrowserObservabilityMetaServerFn(),
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex" },
      { title: "Lumi Dashboard" },
      {
        name: "description",
        content: "Analytics dashboard for Lumi feedback and surveys.",
      },
      ...(loaderData ?? []),
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: lumiLogo,
      },
    ],
  }),
  // The shell wraps the root's error and not-found components as well as its
  // content, so the page keeps its language, title, theme and providers when
  // the root fails. Without a component of its own, the root renders the
  // matched child route.
  shellComponent: RootShell,
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createDashboardQueryClient);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <BrowserRouteTracker />
          {children}
        </RootDocument>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

declare global {
  interface Window {
    __theme?: "light" | "dark";
  }
}

// The document does not read the theme. A value that changed after hydration
// would reach the routes before React had hydrated them (see
// context/ThemeContext.tsx). Aksel takes its tokens from the "dark" class on
// <html>, and ThemeProvider adds the theme class to .app-theme-root.
function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isServerRender = typeof document === "undefined";
  const nonce = isServerRender ? router.options.ssr?.nonce : undefined;

  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        {/* HeadContent renders <meta property="csp-nonce"> from router.options.ssr.nonce. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for theme init
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <Theme hasBackground={false} className="app-theme-root">
          {children}
        </Theme>
        <Scripts />
      </body>
    </html>
  );
}
