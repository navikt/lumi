import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid({
  title: "Lumi",
  description: "Personvernvennlige surveys for Nav",
  base: "/lumi/",
  lang: "nb-NO",
  head: [["link", { rel: "icon", href: "/lumi/lumi.png" }]],
  themeConfig: {
    logo: "/lumi.png",
    search: {
      provider: "local",
    },

    nav: [
      { text: "Kom i gang", link: "/kom-i-gang/hva-er-lumi" },
      { text: "Guider", link: "/guider/surveytyper" },
      { text: "Dashboard", link: "/dashboard/tilgang" },
      { text: "Referanse", link: "/referanse/props-referanse" },
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
            { text: "Surveytyper", link: "/guider/surveytyper" },
            {
              text: "Survey-identitet",
              link: "/guider/survey-identitet",
            },
            { text: "Presets & builders", link: "/guider/presets-og-builders" },
            { text: "Spørsmålstyper", link: "/guider/sporsmalstyper" },
            {
              text: "Betinget synlighet",
              link: "/guider/betinget-synlighet",
            },
            { text: "Branching (logic)", link: "/guider/branching" },
            { text: "Context & tags", link: "/guider/context-og-tags" },
            { text: "Lagring", link: "/guider/lagring" },
            { text: "Styling", link: "/guider/styling" },
            { text: "Feilsøking", link: "/guider/feilsoking" },
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
              text: "Sikkerhet & personvern",
              link: "/referanse/sikkerhet",
            },
            {
              text: "Bruksvilkår",
              link: "/referanse/bruksvilkar",
            },
            {
              text: "Miljøer & lenker",
              link: "/referanse/miljoer",
            },
            { text: "Changelog", link: "/referanse/changelog" },
          ],
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
