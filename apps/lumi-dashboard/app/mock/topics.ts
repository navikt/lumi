export type FeedbackTopic = {
  rating: number;
  tags?: string[];
  comments: string[]; // List of unique text variations
  isRedacted?: boolean; // If true, all comments in this topic are treated as redacted
};

export const sykmeldtTopics: FeedbackTopic[] = [
  // ------------------------------------------------
  // TOPIC: Positive / Mobile Friendly
  // ------------------------------------------------
  {
    rating: 5,
    tags: ["📱 Mobil/Tablet", "❤️ Ros"],
    comments: [
      "Veldig enkelt og greit å fylle ut på mobilen. Tommel opp!",
      "Liker at jeg kan gjøre dette på telefonen mens jeg sitter på bussen.",
      "God flyt og oversiktlig på liten skjerm.",
      "Fungerte sømløst på min iPhone.",
      "Toppers at dere har laget en så bra mobilversjon.",
      "Gikk veldig raskt å klikke seg gjennom på mobilen.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: General Praise
  // ------------------------------------------------
  {
    rating: 5,
    tags: ["❤️ Ros"],
    comments: [
      "Mye bedre enn papirskjema! Dette sparer meg for tid.",
      "Endelig et skjema fra NAV som er lett å forstå.",
      "Dette var en drøm sammenlignet med det gamle systemet.",
      "Takk for at dere gjør hverdagen enklere for oss som er sykmeldte!",
      "Enkelt å finne frem i mylderet av informasjon. Dere har gjort en god jobb her.",
      "Veldig intuitivt og brukervennlig.",
      "Ingen problemer underveis, alt fungerte som det skulle.",
      "Oversiktlig og fint design.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Feature Requests (Save/Edit)
  // ------------------------------------------------
  {
    rating: 3,
    tags: ["✨ Feature", "👀 Til vurdering"],
    comments: [
      "Savner egentlig en mulighet til å lagre utkast så jeg kan fortsette senere.",
      "Burde være mulig å endre svarene etter at man har trykket på neste.",
      "Kunne dere lagt til en 'tilbake'-knapp som faktisk husker hva jeg skrev?",
      "Jeg skulle gjerne hatt mulighet til å laste opp flere vedlegg samtidig.",
      "Savner en print-knapp for kvitteringen.",
      "Hvorfor kan jeg ikke se hva jeg svarte i fjor?",
    ],
  },
  // ------------------------------------------------
  // TOPIC: UX / Language Issues
  // ------------------------------------------------
  {
    rating: 4,
    tags: ["🎨 UX", "🗣️ Språk"],
    comments: [
      "Oversiktlig og fint, men litt mye tekst på første side.",
      "Språket er litt vanskelig å forstå i del 2.",
      "Noen av spørsmålene var litt tvetydige.",
      "Litt liten skrift på hjelpetekstene.",
      "Jeg skjønte ikke begrepet 'medvirkning' i denne sammenhengen.",
      "Kunne vært færre klikk for å komme til målet.",
      "Greit nok, men litt kjedelig design.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Login / Technical Bugs
  // ------------------------------------------------
  {
    rating: 2,
    tags: ["🔒 Innlogging", "🐛 Bug"],
    comments: [
      "Måtte logge inn med BankID tre ganger før jeg fikk sendt inn. Det er for dårlig.",
      "Hvorfor blir jeg logget ut så fort? Rekker knapt å hente kaffe.",
      "Innloggingen feilet flere ganger med 'ukjent feil'.",
      "Kommer ikke inn med MinID, den bare spinner.",
      "Får feilmelding når jeg prøver å logge inn fra iPad.",
      "Systemet kastet meg ut midt i utfyllingen.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Critical Errors (Upload/Submit)
  // ------------------------------------------------
  {
    rating: 1,
    tags: [" Bug", "🔥 Kritisk", "👀 Til vurdering"],
    comments: [
      "Får feilmelding når jeg prøver å laste opp vedlegg. Har prøvd 3 ganger.",
      "Knappen for å sende inn virker ikke!",
      "Alt ble slettet da jeg trykket på 'Neste'. Utrolig frustrerende.",
      "Siden krasjer når jeg prøver å åpne den gamle planen.",
      "Får bare hvit skjerm etter innlogging.",
      "Startet på nytt 4 ganger, men kommer ikke videre fra steg 2.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Redacted (Sensitive Info)
  // ------------------------------------------------
  {
    rating: 1,
    tags: ["✅ Behandlet"],
    isRedacted: true,
    comments: [
      "Jeg snakket med [MULIG NAVN FJERNET] som sa jeg skulle klage hit.",
      "Ringte dere på tlf [TELEFON FJERNET] men ingen svarte i går.",
      "Min fnr er [FØDSELSNUMMER FJERNET], hvorfor finner dere meg ikke?",
      "Saksbehandler [NAVIDENT FJERNET] var veldig uhøflig i telefonen.",
      "Send svaret til [E-POST FJERNET] takk, jeg sjekker ikke Digipost.",
      "Jeg får feilmelding fra IP [IP-ADRESSE FJERNET] når jeg sitter hjemme.",
      "Utbetalingen til konto [KONTONUMMER FJERNET] har ikke kommet.",
      "Jeg bor midlertidig i [MULIG ADRESSE FJERNET] pga oppussing.",
      "Bilen min med skilt [BILNUMMER FJERNET] er nødvendig for jobben.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Empty / Tags Only
  // ------------------------------------------------
  { rating: 5, tags: [], comments: new Array(15).fill("") }, // 15 empty 5-stars
  { rating: 4, tags: ["✅ Behandlet"], comments: new Array(10).fill("") },
  { rating: 3, tags: [], comments: new Array(5).fill("") },
];

export const arbeidsgiverTopics: FeedbackTopic[] = [
  // ------------------------------------------------
  // TOPIC: Efficiency / Praise
  // ------------------------------------------------
  {
    rating: 5,
    tags: ["❤️ Ros"],
    comments: [
      "Dette gjør oppfølgingen mye enklere for oss som har mange ansatte.",
      "Effektivt verktøy som sparer meg for mye tid.",
      "Veldig bra oversikt over alle sykmeldte på ett sted.",
      "Liker at vi kan kommunisere direkte med NAV her.",
      "Endelig et system som snakker sammen. Takk!",
      "Enkelt å invitere til dialogmøte gjennom denne løsningen.",
      "Oversiktlig dashboard som gir full kontroll.",
      "Dette har blitt mye bedre det siste året.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Feature Requests (Sorting/Filtering)
  // ------------------------------------------------
  {
    rating: 3,
    tags: ["✨ Feature", "👀 Til vurdering"],
    comments: [
      "Fungerer greit, men savner å kunne sortere listen på avdeling.",
      "Skulle gjerne hatt mulighet til å filtrere på langtidssykemeldte.",
      "Kan vi få varsling på SMS når det kommer nytt her?",
      "Savner eksport til Excel-format.",
      "Det ville vært fint med en utskriftsvennlig versjon som ser litt bedre ut.",
      "Kunne dere lagt inn støtte for delegering til mellomledere?",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Altinn / Access Rights
  // ------------------------------------------------
  {
    rating: 2,
    tags: ["🔒 Innlogging", "🎨 UX"],
    comments: [
      "Hvorfor må jeg bekrefte hver handling med Altinn-rettigheter? Det tar for lang tid.",
      "Får ikke delegert rettigheter riktig i Altinn.",
      "Tungvint at jeg må logge inn på nytt for hver ansatt.",
      "Rettighetsstyringen er for komplisert.",
      "Jeg har tilgang, men får likevel feilmelding om manglende rettigheter.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: UX / UI Issues
  // ------------------------------------------------
  {
    rating: 4,
    tags: ["🎨 UX"],
    comments: [
      "God oversikt, men litt liten skrift på dashbordet.",
      "Litt vanskelig å finne eldre saker i arkivet.",
      "Menyen til venstre tar for mye plass på skjermen.",
      "Savner bedre kontrast på knappene.",
      "Kunne vært tydeligere hva som er neste steg i prosessen.",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Redacted / Errors
  // ------------------------------------------------
  {
    rating: 1,
    tags: ["🐛 Bug", "🔥 Kritisk"],
    isRedacted: true,
    comments: [
      "Systemet henger seg opp når vi prøver å sende inn for [MULIG NAVN FJERNET].",
      "Får ikke sendt planen for [FØDSELSNUMMER FJERNET] selv om alt er fylt ut.",
      "Org nr [ORGNUMMER FJERNET] kommer ikke opp i listen.",
      "Sendte epost til [E-POST FJERNET] men fikk ikke svar.",
      "Feilmelding ved bruk av firmakort [KORTNUMMER FJERNET].",
      "Systemet kræsjer ved innsending som [NAVIDENT FJERNET].",
    ],
  },
  // ------------------------------------------------
  // TOPIC: Empty
  // ------------------------------------------------
  { rating: 4, tags: [], comments: new Array(10).fill("") },
  { rating: 3, tags: [], comments: new Array(5).fill("") },
];

export const PRIORITY_TASKS = [
  { id: "melde-sykefravaer", label: "Melde sykefravær", weight: 0.18 },
  { id: "sok-dagpenger", label: "Søke dagpenger", weight: 0.15 },
  { id: "finne-skjema", label: "Finne riktig skjema", weight: 0.12 },
  { id: "sjekke-status", label: "Sjekke søknadsstatus", weight: 0.1 },
  { id: "lese-rettigheter", label: "Lese om mine rettigheter", weight: 0.08 },
  { id: "kontakte-nav", label: "Kontakte NAV", weight: 0.07 },
  { id: "oppdatere-cv", label: "Oppdatere CV", weight: 0.06 },
  { id: "dialogmote", label: "Forberede dialogmøte", weight: 0.05 },
  { id: "oppfolgingsplan", label: "Lese oppfølgingsplan", weight: 0.04 },
  { id: "endre-inntekt", label: "Melde endring i inntekt", weight: 0.03 },
  { id: "sok-arbeidsavklaring", label: "Søke arbeidsavklaring", weight: 0.025 },
  { id: "finne-telefon", label: "Finne telefonnummer", weight: 0.02 },
  { id: "se-utbetalinger", label: "Se utbetalingsoversikt", weight: 0.015 },
  { id: "logge-inn", label: "Logge inn", weight: 0.01 },
  { id: "annet", label: "Annet", weight: 0.005 },
];

export const DISCOVERY_RESPONSES = [
  "Sjekke status på søknaden min",
  "Finne telefonnummer til NAV",
  "Lese om sykemelding",
  "Melde fra om endring i inntekt",
  "Finne skjema for arbeidsavklaring",
  "Sjekke utbetalingsdatoer",
  "Lese om mine rettigheter som sykmeldt",
  "Kontakte saksbehandler",
  "Finne informasjon om dialogmøte",
  "Oppdatere personlige opplysninger",
  "Sjekke hva jeg får i stønad",
  "Finne ut hvordan jeg søker dagpenger",
  "Lese om reglene for fravær",
  "Se min sakshistorikk",
  "Finne informasjon om oppfølgingsplan",
];
