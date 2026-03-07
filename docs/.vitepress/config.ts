import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid({
  title: "Lumi",
  description: "Personvernvennlige surveys for Nav",
  base: "/lumi/",
  lang: "nb-NO",
  themeConfig: {
    search: {
      provider: "local",
    },

    nav: [
      { text: "Kom i gang", link: "/kom-i-gang/hva-er-lumi" },
      { text: "Guider", link: "/guider/presets" },
      { text: "Dashboard", link: "/dashboard/tilgang" },
      { text: "Referanse", link: "/referanse/props-referanse" },
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
      "/guider/": [
        {
          text: "Guider",
          items: [
            { text: "Presets & surveytyper", link: "/guider/presets" },
            { text: "Spørsmålstyper", link: "/guider/sporsmalstyper" },
            {
              text: "Betinget synlighet",
              link: "/guider/betinget-synlighet",
            },
            { text: "Branching (logic)", link: "/guider/branching" },
            { text: "Context & tags", link: "/guider/context-og-tags" },
            { text: "Lagring", link: "/guider/lagring" },
            { text: "Styling", link: "/guider/styling" },
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
              text: "Props-referanse",
              link: "/referanse/props-referanse",
            },
            { text: "Events", link: "/referanse/events" },
            {
              text: "API-endepunkter",
              link: "/referanse/api-endepunkter",
            },
            { text: "Datakontrakt", link: "/referanse/datakontrakt" },
            {
              text: "Sikkerhet & arkitektur",
              link: "/referanse/sikkerhet",
            },
            {
              text: "Miljøer & lenker",
              link: "/referanse/miljoer",
            },
            { text: "Changelog", link: "/referanse/changelog" },
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
      message: "Laget med ❤️ av Team eSyfo i Nav",
    },

    outline: {
      level: [2, 3],
      label: "På denne siden",
    },
  },
});
