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

const readWorkflow = (filename) =>
  load(
    readFileSync(
      path.join(repositoryRoot, ".github", "workflows", filename),
      "utf8",
    ),
  );

const workflow = readWorkflow("deploy-dashboard.yaml");
const ciWorkflow = readWorkflow("ci.yaml");
const normalizeExpression = (value) => value.replace(/\s+/g, " ").trim();
const normalizeShell = (value) =>
  normalizeExpression(value.replace(/\\\r?\n/g, " "));
const expression = (value) => `\${{ ${value} }}`;
const filterStep = ciWorkflow.jobs.changes.steps.find(
  (step) => step.id === "filter",
);
const filters = load(filterStep.with.filters);
const dashboardDeployPaths = filters.dashboard_deploy;
const nodePaths = filters.node;

const matchesPath = (patterns, filename) =>
  patterns.some((pattern) => {
    if (pattern.endsWith("/**")) {
      return filename.startsWith(pattern.slice(0, -2));
    }
    if (pattern === "tsconfig*.json") {
      return /^tsconfig[^/]*\.json$/.test(filename);
    }
    return filename === pattern;
  });

const requiresDashboardDeploy = (filenames) =>
  filenames.some((filename) => matchesPath(dashboardDeployPaths, filename));

const requiresNodeCI = (filenames) =>
  filenames.some((filename) => matchesPath(nodePaths, filename));

const resolveCiScope = ({
  currentPushHasDashboardChanges,
  currentPushNeedsNode,
  currentPushNeedsFullChain,
  previousMainCiSucceeded,
}) => {
  const recoversUnvalidatedPredecessor = !previousMainCiSucceeded;

  return {
    dashboardDeploy:
      currentPushHasDashboardChanges || recoversUnvalidatedPredecessor,
    node: currentPushNeedsNode || recoversUnvalidatedPredecessor,
    fullChain: currentPushNeedsFullChain || recoversUnvalidatedPredecessor,
  };
};

test("CI publishes dashboard deployment scope for the exact main push", () => {
  assert.equal(
    ciWorkflow.jobs.changes.outputs.dashboard_deploy,
    expression(
      "steps.dashboard-scope.outputs.required || steps.filter.outputs.dashboard_deploy",
    ),
  );
  assert.equal(
    ciWorkflow.jobs.changes.outputs.node,
    expression(
      "steps.dashboard-scope.outputs.node || steps.filter.outputs.node",
    ),
  );
  assert.equal(
    ciWorkflow.jobs.changes.outputs.full_chain,
    expression(
      "steps.dashboard-scope.outputs.full_chain || steps.filter.outputs.full_chain",
    ),
  );
  assert.deepEqual(ciWorkflow.jobs.changes.permissions, {
    actions: "read",
    contents: "read",
  });
  assert.deepEqual(dashboardDeployPaths, [
    ".github/workflows/deploy-dashboard.yaml",
    ".npmrc",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig*.json",
    "apps/lumi-dashboard/**",
    "packages/lumi-survey/**",
    "packages/lumi-types/**",
  ]);

  const recordStep = ciWorkflow.jobs.changes.steps.find(
    (step) => step.name === "Record dashboard deployment scope",
  );
  const publishStep = ciWorkflow.jobs.changes.steps.find(
    (step) => step.name === "Publish dashboard deployment scope",
  );
  const mainPushCondition =
    "github.event_name == 'push' && github.ref == 'refs/heads/main'";

  assert.equal(recordStep.if, mainPushCondition);
  assert.equal(recordStep.id, "dashboard-scope");
  assert.equal(
    recordStep.env.DASHBOARD_DEPLOY_REQUIRED,
    expression("steps.filter.outputs.dashboard_deploy"),
  );
  assert.equal(
    recordStep.env.NODE_REQUIRED,
    expression("steps.filter.outputs.node"),
  );
  assert.equal(
    recordStep.env.FULL_CHAIN_REQUIRED,
    expression("steps.filter.outputs.full_chain"),
  );
  assert.equal(recordStep.env.BEFORE_SHA, expression("github.event.before"));
  assert.equal(recordStep.env.GH_TOKEN, expression("github.token"));
  assert.equal(recordStep.env.REPOSITORY, expression("github.repository"));
  assert.match(
    normalizeShell(recordStep.run),
    /gh run list --repo "\$REPOSITORY" --workflow ci\.yaml --commit "\$BEFORE_SHA" --branch main --event push --status success --limit 1 --json databaseId --jq 'length' \|\| true/,
  );
  assert.match(
    normalizeShell(recordStep.run),
    /required.*DASHBOARD_DEPLOY_REQUIRED.*node_required.*NODE_REQUIRED.*full_chain_required.*FULL_CHAIN_REQUIRED.*previous_success_count.*previous_success_count.*1.*required=true.*node_required=true.*full_chain_required=true/,
  );
  assert.match(recordStep.run, /dashboard-deploy-scope\/required/);
  assert.match(recordStep.run, /required=\$required/);
  assert.match(recordStep.run, /node=\$node_required/);
  assert.match(recordStep.run, /full_chain=\$full_chain_required/);
  assert.equal(publishStep.if, mainPushCondition);
  assert.equal(publishStep["continue-on-error"], true);
  assert.equal(publishStep.with.name, "dashboard-deploy-scope");
  assert.equal(
    publishStep.with.path,
    `${expression("runner.temp")}/dashboard-deploy-scope/required`,
  );
  assert.equal(publishStep.with["retention-days"], 1);
});

test("API-only and docs-only pushes classify as unrelated to the dashboard", () => {
  assert.equal(
    requiresDashboardDeploy([
      "apps/lumi-api/src/main/kotlin/no/nav/lumi/Application.kt",
    ]),
    false,
  );
  assert.equal(
    requiresDashboardDeploy(["apps/lumi-submission-proxy/build.gradle.kts"]),
    false,
  );
  assert.equal(
    requiresDashboardDeploy(["docs/runbooks/nav-wide-rollout.md"]),
    false,
  );
});

test("a canceled or failed predecessor forces validation before cumulative deploy", () => {
  assert.deepEqual(
    resolveCiScope({
      currentPushHasDashboardChanges: false,
      currentPushNeedsNode: false,
      currentPushNeedsFullChain: false,
      previousMainCiSucceeded: true,
    }),
    { dashboardDeploy: false, node: false, fullChain: false },
  );
  assert.deepEqual(
    resolveCiScope({
      currentPushHasDashboardChanges: false,
      currentPushNeedsNode: false,
      currentPushNeedsFullChain: false,
      previousMainCiSucceeded: false,
    }),
    { dashboardDeploy: true, node: true, fullChain: true },
  );
  assert.deepEqual(
    resolveCiScope({
      currentPushHasDashboardChanges: true,
      currentPushNeedsNode: true,
      currentPushNeedsFullChain: false,
      previousMainCiSucceeded: false,
    }),
    { dashboardDeploy: true, node: true, fullChain: true },
  );
  assert.deepEqual(
    resolveCiScope({
      currentPushHasDashboardChanges: true,
      currentPushNeedsNode: true,
      currentPushNeedsFullChain: false,
      previousMainCiSucceeded: true,
    }),
    { dashboardDeploy: true, node: true, fullChain: false },
  );
});

test("dashboard build inputs require both Node CI and a deploy", () => {
  const relevantFixtures = [
    "apps/lumi-dashboard/app/routes/index.tsx",
    "apps/lumi-dashboard/nais/prod.yaml",
    "apps/lumi-dashboard/Dockerfile",
    "packages/lumi-survey/src/index.ts",
    "packages/lumi-types/src/api.ts",
    ".github/workflows/deploy-dashboard.yaml",
    ".npmrc",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.shared.json",
  ];

  for (const filename of relevantFixtures) {
    assert.equal(
      requiresNodeCI([filename]),
      true,
      `${filename} must pass Node CI before deployment`,
    );
    assert.equal(
      requiresDashboardDeploy([filename]),
      true,
      `${filename} must trigger dashboard deployment`,
    );
  }
  assert.equal(
    requiresDashboardDeploy([
      "apps/lumi-api/src/main/kotlin/no/nav/lumi/Application.kt",
      "packages/lumi-types/src/api.ts",
    ]),
    true,
  );
});

test("automatic dashboard builds require a relevant change from the successful CI run", () => {
  const deploymentScope = workflow.jobs["deployment-scope"];
  assert.ok(deploymentScope);
  assert.equal(
    normalizeExpression(deploymentScope.if),
    "github.event_name == 'workflow_run' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.conclusion == 'success'",
  );
  assert.equal(
    deploymentScope.outputs.required,
    expression("steps.decision.outputs.required"),
  );

  assert.deepEqual(workflow.jobs["build-demo"].needs, [
    "checks",
    "deployment-scope",
  ]);
  assert.equal(
    normalizeExpression(workflow.jobs["build-demo"].if),
    normalizeExpression(`
      always() && (
        (github.event_name == 'workflow_run' &&
          github.event.workflow_run.conclusion == 'success' &&
          needs.deployment-scope.outputs.required == 'true') ||
        (needs.checks.result == 'success' && (
          startsWith(github.ref_name, 'demo-') ||
          (github.event_name == 'workflow_dispatch' && inputs.target == 'demo')
        ))
      )
    `),
  );

  assert.deepEqual(workflow.jobs["build-production"].needs, [
    "checks",
    "deployment-scope",
  ]);
  assert.equal(
    normalizeExpression(workflow.jobs["build-production"].if),
    normalizeExpression(`
      always() && (
        (github.event_name == 'workflow_run' &&
          github.event.workflow_run.conclusion == 'success' &&
          needs.deployment-scope.outputs.required == 'true') ||
        (needs.checks.result == 'success' &&
          github.event_name == 'workflow_dispatch' &&
          (inputs.target == 'dev' || inputs.target == 'prod'))
      )
    `),
  );
});

test("missing or invalid CI scope fails open to deployment", () => {
  const deploymentScope = workflow.jobs["deployment-scope"];
  assert.equal(workflow.permissions.actions, undefined);
  assert.deepEqual(deploymentScope.permissions, { actions: "read" });

  const scopeSteps = deploymentScope.steps;
  const downloadStep = scopeSteps.find((step) => step.id === "download");
  const decisionStep = scopeSteps.find((step) => step.id === "decision");

  assert.equal(downloadStep["continue-on-error"], true);
  assert.equal(
    downloadStep.env.RUN_ID,
    expression("github.event.workflow_run.id"),
  );
  assert.equal(
    downloadStep.env.SCOPE_DIR,
    `${expression("runner.temp")}/dashboard-deploy-scope`,
  );
  assert.match(
    normalizeExpression(downloadStep.run),
    /gh run download "\$RUN_ID" --repo "\$REPOSITORY" --name dashboard-deploy-scope --dir "\$SCOPE_DIR"/,
  );
  assert.match(downloadStep.run, /"\$SCOPE_DIR\/required"/);
  assert.match(downloadStep.run, /true\|false/);
  assert.equal(decisionStep.if, "always()");
  assert.match(decisionStep.run, /required=true/);
  assert.match(
    normalizeExpression(decisionStep.run),
    /DOWNLOAD_OUTCOME.*success.*DOWNLOADED_REQUIRED.*false.*required=false/,
  );
  assert.match(decisionStep.run, /::warning::/);
});

test("manual and demo deployments follow the complete routes with one exact ref", () => {
  assert.deepEqual(workflow.on.push, { branches: ["demo-*"] });
  assert.deepEqual(workflow.on.workflow_run, {
    workflows: ["CI"],
    types: ["completed"],
    branches: ["main"],
  });
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.target.options, [
    "demo",
    "dev",
    "prod",
  ]);

  assert.equal(workflow.jobs["deploy-demo"].needs, "build-demo");
  assert.equal(
    normalizeExpression(workflow.jobs["deploy-demo"].if),
    normalizeExpression(`
      always() && needs.build-demo.result == 'success' && (
        github.event_name == 'workflow_run' ||
        startsWith(github.ref_name, 'demo-') ||
        (github.event_name == 'workflow_dispatch' && inputs.target == 'demo')
      )
    `),
  );
  assert.equal(workflow.jobs["deploy-dev"].needs, "build-production");
  assert.equal(
    normalizeExpression(workflow.jobs["deploy-dev"].if),
    normalizeExpression(`
      always() && needs.build-production.result == 'success' && (
        github.event_name == 'workflow_run' ||
        (github.event_name == 'workflow_dispatch' &&
          (inputs.target == 'dev' || inputs.target == 'prod'))
      )
    `),
  );
  assert.deepEqual(workflow.jobs["deploy-prod"].needs, [
    "build-production",
    "deploy-dev",
  ]);
  assert.equal(
    normalizeExpression(workflow.jobs["deploy-prod"].if),
    normalizeExpression(`
      always() &&
      needs.build-production.result == 'success' &&
      needs.deploy-dev.result == 'success' && (
        github.event_name == 'workflow_run' ||
        (github.event_name == 'workflow_dispatch' && inputs.target == 'prod')
      )
    `),
  );

  const selectedRef = expression(
    "inputs.ref || github.event.workflow_run.head_sha || github.ref",
  );
  for (const jobName of [
    "build-demo",
    "build-production",
    "deploy-demo",
    "deploy-dev",
    "deploy-prod",
  ]) {
    assert.equal(workflow.jobs[jobName].steps[0].with.ref, selectedRef);
  }
});
