import {
  Alert,
  BodyLong,
  BodyShort,
  Box,
  Button,
  Heading,
  HGrid,
  HStack,
  Loader,
  Select,
  Tag,
  VStack,
} from "@navikt/ds-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { z } from "zod";
import { AnalysisEditor } from "~/components/analysisProducts/AnalysisEditor";
import { Header } from "~/components/shared/Header";
import {
  getAnalysisCatalog,
  getAnalysisProduct,
  getAnalysisReleases,
  listAnalysisProducts,
} from "~/server/actions/analysisProducts";
import { fetchTeamsServerFn } from "~/server/actions/fetchTeams";
import type {
  AnalysisProduct,
  AnalysisRelease,
} from "~/types/analysisProducts";

export const Route = createFileRoute("/analyseprodukter")({
  validateSearch: zodValidator(
    z.object({
      team: z.string().optional(),
      productId: z.union([z.string().uuid(), z.literal("new")]).optional(),
    }),
  ),
  component: AnalysisProductsPage,
});

function AnalysisProductsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeamsServerFn(),
  });
  const availableTeams = Object.keys(teams.data?.teams ?? {}).sort();
  const team = search.team ?? availableTeams[0];
  const authorized = Boolean(team && availableTeams.includes(team));
  return (
    <>
      <Header />
      <Box
        as="main"
        className="main-container"
        style={{ overflowWrap: "anywhere", maxWidth: "76rem" }}
        paddingInline={{ xs: "space-12", sm: "space-16" }}
        paddingBlock={{ xs: "space-24", md: "space-40" }}
      >
        <VStack gap="space-24">
          <Link to="/export" search={{ team }}>
            Til eksport
          </Link>
          <div>
            <Heading level="1" size="xlarge" spacing>
              Analyseprodukter
            </Heading>
            <BodyLong>
              Velg et fast datagrunnlag for teamets analyser. Kontroller
              formatet og lås en kontrakt for senere levering.
            </BodyLong>
          </div>
          <Alert variant="info" size="small">
            Du kan klargjøre kontrakter her. Ingen data leveres til Metabase
            eller Datafortelling ennå.
          </Alert>
          {teams.isPending ? (
            <Loader title="Henter team" />
          ) : teams.isError || !availableTeams.length ? (
            <Alert variant="error">Kunne ikke hente teamene dine.</Alert>
          ) : (
            <>
              <Select
                label="Team"
                value={authorized ? team : ""}
                onChange={(event) =>
                  navigate({ search: { team: event.target.value } })
                }
              >
                {!authorized && (
                  <option value="" disabled>
                    Velg et tilgjengelig team
                  </option>
                )}
                {availableTeams.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
              {!authorized || !team ? (
                <Alert variant="error">
                  Teamet i lenken er ikke tilgjengelig for deg. Ingen data er
                  hentet for dette teamet.
                </Alert>
              ) : (
                <TeamProducts
                  key={JSON.stringify([team, search.productId])}
                  team={team}
                  productId={search.productId}
                />
              )}
            </>
          )}
        </VStack>
      </Box>
    </>
  );
}

function TeamProducts({
  team,
  productId,
}: {
  team: string;
  productId?: string;
}) {
  const navigate = Route.useNavigate();
  const cache = useQueryClient();
  const list = useQuery({
    queryKey: ["analysis-products", team],
    queryFn: () => listAnalysisProducts({ data: { team } }),
    enabled: !productId,
  });
  const product = useQuery({
    queryKey: ["analysis-product", team, productId],
    queryFn: () => {
      if (!productId || productId === "new")
        throw new Error("Velg et lagret produkt.");
      return getAnalysisProduct({ data: { team, productId } });
    },
    enabled: Boolean(productId && productId !== "new"),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ["analysis-catalog", team],
    queryFn: () => getAnalysisCatalog({ data: { team } }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const demoNotice = catalog.data?.demo ? (
    <Alert variant="warning" size="small">
      Lokal demo: forenklede eksempelkolonner og midlertidige utkast og
      releaser. Den virkelige kontrakten beregnes av API-et.
    </Alert>
  ) : null;
  async function saved(value: AnalysisProduct) {
    cache.setQueryData(["analysis-product", team, value.id], value);
    void cache.invalidateQueries({ queryKey: ["analysis-products", team] });
    if (productId !== value.id)
      await navigate({
        search: { team, productId: value.id },
        replace: true,
        resetScroll: false,
      });
  }
  async function locked(release: AnalysisRelease) {
    cache.setQueryData(
      ["analysis-releases", team, release.productId],
      [release],
    );
    if (product.data)
      await saved({
        ...product.data,
        draft: null,
        lastReleaseNumber: release.releaseNumber,
      });
  }
  if (!productId)
    return (
      <VStack gap="space-20">
        {demoNotice}
        <HStack justify="space-between" align="center" gap="space-16">
          <Heading level="2" size="medium">
            Teamets produkter
          </Heading>
          <Button
            onClick={() => navigate({ search: { team, productId: "new" } })}
            disabled={
              list.isPending ||
              list.isError ||
              (list.data?.filter((item) => item.lifecycleState !== "DELETED")
                .length ?? 0) >= 10
            }
          >
            Nytt analyseprodukt
          </Button>
        </HStack>
        {(list.data?.filter((item) => item.lifecycleState !== "DELETED")
          .length ?? 0) >= 10 && (
          <Alert variant="info">
            Teamet har ti produkter. Fortsett på et eksisterende utkast.
          </Alert>
        )}
        {list.isPending ? (
          <Loader title="Henter analyseprodukter" />
        ) : list.isError ? (
          <Alert variant="error">
            Produktene kunne ikke hentes.{" "}
            <Button
              size="small"
              variant="tertiary"
              onClick={() => list.refetch()}
            >
              Prøv igjen
            </Button>
          </Alert>
        ) : list.data?.length ? (
          list.data.map((item) => (
            <ProductCard key={item.id} team={team} product={item} />
          ))
        ) : (
          <Box
            padding="space-24"
            background="raised"
            borderWidth="1"
            borderColor="neutral-subtle"
            borderRadius="12"
          >
            <Heading level="3" size="small" spacing>
              Ingen analyseprodukter ennå
            </Heading>
            <BodyShort>
              Start med et navngitt utkast. Du velger hvilke surveys og felt som
              skal inngå før du låser kontrakten.
            </BodyShort>
          </Box>
        )}
      </VStack>
    );
  const creating = productId === "new";
  return (
    <VStack gap="space-24">
      {demoNotice}
      <Link to="/analyseprodukter" search={{ team }}>
        Alle analyseprodukter
      </Link>
      {creating && (
        <BodyShort size="small" textColor="subtle">
          Et lagret utkast bruker én av teamets ti produktplasser. Gjenbruk
          utkastet når du vil endre valgene.
        </BodyShort>
      )}
      {!creating && product.isPending ? (
        <Loader title="Henter analyseprodukt" />
      ) : !creating && product.isError ? (
        <Alert variant="error">
          Produktet kunne ikke hentes for dette teamet.
        </Alert>
      ) : !creating &&
        product.data &&
        ["DELETED", "OFFBOARDING"].includes(product.data.lifecycleState) ? (
        <Alert variant="info">
          Produktet er avsluttet eller under avvikling og kan ikke redigeres
          eller låses.
        </Alert>
      ) : !creating && product.data && !product.data.draft ? (
        <ReleasedProduct team={team} product={product.data} />
      ) : catalog.isPending ? (
        <Loader title="Henter kildekatalog" />
      ) : catalog.isError ? (
        <Alert variant="error">
          Kildekatalogen kunne ikke hentes.{" "}
          <Button
            size="small"
            variant="tertiary"
            onClick={() => catalog.refetch()}
          >
            Prøv igjen
          </Button>
        </Alert>
      ) : catalog.data ? (
        <VStack gap="space-16">
          <AnalysisEditor
            team={team}
            product={creating ? null : (product.data ?? null)}
            catalog={catalog.data}
            onSaved={saved}
            onLocked={locked}
          />
        </VStack>
      ) : null}
    </VStack>
  );
}

function ProductCard({
  team,
  product,
}: {
  team: string;
  product: AnalysisProduct;
}) {
  const releases = useQuery({
    queryKey: ["analysis-releases", team, product.id],
    queryFn: () =>
      getAnalysisReleases({ data: { team, productId: product.id } }),
    enabled: !product.draft,
  });
  const name =
    product.draft?.document.name ??
    releases.data?.[0]?.sourceDocument.name ??
    `Produkt ${product.id.slice(0, 8)}`;
  return (
    <Box
      background="raised"
      borderWidth="1"
      borderColor="neutral-subtle"
      borderRadius="8"
      padding="space-20"
    >
      <HStack justify="space-between" align="center" gap="space-12">
        <div>
          <Heading level="3" size="small" spacing>
            <Link
              to="/analyseprodukter"
              search={{ team, productId: product.id }}
            >
              {name}
            </Link>
          </Heading>
          <BodyShort size="small" textColor="subtle">
            {product.draft
              ? "Fortsett på utkastet"
              : `Release ${product.lastReleaseNumber} låst`}
          </BodyShort>
        </div>
        <Tag data-color="neutral" variant="outline" size="small">
          {product.draft ? "Utkast" : "Kontrakt opprettet"}
        </Tag>
      </HStack>
    </Box>
  );
}

function ReleasedProduct({
  team,
  product,
}: {
  team: string;
  product: AnalysisProduct;
}) {
  const releases = useQuery({
    queryKey: ["analysis-releases", team, product.id],
    queryFn: () =>
      getAnalysisReleases({ data: { team, productId: product.id } }),
  });
  if (releases.isPending) return <Loader title="Henter release" />;
  if (releases.isError)
    return (
      <Alert variant="error">
        Releasen kunne ikke hentes.{" "}
        <Button variant="tertiary" onClick={() => releases.refetch()}>
          Prøv igjen
        </Button>
      </Alert>
    );
  return (
    <VStack gap="space-24">
      {releases.data.map((release) => (
        <Box
          key={release.id}
          background="raised"
          borderWidth="1"
          borderColor="neutral-subtle"
          borderRadius="12"
          padding={{ xs: "space-16", md: "space-24" }}
        >
          <VStack gap="space-16">
            <div>
              <Tag variant="outline" data-color="success" size="small">
                Release {release.releaseNumber} låst
              </Tag>
            </div>
            <Heading level="2" size="medium">
              {release.sourceDocument.name}
            </Heading>
            <BodyLong>{release.sourceDocument.purpose}</BodyLong>
            <HGrid columns={{ xs: 1, sm: 2 }} gap="space-12">
              <BodyShort>
                <strong>Dataeier:</strong> {release.sourceDocument.dataOwner}
              </BodyShort>
              <BodyShort>
                <strong>Teknisk ansvarlig:</strong>{" "}
                {release.sourceDocument.technicalOwner}
              </BodyShort>
              <BodyShort>
                <strong>Datavindu:</strong>{" "}
                {
                  {
                    DAYS_30: "30 dager",
                    DAYS_90: "90 dager",
                    DAYS_180: "180 dager",
                    SOURCE_MAXIMUM: "Så lenge data finnes i Lumi",
                  }[release.sourceDocument.retention]
                }
              </BodyShort>
              <BodyShort>
                <strong>Ny vurdering innen:</strong>{" "}
                {dayjs(release.sourceDocument.reviewDate).format("DD.MM.YYYY")}
              </BodyShort>
            </HGrid>
            <BodyShort>
              Kontrakten er opprettet. Dette er ikke en bekreftelse på at data
              er publisert eller at levering er aktivert.
            </BodyShort>
            <Heading level="3" size="small">
              Valgt datagrunnlag
            </Heading>
            {release.sourceDocument.sources.map((source) => (
              <BodyShort key={JSON.stringify([source.app, source.surveyId])}>
                {source.app} / {source.surveyId}:{" "}
                {source.fieldIds.length
                  ? source.fieldIds.join(", ")
                  : "Bare svarrader, ingen svarfelt"}
              </BodyShort>
            ))}
            <BodyShort>
              Metadata:{" "}
              {release.sourceDocument.dimensionKeys.join(", ") || "Ingen"}.
              Innsendt time:{" "}
              {release.sourceDocument.includeSubmittedHour ? "Ja" : "Nei"}.
            </BodyShort>
            <BodyShort size="small" textColor="subtle">
              Releasen er uforanderlig. Nytt utkast fra en release er ikke
              tilgjengelig i denne flyten ennå.
            </BodyShort>
          </VStack>
        </Box>
      ))}
    </VStack>
  );
}
