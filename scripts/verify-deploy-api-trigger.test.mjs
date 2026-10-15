import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readYaml = (...segments) =>
  load(readFileSync(path.join(repositoryRoot, ...segments), "utf8"));

const workflow = readYaml(".github", "workflows", "deploy-api.yaml");
const devManifest = readYaml("apps", "lumi-api", "nais", "app", "dev.yaml");
const prodManifest = readYaml("apps", "lumi-api", "nais", "app", "prod.yaml");

const normalizeExpression = (expression) =>
  expression.replace(/\s+/g, " ").trim();
// Push runs deploy the exact commit that triggered them, not the branch tip.
const selectedRefExpression = "$" + "{{ inputs.ref || github.sha }}";
const buildImageExpression = normalizeExpression(
  "github.event_name == 'workflow_dispatch' || steps.what-changed.outputs.changed != 'non-inputs'",
);

const findStep = (job, predicate) => job.steps.find(predicate);
const buildJob = workflow.jobs.build;
const checkoutStep = findStep(buildJob, (step) =>
  step.uses?.startsWith("actions/checkout@"),
);
const whatChangedStep = findStep(
  buildJob,
  (step) => step.id === "what-changed",
);
const imageBuildSteps = buildJob.steps.filter((step) =>
  [
    "Setup Java",
    "Setup Gradle",
    "Build with Gradle",
    "Push docker image to GAR",
  ].includes(step.name),
);
const imageBuildInputs = whatChangedStep.with.files
  .split(",")
  .map((input) => input.trim());

const shouldBuildImage = (changedFiles, eventName = "push") =>
  eventName === "workflow_dispatch" ||
  changedFiles.some((file) =>
    imageBuildInputs.some((pattern) => path.matchesGlob(file, pattern)),
  );

test("API push deploys run only for API changes on main", () => {
  assert.deepEqual(workflow.on.push, {
    branches: ["main"],
    paths: ["apps/lumi-api/**"],
  });
});

test("API workflow changes are validated in pull requests and manual inputs stay available", () => {
  assert.deepEqual(workflow.on.pull_request, {
    paths: ["apps/lumi-api/**", ".github/workflows/deploy-api.yaml"],
  });
  assert.deepEqual(workflow.on.workflow_dispatch.inputs, {
    target: {
      description: "Where to deploy",
      type: "choice",
      required: true,
      options: ["dev", "prod"],
    },
    ref: {
      description:
        "Git ref to deploy (branch/tag/sha). Defaults to the ref you run the workflow from.",
      type: "string",
      required: false,
    },
  });
});

test("automatic and manual deploys follow the intended environment sequence", () => {
  assert.equal(
    normalizeExpression(workflow.jobs["deploy-dev"].if),
    normalizeExpression(`
      (github.event_name == 'push' && github.ref == 'refs/heads/main') ||
      (github.event_name == 'workflow_dispatch' &&
        (inputs.target == 'dev' || inputs.target == 'prod'))
    `),
  );
  assert.equal(
    normalizeExpression(workflow.jobs["deploy-prod"].if),
    normalizeExpression(`
      (github.event_name == 'push' && github.ref == 'refs/heads/main') ||
      (github.event_name == 'workflow_dispatch' && inputs.target == 'prod')
    `),
  );
  assert.deepEqual(workflow.jobs["deploy-prod"].needs, ["build", "deploy-dev"]);
  assert.equal(checkoutStep.with.ref, selectedRefExpression);
  assert.equal(checkoutStep.with["fetch-depth"], 0);
  assert.equal(
    workflow.jobs["deploy-dev"].steps[0].with.ref,
    selectedRefExpression,
  );
  assert.equal(
    workflow.jobs["deploy-prod"].steps[0].with.ref,
    selectedRefExpression,
  );
});

test("API deploys are serialized per environment and prod uses the prod environment", () => {
  for (const [jobName, environment] of [
    ["deploy-dev", "dev"],
    ["deploy-prod", "prod"],
  ]) {
    assert.deepEqual(workflow.jobs[jobName].concurrency, {
      group: `deploy-api-${environment}`,
      "cancel-in-progress": false,
    });
    // A hanging deploy must not block the concurrency group indefinitely.
    assert.equal(workflow.jobs[jobName]["timeout-minutes"], 15);
  }
  assert.equal(workflow.concurrency, undefined);
  assert.equal(workflow.jobs.build.concurrency, undefined);
  assert.equal(workflow.jobs["deploy-prod"].environment, "prod");
});

test("API prod deploy applies the alert rules with the app manifest", () => {
  const deployStep = findStep(workflow.jobs["deploy-prod"], (step) =>
    step.uses?.startsWith("nais/deploy/actions/deploy@"),
  );
  assert.deepEqual(deployStep.env.RESOURCE.split(","), [
    "apps/lumi-api/nais/app/prod.yaml",
    "apps/lumi-api/nais/alerts/prod.yaml",
  ]);

  const alertRules = readYaml(
    "apps",
    "lumi-api",
    "nais",
    "alerts",
    "prod.yaml",
  );
  const rule = alertRules.spec.groups
    .flatMap((group) => group.rules)
    .find((candidate) => candidate.alert === "LumiApiNoAvailableReplicas");
  assert.ok(rule);
  assert.equal(
    rule.expr,
    'kube_deployment_status_replicas_available{namespace="team-esyfo",deployment="lumi-api"} == 0',
  );
  assert.equal(rule.for, "5m");
  assert.equal(rule.labels.namespace, "team-esyfo");
});

test("API image builds use the pinned monorepo-aware change detector", () => {
  assert.equal(buildJob.permissions.actions, "read");
  assert.equal(
    whatChangedStep.uses,
    "nais/what-changed@e253615426610a2e873ada19749ca58896f3679f",
  );
  assert.equal(whatChangedStep.if, "github.event_name != 'workflow_dispatch'");
  assert.deepEqual(imageBuildInputs, [
    ".github/workflows/deploy-api.yaml",
    "apps/lumi-api/Dockerfile",
    "apps/lumi-api/build.gradle.kts",
    "apps/lumi-api/gradle.properties",
    "apps/lumi-api/gradle/**",
    "apps/lumi-api/gradlew",
    "apps/lumi-api/gradlew.bat",
    "apps/lumi-api/settings.gradle.kts",
    "apps/lumi-api/src/main/**",
  ]);
  assert.equal(imageBuildSteps.length, 4);
  for (const step of imageBuildSteps) {
    assert.equal(normalizeExpression(step.if), buildImageExpression);
  }
});

test("API image build classification covers manifest, code, mixed, and manual changes", () => {
  assert.equal(shouldBuildImage(["apps/lumi-api/nais/app/prod.yaml"]), false);
  assert.equal(
    shouldBuildImage([
      "apps/lumi-api/nais/app/prod.yaml",
      "docs/dashboard/tilgang.md",
    ]),
    false,
  );
  assert.equal(
    shouldBuildImage([
      "apps/lumi-api/src/main/kotlin/no/nav/lumi/Application.kt",
    ]),
    true,
  );
  assert.equal(
    shouldBuildImage([
      "apps/lumi-api/nais/app/prod.yaml",
      "apps/lumi-api/src/main/resources/logback.xml",
    ]),
    true,
  );
  assert.equal(
    shouldBuildImage(["apps/lumi-api/nais/app/prod.yaml"], "workflow_dispatch"),
    true,
  );
});

test("API deploys use WORKLOAD_IMAGE and manifests do not template an image", () => {
  assert.equal(devManifest.spec.image, undefined);
  assert.equal(prodManifest.spec.image, undefined);

  for (const jobName of ["deploy-dev", "deploy-prod"]) {
    const deployStep = findStep(workflow.jobs[jobName], (step) =>
      step.uses?.startsWith("nais/deploy/actions/deploy@"),
    );
    assert.equal(
      deployStep.env.WORKLOAD_IMAGE,
      "$" + "{{ needs.build.outputs.image }}",
    );
    assert.equal(deployStep.env.VAR, undefined);
  }
});

test("pull requests that only change app manifests skip Kotlin tests and full-chain", () => {
  const ciWorkflow = readYaml(".github", "workflows", "ci.yaml");
  const changesJob = ciWorkflow.jobs.changes;
  const filterStep = findStep(changesJob, (step) => step.id === "filter");
  const manifestStep = findStep(
    changesJob,
    (step) => step.id === "app-manifests",
  );

  assert.equal(manifestStep.if, "github.event_name == 'pull_request'");
  assert.equal(manifestStep.uses, filterStep.uses);
  assert.equal(manifestStep.with["predicate-quantifier"], "every");
  assert.equal(filterStep.with["predicate-quantifier"], undefined);
  const manifestPatterns = load(manifestStep.with.filters).outside;
  assert.deepEqual(manifestPatterns, [
    "!apps/lumi-api/nais/app/**",
    "!apps/lumi-submission-proxy/nais/**",
  ]);
  assert.equal(
    changesJob.outputs.app_manifests_only,
    "$" + "{{ steps.app-manifests.outputs.outside == 'false' }}",
  );

  for (const [jobName, output] of [
    ["api", "api"],
    ["full-chain", "full_chain"],
  ]) {
    assert.equal(
      normalizeExpression(ciWorkflow.jobs[jobName].if),
      normalizeExpression(`
        always() && (
          github.event_name == 'merge_group' ||
          (needs.changes.outputs.${output} == 'true' &&
            needs.changes.outputs.app_manifests_only != 'true')
        )
      `),
    );
  }

  // With predicate-quantifier every, a changed file counts only when it
  // matches every negated pattern, that is, when it is outside both folders.
  const touchesMoreThanAppManifests = (files) =>
    files.some((file) =>
      manifestPatterns.every(
        (pattern) => !path.matchesGlob(file, pattern.slice(1)),
      ),
    );
  assert.equal(
    touchesMoreThanAppManifests(["apps/lumi-api/nais/app/prod.yaml"]),
    false,
  );
  assert.equal(
    touchesMoreThanAppManifests([
      "apps/lumi-api/nais/app/dev.yaml",
      "apps/lumi-submission-proxy/nais/dev.yaml",
    ]),
    false,
  );
  // RetentionAlertRulesTest reads the alert rules, so they keep the tests.
  assert.equal(
    touchesMoreThanAppManifests(["apps/lumi-api/nais/alerts/prod.yaml"]),
    true,
  );
  assert.equal(
    touchesMoreThanAppManifests([
      "apps/lumi-api/nais/app/prod.yaml",
      "apps/lumi-api/src/main/kotlin/no/nav/lumi/Application.kt",
    ]),
    true,
  );
});

test("Nais files read by these guards run the release guards in CI", () => {
  const ciWorkflow = readYaml(".github", "workflows", "ci.yaml");
  const filters = load(
    findStep(ciWorkflow.jobs.changes, (step) => step.id === "filter").with
      .filters,
  );
  const coversFile = (patterns, file) =>
    patterns.some((pattern) => path.matchesGlob(file, pattern));

  // The node job does not run for API or proxy changes, so these files rely
  // on the lighter release-guards job.
  for (const file of [
    "apps/lumi-api/nais/app/dev.yaml",
    "apps/lumi-api/nais/app/prod.yaml",
    "apps/lumi-api/nais/alerts/prod.yaml",
    "apps/lumi-submission-proxy/nais/dev.yaml",
  ]) {
    assert.equal(coversFile(filters.node, file), false, file);
    assert.equal(coversFile(filters.release_guards, file), true, file);
  }
  assert.equal(
    ciWorkflow.jobs.changes.outputs.release_guards,
    "$" + "{{ steps.filter.outputs.release_guards }}",
  );

  const guardsJob = ciWorkflow.jobs["release-guards"];
  assert.equal(guardsJob.needs, "changes");
  assert.equal(
    normalizeExpression(guardsJob.if),
    normalizeExpression(`
      always() &&
      needs.changes.outputs.release_guards == 'true' &&
      needs.changes.outputs.node != 'true'
    `),
  );
  assert.ok(
    guardsJob.steps.some((step) => step.run === "pnpm run test:release-guards"),
  );
  assert.ok(ciWorkflow.jobs.required.needs.includes("release-guards"));
  assert.match(
    ciWorkflow.jobs.required.steps[0].run,
    /"release-guards=\$\{\{ needs\.release-guards\.result \}\}"/,
  );
});
