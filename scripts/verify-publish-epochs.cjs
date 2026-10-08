#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function validatePins(pins) {
  assert.match(pins.repository || "", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Invalid publisher repository.");
  for (const name of ["toolingTag", "releaseTag"]) {
    assert.match(pins[name] || "", /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/, `Invalid ${name}.`);
  }
  assert.match(pins.releaseTag, /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/, "Invalid candidate release tag.");
  for (const name of ["toolingCommit", "releaseCommit"]) {
    assert.match(pins[name] || "", /^[a-f0-9]{40}$/, `Invalid full ${name}.`);
  }
  for (const name of ["toolingCiRunId", "releaseRunId", "releaseCiRunId", "releaseRunAttempt"]) {
    assert.match(pins[name] || "", /^[1-9]\d*$/, `Invalid ${name}.`);
    assert.ok(Number.isSafeInteger(Number(pins[name])), `${name} exceeds the supported range.`);
  }
  assert.equal(pins.eventName, "workflow_dispatch", "Publisher must be explicitly dispatched.");
  assert.equal(pins.refType, "tag", "Publisher tooling must use an immutable tag.");
  assert.equal(pins.refName, pins.toolingTag, "Dispatch tooling tag differs from its pin.");
  assert.equal(pins.ref, `refs/tags/${pins.toolingTag}`, "Dispatch ref differs from the tooling tag.");
  assert.equal(pins.sha, pins.toolingCommit, "Dispatch commit differs from the tooling pin.");
  assert.equal(pins.workflowSha, pins.toolingCommit, "Workflow source differs from the tooling pin.");
  assert.equal(pins.workflowRef, `${pins.repository}/.github/workflows/publish.yml@${pins.ref}`, "Workflow ref differs from the tooling tag.");
}

function validateRun(run, repository, runId, workflow, workflowId, tag, commit) {
  assert.equal(String(run?.id), runId, "Workflow run ID differs from its pin.");
  assert.equal(run?.repository?.full_name, repository, "Workflow run belongs to another repository.");
  assert.equal(run?.head_repository?.full_name, repository, "Workflow run uses another source repository.");
  const workflowPath = `.github/workflows/${workflow}.yml`;
  assert.ok([workflowPath, `${workflowPath}@${tag}`, `${workflowPath}@refs/tags/${tag}`].includes(run?.path), "Workflow run has the wrong workflow path/ref.");
  assert.equal(run?.workflow_id, workflowId, "Workflow run has the wrong canonical workflow ID.");
  assert.ok(Number.isSafeInteger(run?.run_attempt) && run.run_attempt > 0, "Invalid workflow run attempt.");
  assert.equal(run?.event, "push", "Workflow run must be push triggered.");
  assert.equal(run?.head_branch, tag, "Workflow run has the wrong tag.");
  assert.equal(run?.head_sha, commit, "Workflow run has the wrong full commit.");
  assert.equal(run?.status, "completed", "Workflow run is not completed.");
  assert.equal(run?.conclusion, "success", "Workflow run did not succeed.");
}

function verifyEpochs(pins, evidence) {
  validatePins(pins);
  assert.equal(evidence.checkoutCommit, pins.toolingCommit, "Checkout is not the pinned tooling commit.");
  assert.equal(evidence.toolingTagCommit, pins.toolingCommit, "Tooling tag moved from its pinned commit.");
  assert.equal(evidence.releaseTagCommit, pins.releaseCommit, "Candidate tag moved from its pinned commit.");
  for (const [name, workflow] of [["ci", evidence.ciWorkflow], ["release", evidence.releaseWorkflow]]) {
    assert.equal(workflow?.path, `.github/workflows/${name}.yml`, "Canonical workflow path differs.");
    assert.ok(Number.isSafeInteger(workflow?.id) && workflow.id > 0, "Invalid canonical workflow ID.");
  }
  validateRun(evidence.toolingCi, pins.repository, pins.toolingCiRunId, "ci", evidence.ciWorkflow.id, pins.toolingTag, pins.toolingCommit);
  validateRun(evidence.release, pins.repository, pins.releaseRunId, "release", evidence.releaseWorkflow.id, pins.releaseTag, pins.releaseCommit);
  validateRun(evidence.releaseCi, pins.repository, pins.releaseCiRunId, "ci", evidence.ciWorkflow.id, pins.releaseTag, pins.releaseCommit);
  assert.equal(String(evidence.release.run_attempt), pins.releaseRunAttempt, "Candidate Release attempt differs from its pin.");
  const runBinding = run => ({ runId: String(run.id), attempt: run.run_attempt, workflowId: run.workflow_id });
  return {
    schema: "steam-bridge-publish-epochs-v1",
    repository: pins.repository,
    tooling: { tag: pins.toolingTag, commit: pins.toolingCommit, ci: runBinding(evidence.toolingCi) },
    candidate: { tag: pins.releaseTag, commit: pins.releaseCommit, release: runBinding(evidence.release), ci: runBinding(evidence.releaseCi) }
  };
}

function resolveTagCommit(repository, tag, request) {
  let object = request(`repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`).object;
  const visited = new Set();
  for (let depth = 0; depth < 8; depth += 1) {
    assert.match(object?.sha || "", /^[a-f0-9]{40}$/, "Tag contains an invalid object SHA.");
    assert.ok(!visited.has(object.sha), "Tag object cycle.");
    visited.add(object.sha);
    if (object.type === "commit") return object.sha;
    assert.equal(object.type, "tag", "Tag does not resolve to a commit.");
    object = request(`repos/${repository}/git/tags/${object.sha}`).object;
  }
  throw new Error("Tag annotation nesting exceeds the supported bound.");
}

function readPreviousProof(file) {
  const descriptor = fs.openSync(file, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    assert.ok(before.isFile() && before.nlink === 1n && before.size <= 65536n, "Invalid prior epoch proof file.");
    const bytes = Buffer.alloc(65537);
    const length = fs.readSync(descriptor, bytes, 0, bytes.length, 0);
    const after = fs.fstatSync(descriptor, { bigint: true });
    for (const key of ["dev", "ino", "size", "nlink", "mtimeNs", "ctimeNs"]) assert.equal(after[key], before[key], "Prior epoch proof changed while read.");
    assert.equal(BigInt(length), before.size, "Prior epoch proof size differs.");
    return JSON.parse(bytes.subarray(0, length).toString("utf8"));
  } finally {
    fs.closeSync(descriptor);
  }
}

function verifyEpochContinuity(proof, previous) {
  assert.deepEqual(proof, previous, "Publication epoch metadata changed after preflight.");
}

function main(env = process.env, args = process.argv.slice(2)) {
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--previous-proof" && args[1]), "Usage: verify-publish-epochs.cjs [--previous-proof <json>]");
  const pins = {
    repository: env.GITHUB_REPOSITORY, eventName: env.GITHUB_EVENT_NAME,
    refType: env.GITHUB_REF_TYPE, refName: env.GITHUB_REF_NAME, ref: env.GITHUB_REF,
    sha: env.GITHUB_SHA, workflowSha: env.GITHUB_WORKFLOW_SHA, workflowRef: env.GITHUB_WORKFLOW_REF,
    toolingTag: env.TOOLING_TAG, toolingCommit: env.TOOLING_COMMIT, toolingCiRunId: env.TOOLING_CI_RUN_ID,
    releaseTag: env.RELEASE_TAG, releaseCommit: env.RELEASE_COMMIT, releaseRunId: env.RELEASE_RUN_ID,
    releaseCiRunId: env.RELEASE_CI_RUN_ID, releaseRunAttempt: env.RELEASE_RUN_ATTEMPT
  };
  validatePins(pins);
  const invoke = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  const request = endpoint => JSON.parse(invoke("gh", ["api", "--hostname", "github.com", "--method", "GET", endpoint]));
  const proof = verifyEpochs(pins, {
    checkoutCommit: invoke("git", ["rev-parse", "HEAD"]).trim(),
    toolingTagCommit: resolveTagCommit(pins.repository, pins.toolingTag, request),
    releaseTagCommit: resolveTagCommit(pins.repository, pins.releaseTag, request),
    ciWorkflow: request(`repos/${pins.repository}/actions/workflows/ci.yml`),
    releaseWorkflow: request(`repos/${pins.repository}/actions/workflows/release.yml`),
    toolingCi: request(`repos/${pins.repository}/actions/runs/${pins.toolingCiRunId}`),
    release: request(`repos/${pins.repository}/actions/runs/${pins.releaseRunId}`),
    releaseCi: request(`repos/${pins.repository}/actions/runs/${pins.releaseCiRunId}`)
  });
  if (args.length) verifyEpochContinuity(proof, readPreviousProof(args[1]));
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { validatePins, validateRun, verifyEpochs, resolveTagCommit, readPreviousProof, verifyEpochContinuity };
