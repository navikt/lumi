import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid({
  title: "Lumi",
  description: "Dokumentasjon for Lumi, surveyverktøyet for team i Nav",
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
              text: "Lag surveyen",
              link: "/kom-i-gang/lag-survey",
            },
            {
              text: "Installer widgeten",
              link: "/kom-i-gang/installer-widget",
            },
            {
              text: "Legg surveyen i appen",
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
            {
              text: "Velg hva dere vil måle",
              link: "/guider/surveytyper",
            },
            { text: "Sider og flyt", link: "/guider/sider-og-flyt" },
            { text: "Spørsmålstyper", link: "/guider/sporsmalstyper" },
            {
              text: "Vis bare relevante spørsmål",
              link: "/guider/betinget-synlighet",
            },
            {
              text: "Survey-identitet og endringer",
              link: "/guider/survey-identitet",
            },
            { text: "Context og tags", link: "/guider/context-og-tags" },
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
            { text: "Les resultatene", link: "/dashboard/visninger" },
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
              text: "Migrer en eldre survey",
              link: "/referanse/migrer-eldre-survey",
            },
            {
              text: "Sikkerhet og personvern",
              link: "/referanse/sikkerhet",
            },
            {
              text: "Bruksvilkår",
              link: "/referanse/bruksvilkar",
            },
            {
              text: "Miljøer og lenker",
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
      message: "Utviklet og driftet av Team eSyfo i Nav",
    },

    outline: {
      level: [2, 3],
      label: "På denne siden",
    },
  },
});
