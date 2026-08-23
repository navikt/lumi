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

const workflow = load(
  readFileSync(
    path.join(repositoryRoot, ".github", "workflows", "deploy-api.yaml"),
    "utf8",
  ),
);

const normalizeExpression = (expression) =>
  expression.replace(/\s+/g, " ").trim();
const selectedRefExpression = "$" + "{{ inputs.ref || github.ref }}";

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
  assert.equal(workflow.jobs.build.steps[0].with.ref, selectedRefExpression);
  assert.equal(
    workflow.jobs["deploy-dev"].steps[0].with.ref,
    selectedRefExpression,
  );
  assert.equal(
    workflow.jobs["deploy-prod"].steps[0].with.ref,
    selectedRefExpression,
  );
});
