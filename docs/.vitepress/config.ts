import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Lumi",
  description: "Personvernvennlig survey-infrastruktur for NAV",
  base: "/lumi/",
  lang: "nb-NO",
  themeConfig: {
    search: {
      provider: "local",
    },

    nav: [
      { text: "Kom i gang", link: "/kom-i-gang/hva-er-lumi" },
      { text: "Bruk", link: "/bruk/sporsmalstyper" },
      { text: "Dashboard", link: "/dashboard/tilgang" },
      { text: "Referanse", link: "/referanse/api-endepunkter" },
      { text: "Feilsøking", link: "/feilsoking" },
    ],

    sidebar: {
      "/kom-i-gang/": [
        {
          text: "Kom i gang",
          items: [
            { text: "Hva er Lumi?", link: "/kom-i-gang/hva-er-lumi" },
            {
              text: "Installer widget",
              link: "/kom-i-gang/installer-widget",
            },
            {
              text: "Konfigurer survey",
              link: "/kom-i-gang/konfigurer-survey",
            },
            {
              text: "Koble til backend",
              link: "/kom-i-gang/koble-til-backend",
            },
          ],
        },
      ],
      "/bruk/": [
        {
          text: "Bruk",
          items: [
            { text: "Spørsmålstyper", link: "/bruk/sporsmalstyper" },
            { text: "Presets", link: "/bruk/presets" },
            {
              text: "Betinget synlighet",
              link: "/bruk/betinget-synlighet",
            },
            { text: "Context & tags", link: "/bruk/context-og-tags" },
            { text: "Lagring", link: "/bruk/lagring" },
          ],
        },
      ],
      "/tilpasning/": [
        {
          text: "Tilpasning",
          items: [
            { text: "Props-referanse", link: "/tilpasning/props-referanse" },
            { text: "Events", link: "/tilpasning/events" },
            { text: "Styling", link: "/tilpasning/styling" },
            { text: "Avansert", link: "/tilpasning/avansert" },
          ],
        },
      ],
      "/dashboard/": [
        {
          text: "Dashboard",
          items: [
            { text: "Tilgang", link: "/dashboard/tilgang" },
            { text: "Filtrering", link: "/dashboard/filtrering" },
            { text: "Eksport", link: "/dashboard/eksport" },
          ],
        },
      ],
      "/referanse/": [
        {
          text: "Referanse",
          items: [
            {
              text: "API-endepunkter",
              link: "/referanse/api-endepunkter",
            },
            { text: "Datakontrakt", link: "/referanse/datakontrakt" },
            {
              text: "Miljøer & lenker",
              link: "/referanse/miljoer",
            },
            { text: "Changelog", link: "/referanse/changelog" },
          ],
        },
      ],
      "/sikkerhet/": [
        {
          text: "Sikkerhet",
          items: [
            {
              text: "Arkitektur & PII",
              link: "/sikkerhet/arkitektur",
            },
          ],
        },
      ],
      "/utvikling/": [
        {
          text: "Utvikling",
          items: [
            { text: "Bidra til Lumi", link: "/utvikling/bidra" },
            { text: "Release-prosess", link: "/utvikling/release" },
          ],
        },
      ],
      "/feilsoking": [
        {
          text: "Feilsøking",
          items: [{ text: "Vanlige problemer", link: "/feilsoking" }],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/navikt/lumi" }],

    editLink: {
      pattern: "https://github.com/navikt/lumi/edit/main/docs/:path",
      text: "Rediger denne siden",
    },

    footer: {
      message: "Laget med ❤️ av Team Esyfo i NAV",
    },

    outline: {
      level: [2, 3],
      label: "På denne siden",
    },
  },
});
