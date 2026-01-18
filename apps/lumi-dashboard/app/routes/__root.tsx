// Import Aksel Darkside styles (supports light/dark mode)
import akselStyles from "@navikt/ds-css?url";
import { Theme } from "@navikt/ds-react/Theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type * as React from "react";
import { useState } from "react";
import lumiLogo from "~/assets/lumi.png";
import { ErrorComponent } from "~/components/shared/ErrorComponent";
import { ThemeProvider, useTheme } from "~/context/ThemeContext";
import globalStyles from "~/styles/global.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex" },
      { title: "Lumi Dashboard" },
      {
        name: "description",
        content: "Analytics dashboard for Lumi feedback and surveys.",
      },
      {
        httpEquiv: "Content-Security-Policy",
        content:
          "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.nav.no; style-src 'self' 'unsafe-inline' https://cdn.nav.no; img-src 'self' data: https://cdn.nav.no; font-src 'self' data: https://cdn.nav.no;",
      },
    ],
    links: [
      { rel: "stylesheet", href: akselStyles },
      { rel: "stylesheet", href: globalStyles },
      {
        rel: "icon",
        type: "image/png",
        href: lumiLogo,
      },
    ],
  }),
  component: RootComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <Outlet />
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

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  // Use window.__theme as fallback during initial client render to prevent FOUC
  // The blocking script sets this variable before React loads
  const effectiveTheme =
    theme ?? (typeof window !== "undefined" ? window.__theme : undefined);

  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for theme init
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  localStorage.removeItem('theme');
                  var key = 'lumi-theme-preference';
                  var localTheme = localStorage.getItem(key);
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                  if (!localTheme && supportDarkMode) localTheme = 'dark';
                  if (!localTheme) localTheme = 'light';
                  
                  // Apply class "dark" for Aksel tokens
                  if (localTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  
                  document.documentElement.setAttribute('data-theme', localTheme);
                  document.documentElement.style.colorScheme = localTheme;
                  document.body.setAttribute('data-theme', localTheme);
                  document.body.style.colorScheme = localTheme;
                  window.__theme = localTheme;
                } catch (e) {}
              })();
            `,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <Theme
          theme={effectiveTheme}
          hasBackground={false}
          className="app-theme-root"
        >
          {children}
        </Theme>
        <Scripts />
      </body>
    </html>
  );
}
