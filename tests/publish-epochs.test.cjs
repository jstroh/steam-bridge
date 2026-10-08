const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { validatePins, verifyEpochs, resolveTagCommit, readPreviousProof, verifyEpochContinuity } = require("../scripts/verify-publish-epochs.cjs");
const { verifyReleaseSource } = require("../scripts/publish-release-candidate.cjs");

function fixture() {
  const pins = {
    repository: "consumer/repository", eventName: "workflow_dispatch", refType: "tag",
    toolingTag: "publish-tools-test", toolingCommit: "1".repeat(40), toolingCiRunId: "21",
    releaseTag: "v1.2.3", releaseCommit: "2".repeat(40), releaseRunId: "23", releaseCiRunId: "25", releaseRunAttempt: "1"
  };
  Object.assign(pins, {
    refName: pins.toolingTag, ref: `refs/tags/${pins.toolingTag}`, sha: pins.toolingCommit,
    workflowSha: pins.toolingCommit,
    workflowRef: `${pins.repository}/.github/workflows/publish.yml@refs/tags/${pins.toolingTag}`
  });
  const run = (id, workflow, tag, commit) => ({
    id: Number(id), repository: { full_name: pins.repository }, head_repository: { full_name: pins.repository },
    path: `.github/workflows/${workflow}.yml`, workflow_id: workflow === "ci" ? 11 : 12, run_attempt: 1,
    event: "push", head_branch: tag, head_sha: commit, status: "completed", conclusion: "success"
  });
  const evidence = {
    checkoutCommit: pins.toolingCommit, toolingTagCommit: pins.toolingCommit, releaseTagCommit: pins.releaseCommit,
    ciWorkflow: { path: ".github/workflows/ci.yml", id: 11 },
    releaseWorkflow: { path: ".github/workflows/release.yml", id: 12 },
    toolingCi: run("21", "ci", pins.toolingTag, pins.toolingCommit),
    release: run("23", "release", pins.releaseTag, pins.releaseCommit),
    releaseCi: run("25", "ci", pins.releaseTag, pins.releaseCommit)
  };
  return { pins, evidence };
}

test("independent publisher and candidate epochs retain distinct commit and run bindings", () => {
  const { pins, evidence } = fixture();
  const proof = verifyEpochs(pins, evidence);
  assert.notEqual(proof.tooling.commit, proof.candidate.commit);
  assert.equal(proof.tooling.ci.workflowId, 11);
  assert.equal(proof.candidate.release.runId, "23");
  assert.equal(proof.candidate.release.attempt, 1);
});

test("same-source future publication still requires genuine matching candidate and tooling proof", () => {
  const { pins, evidence } = fixture();
  pins.toolingTag = pins.releaseTag;
  pins.toolingCommit = pins.releaseCommit;
  pins.toolingCiRunId = pins.releaseCiRunId;
  Object.assign(pins, {
    refName: pins.toolingTag, ref: `refs/tags/${pins.toolingTag}`, sha: pins.toolingCommit,
    workflowSha: pins.toolingCommit,
    workflowRef: `${pins.repository}/.github/workflows/publish.yml@refs/tags/${pins.toolingTag}`
  });
  evidence.checkoutCommit = evidence.toolingTagCommit = pins.toolingCommit;
  evidence.toolingCi = structuredClone(evidence.releaseCi);
  const proof = verifyEpochs(pins, evidence);
  assert.equal(proof.tooling.commit, proof.candidate.commit);
  assert.deepEqual(proof.tooling.ci, proof.candidate.ci);
});

for (const [key, value] of Object.entries({
  repository: "consumer/repository/extra", eventName: "push", refType: "branch", refName: "main", ref: "refs/heads/main",
  toolingTag: "../../main", releaseTag: "bad-tag", toolingCommit: "1".repeat(7), releaseCommit: "2".repeat(7),
  sha: "2".repeat(40), workflowSha: "2".repeat(40), workflowRef: "consumer/repository/.github/workflows/other.yml@refs/tags/publish-tools-test",
  toolingCiRunId: "-1", releaseRunId: "1; echo unexpected", releaseCiRunId: "9007199254740992", releaseRunAttempt: "0"
})) {
  test(`rejects invalid or substituted ${key} before metadata requests`, () => {
    const { pins } = fixture();
    pins[key] = value;
    assert.throws(() => validatePins(pins));
  });
}

for (const key of ["checkoutCommit", "toolingTagCommit", "releaseTagCommit"]) {
  test(`rejects moved ${key}`, () => {
    const { pins, evidence } = fixture();
    evidence[key] = "3".repeat(40);
    assert.throws(() => verifyEpochs(pins, evidence));
  });
}

for (const name of ["toolingCi", "release", "releaseCi"]) {
  for (const [key, value] of Object.entries({
    id: 999, path: ".github/workflows/other.yml", workflow_id: 999, run_attempt: 0,
    event: "workflow_dispatch", head_branch: "main", head_sha: "3".repeat(40), status: "in_progress", conclusion: "failure",
    repository: { full_name: "other/repository" }, head_repository: { full_name: "fork/repository" }
  })) {
    test(`rejects ${name} with mismatched ${key}`, () => {
      const { pins, evidence } = fixture();
      evidence[name][key] = value;
      assert.throws(() => verifyEpochs(pins, evidence));
    });
  }
}

test("rejects rerun candidate artifacts and observes tooling/CI attempt changes", () => {
  const { pins, evidence } = fixture();
  const before = verifyEpochs(pins, evidence);
  evidence.release.run_attempt = 2;
  assert.throws(() => verifyEpochs(pins, evidence), /attempt differs/);
  evidence.release.run_attempt = 1;
  for (const name of ["toolingCi", "releaseCi"]) {
    evidence[name].run_attempt = 2;
    assert.throws(() => verifyEpochContinuity(verifyEpochs(pins, evidence), before), /changed after preflight/);
    evidence[name].run_attempt = 1;
  }
});

test("workflow-run paths accept only bare or the exact pinned tag suffix", () => {
  for (const name of ["toolingCi", "release", "releaseCi"]) {
    const { pins, evidence } = fixture();
    const path = evidence[name].path;
    const tag = name === "toolingCi" ? pins.toolingTag : pins.releaseTag;
    for (const suffix of [`@${tag}`, `@refs/tags/${tag}`]) {
      evidence[name].path = path + suffix;
      verifyEpochs(pins, evidence);
    }
    for (const suffix of ["@main", `@refs/heads/${tag}`, `@${tag}@extra`]) {
      evidence[name].path = path + suffix;
      assert.throws(() => verifyEpochs(pins, evidence), /path\/ref/);
    }
  }
});

test("canonical workflow identity cannot be substituted", () => {
  for (const name of ["ciWorkflow", "releaseWorkflow"]) {
    for (const [key, value] of [["path", ".github/workflows/other.yml"], ["id", 0], ["id", 999]]) {
      const { pins, evidence } = fixture();
      evidence[name][key] = value;
      assert.throws(() => verifyEpochs(pins, evidence));
    }
  }
});

test("bounded retained epoch proof round-trips and rejects invalid or oversized files", () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "steam-bridge-epochs-test-"));
  try {
    const file = path.join(root, "proof.json");
    const { pins, evidence } = fixture();
    const proof = verifyEpochs(pins, evidence);
    fs.writeFileSync(file, JSON.stringify(proof));
    verifyEpochContinuity(proof, readPreviousProof(file));
    assert.throws(() => verifyEpochContinuity(proof, { ...proof, tooling: proof.candidate }), /changed after preflight/);
    fs.writeFileSync(file, "{");
    assert.throws(() => readPreviousProof(file));
    fs.writeFileSync(file, " ".repeat(65537));
    assert.throws(() => readPreviousProof(file), /Invalid prior/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lightweight and annotated tags resolve to the exact commit", () => {
  const commit = "2".repeat(40);
  assert.equal(resolveTagCommit("consumer/repository", "v1.2.3", () => ({ object: { type: "commit", sha: commit } })), commit);
  const requests = [];
  assert.equal(resolveTagCommit("consumer/repository", "v1.2.3", endpoint => {
    requests.push(endpoint);
    return { object: { type: requests.length === 1 ? "tag" : "commit", sha: requests.length === 1 ? "3".repeat(40) : commit } };
  }), commit);
  assert.deepEqual(requests, ["repos/consumer/repository/git/ref/tags/v1.2.3", `repos/consumer/repository/git/tags/${"3".repeat(40)}`]);
});

test("missing, non-commit, cyclic and deeply nested tag objects fail closed", () => {
  for (const response of [{}, { object: { type: "tree", sha: "3".repeat(40) } }, { object: { type: "commit", sha: "abc" } }, { object: { type: "tag", sha: "3".repeat(40) } }]) {
    assert.throws(() => resolveTagCommit("consumer/repository", "v1.2.3", () => response));
  }
  let counter = 0;
  assert.throws(() => resolveTagCommit("consumer/repository", "v1.2.3", () => ({ object: { type: "tag", sha: String(++counter).padStart(40, "0") } })), /nesting/);
});

test("audit release source must match the independent complete candidate commit", () => {
  const commit = "2".repeat(40);
  verifyReleaseSource({ release: { gitCommit: commit } }, commit);
  for (const actual of [undefined, "3".repeat(40), commit.slice(0, 7)]) {
    assert.throws(() => verifyReleaseSource({ release: { gitCommit: actual } }, commit));
  }
  assert.throws(() => verifyReleaseSource({ release: { gitCommit: commit } }, commit.slice(0, 7)), /Invalid full/);
});

test("protected workflow proves both epochs before dependencies/download and rechecks before publication", () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/publish.yml"), "utf8").replace(/\r\n?/g, "\n");
  const identity = workflow.indexOf("- name: Verify dispatched tooling identity");
  const checkout = workflow.indexOf("- uses: actions/checkout@");
  const epochs = workflow.indexOf("- name: Verify exact tooling and candidate epochs");
  const install = workflow.indexOf("- name: Install release tooling");
  const download = workflow.indexOf("- name: Download exact audited candidate");
  const recheck = workflow.indexOf("node scripts/verify-publish-epochs.cjs --previous-proof");
  const retention = workflow.indexOf("- name: Retain independent publication source bindings");
  const publishStep = workflow.indexOf("- name: Publish exact verified bytes");
  const publish = workflow.indexOf('node scripts/publish-release-candidate.cjs "${args[@]}"');
  assert.ok(identity < checkout && checkout < epochs && epochs < install && install < download && download < recheck && recheck < retention && retention < publishStep && publishStep < publish);
  assert.match(workflow.slice(publishStep, publish), /--previous-proof publish-epoch-final-proof\.json/);
  assert.match(workflow.slice(retention, publishStep), /if-no-files-found: error/);
  assert.doesNotMatch(workflow.slice(retention, publish), /continue-on-error|if:.*always\(\)/);
  for (const expected of ["ref: ${{ github.sha }}", "environment: npm-production", "id-token: write", "actions: read", "contents: read", '--release-commit "$RELEASE_COMMIT"', 'NPM_CONFIG_PROVENANCE: "true"']) assert.ok(workflow.includes(expected), expected);
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|workflow_call|npm run native|npm pack|release:assemble/);
  assert.doesNotMatch(workflow, /(?:^|\n)\s+GITHUB_(?:SHA|REF|WORKFLOW_SHA|WORKFLOW_REF):/);
});
