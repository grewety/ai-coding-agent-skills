import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

const actionPin = /^([\w.-]+\/[\w.-]+(?:\/[\w.-]+)*)@[0-9a-f]{40}$/;

function checkWorkflowActions(source, workflowPath) {
  const document = parseDocument(source);
  assert.equal(document.errors.length, 0, `${workflowPath}: ${document.errors.join("\n")}`);

  for (const [jobId, job] of Object.entries(document.toJS().jobs)) {
    for (const [index, step] of (job.steps ?? []).entries()) {
      if (!Object.hasOwn(step, "uses")) continue;

      const location = `${workflowPath}: jobs.${jobId}.steps[${index}]`;
      const { uses } = step;
      assert.equal(typeof uses, "string", `${location}: uses must be a string`);
      if (uses.startsWith("./")) continue;

      const pin = actionPin.exec(uses);
      assert.ok(pin, `${location}: ${uses} must use a full 40-character lowercase hexadecimal commit SHA`);

      const usesNode = document.getIn(["jobs", jobId, "steps", index, "uses"], true);
      assert.match(usesNode?.comment?.trim() ?? "", /^v\d+$/, `${location}: ${uses} must have an inline major-version comment`);

      if (pin[1].toLowerCase() === "actions/checkout") {
        assert.equal(step.with?.["persist-credentials"], false, `${location}: ${uses} must set persist-credentials: false`);
      }
    }
  }
}

for (const workflow of ["ci.yml", "publish-skills.yml"]) {
  const workflowPath = `.github/workflows/${workflow}`;
  test(`${workflowPath} pins external actions and disables checkout credential persistence`, async () => {
    const source = await readFile(new URL(`../${workflowPath}`, import.meta.url), "utf8");
    checkWorkflowActions(source, workflowPath);
  });
}

const fixtureSha = "0123456789abcdef0123456789abcdef01234567";

function checkoutFixture({ ref = fixtureSha, comment = " # v6", inputs = "\n        with: { persist-credentials: false }" } = {}) {
  return `jobs:
  verify:
    steps:
      - uses: ./local-action
        with: { persist-credentials: false }
      - uses: actions/checkout@${ref}${comment}${inputs}
`;
}

test("workflow check accepts an explicitly configured SHA-pinned checkout", () => {
  checkWorkflowActions(checkoutFixture(), "fixture.yml");
});

for (const [label, ref] of [
  ["a tag", "v6"],
  ["a branch", "main"],
  ["an abbreviated SHA", fixtureSha.slice(0, 7)],
  ["a non-hex full-length ref", "g" + fixtureSha.slice(1)],
  ["an uppercase SHA", fixtureSha.toUpperCase()],
]) {
  test(`workflow check rejects ${label} in an action reference`, () => {
    assert.throws(() => checkWorkflowActions(checkoutFixture({ ref }), "fixture.yml"), {
      message: /fixture\.yml: jobs\.verify\.steps\[1\].*must use a full 40-character lowercase hexadecimal commit SHA/,
    });
  });
}

test("workflow check rejects a missing major-version comment", () => {
  assert.throws(() => checkWorkflowActions(checkoutFixture({ comment: "" }), "fixture.yml"), {
    message: /fixture\.yml: jobs\.verify\.steps\[1\].*must have an inline major-version comment/,
  });
});

for (const [label, inputs] of [
  ["missing checkout inputs", ""],
  ["an omitted credential setting", "\n        with: { fetch-depth: 1 }"],
  ["enabled credential persistence", "\n        with: { persist-credentials: true }"],
]) {
  test(`workflow check rejects ${label}`, () => {
    assert.throws(() => checkWorkflowActions(checkoutFixture({ inputs }), "fixture.yml"), {
      message: /fixture\.yml: jobs\.verify\.steps\[1\].*must set persist-credentials: false/,
    });
  });
}
