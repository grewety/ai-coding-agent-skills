import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { captureLimit } from "./bounded-worker.mjs";
import { absolute, digest, equal, fields, git, hash, jsonBytes, need, normalizeTasks, parseStrictJson, planFiles,
  planningPrefix, relative, separate, sha, tree, utf8, verifiedGitRoot, within } from "./review-inputs.mjs";
import { readClosed, requestBytes, safePath, validateRequest } from "./worker-handoff.mjs";
import { identifier, privateDirectory, trustedJson } from "./implementer-state.mjs";
import { repositoryIdentity } from "./implementer-claims.mjs";

export const maximumBatch = 4;
export const maximumAttemptMs = 10800000;
const goalFirstDefaultMs = 1800000;
const smokeBudgetMs = 28000;
const captureNames = ["native.txt", "lifecycle.jsonl", "stdout.jsonl", "stderr.log", "launch.json"];
const gitText = (workspace, ...args) => utf8(git(workspace, ...args));
const finite = (n, max) => Number.isSafeInteger(n) && n > 0 && n <= max;
const requiredPins = ["approval", "grant", "host"];
const taskId = (id) => typeof id === "string" && /^\d{1,8}\.\d{1,8}$/.test(id);

function locator(value) {
  fields(value, ["path", "sha256"], "independent locator");
  need(absolute(value.path) && digest(value.sha256), "Invalid independently retained locator");
}

export function validateInvocation(entry) {
  fields(entry, ["request", "approval", "grant", "host"], "runtime invocation");
  const r = entry.request;
  validateRequest(r);
  need(r.identity.role === "implementer" && identifier(r.identity.attempt) &&
    (r.identity.predecessor === null || identifier(r.identity.predecessor)) && identifier(r.identity.change) &&
    taskId(r.identity.task) && r.evidenceRoots.length === 1 && r.mutablePaths.length > 0 &&
    r.mutablePaths.length <= 256 && r.mutablePaths.every(relative) &&
    r.requiredEvidence.length === captureNames.length && captureNames.every((name) => r.requiredEvidence.includes(name)) &&
    r.budget.unit === "minutes" && finite(r.budget.limit, 180) && requestBytes(r).length <= 128 * 1024,
  "Unsupported or unsafe implementer request, outputs or bounds");
  for (const name of requiredPins) {
    locator(entry[name]);
    need([r.identity.workspace, ...r.evidenceRoots].every((root) => separate(root, entry[name].path)),
      "Independent locator overlaps the mutable checkout or evidence");
  }
  need(entry.approval.path === r.authority.approvalReference && entry.grant.path === r.authority.executionReference &&
    new Set(requiredPins.map((name) => entry[name].path)).size === requiredPins.length, "Authority references changed or overlap");
}

export function checkoutIdentity(workspace) {
  const head = gitText(workspace, "rev-parse", "--verify", "HEAD^{commit}").trimEnd();
  const branch = gitText(workspace, "symbolic-ref", "--quiet", "HEAD").trimEnd();
  need(sha(head) && branch.startsWith("refs/heads/"), "Checkout must be attached at an exact commit");
  return { head, branch };
}

export function checkoutStatus(workspace) {
  return gitText(workspace, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", "--ignore-submodules=none");
}

async function worktreePaths(workspace) {
  return Promise.all(["--absolute-git-dir", "--git-common-dir"].map(async (arg) => {
    const directory = gitText(workspace, "rev-parse", "--path-format=absolute", arg).trimEnd();
    await safePath(directory);
    return directory;
  }));
}

export async function checkoutProtectedPaths(workspace) {
  const dirs = await worktreePaths(workspace);
  return [...new Set([path.join(workspace, ".git"), ...dirs])];
}

export async function gitState(workspace) {
  const names = ["HEAD", "index", "config", "packed-refs"];
  return Object.fromEntries(await Promise.all(names.map(async (name) => {
    const filename = gitText(workspace, "rev-parse", "--path-format=absolute", "--git-path", name).trimEnd();
    try {
      await safePath(filename);
      const st = await lstat(filename, { bigint: true });
      need(st.isFile() && st.nlink === 1n, "Unsafe Git metadata path");
      return [name, [st.dev, st.ino, st.mode, st.size, st.mtimeNs, st.ctimeNs].map(String)];
    } catch (error) {
      if (error.code === "ENOENT" && name === "packed-refs") return [name, null];
      throw error;
    }
  })));
}

function exactCommit(workspace, value) {
  need(sha(value) && gitText(workspace, "rev-parse", "--verify", value + "^{commit}").trimEnd() === value,
    "Expected an exact Git commit object");
}

function nativeTasks(bytes) {
  const tasks = [];
  normalizeTasks(utf8(bytes), (id, complete) => tasks.push({ id, complete }));
  need(tasks.every(({ id }) => taskId(id)), "Unidentified native task checkbox");
  need(tasks.length > 0 && new Set(tasks.map(({ id }) => id)).size === tasks.length, "Missing or ambiguous ordered native tasks");
  return tasks;
}

async function compareKnownCheckouts(workspace, repository, change, knownWorkspaces, specNames) {
  const worktrees = gitText(workspace, "worktree", "list", "--porcelain", "-z").split("\0")
    .filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9));
  const observed = [...new Set([...worktrees, ...knownWorkspaces])];
  need(observed.length <= 64, "Known checkout inventory exceeds the finite bound");
  for (const checkout of observed) {
    await safePath(checkout);
    need(repositoryIdentity(checkout) === repository, "Unresolved known checkout repository");
    const directory = path.join(checkout, "openspec/changes");
    try { await safePath(directory); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    const changes = await readdir(directory, { withFileTypes: true });
    need(changes.length <= 256, "Known active change inventory exceeds the finite bound");
    for (const entry of changes) {
      if (["archive", change].includes(entry.name)) continue;
      need(!entry.isSymbolicLink(), "Unsafe known active change path");
      if (!entry.isDirectory()) continue;
      const specs = path.join(directory, entry.name, "specs");
      try {
        await safePath(specs);
        const names = await readdir(specs);
        need(!names.some((name) => specNames.has(name)), "Overlapping active change specification requires resolution");
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
}

export async function checkCheckout(request, grant, { allowRetainedProgress = false } = {}) {
  const { workspace, plan, planDigest, inputs, change, task } = request.identity;
  await verifiedGitRoot(workspace);
  need(repositoryIdentity(workspace) === grant.repository && equal(await privateCheckoutIdentity(workspace), grant.checkoutIdentity),
    "Checkout or repository changed under claim");
  const checked = checkoutIdentity(workspace);
  need(checked.head === grant.head && checked.branch === grant.branch &&
    (allowRetainedProgress || checkoutStatus(workspace) === ""), "Unexpected branch, HEAD or dirty checkout");
  need(gitText(workspace, "ls-files", "-v", "-z").split("\0").filter(Boolean).every((line) => line.startsWith("H ")),
    "Untrusted Git index state");
  exactCommit(workspace, plan);
  exactCommit(workspace, grant.policyRevision);
  git(workspace, "merge-base", "--is-ancestor", grant.policyRevision, plan);
  git(workspace, "merge-base", "--is-ancestor", plan, grant.head);
  const rawPlan = tree(workspace, plan);
  const headTree = tree(workspace, grant.head);
  const normalized = grant.mode === "goal-first" ? grant.normalizedPlanDigest : planDigest;
  const frozen = planFiles(request, rawPlan, true, normalized);
  const current = planFiles(request, headTree, false, normalized);
  const taskFile = planningPrefix(change) + "tasks.md";
  const initial = nativeTasks(frozen.get(taskFile));
  const tasks = nativeTasks(current.get(taskFile));
  need(initial.length === tasks.length && equal(initial.map(({ id }) => id), tasks.map(({ id }) => id)), "Native task identity changed");
  const pending = tasks.findIndex(({ complete }) => !complete);
  need(pending >= 0 && tasks[pending].id === task && tasks.slice(pending).every(({ complete }) => !complete) &&
    grant.eligibleTasks.includes(task) && equal(grant.accepted.map(({ task: id }) => id), tasks.slice(0, pending).map(({ id }) => id)),
  "Ordered task eligibility or accepted predecessors changed");
  for (const predecessor of grant.accepted) {
    fields(predecessor, ["task", "candidate", "receipt"], "accepted dependency");
    exactCommit(workspace, predecessor.candidate);
    git(workspace, "merge-base", "--is-ancestor", predecessor.candidate, grant.head);
    const receipt = await trustedJson(predecessor.receipt);
    need(receipt.kind === "accepted-dependency" && receipt.task === predecessor.task && receipt.change === change &&
      receipt.candidate === predecessor.candidate && receipt.plan === plan && receipt.planDigest === planDigest &&
      receipt.verdict === "pass", "Required accepted dependency evidence differs");
  }
  for (const [name, bytes] of current) {
    const filename = path.join(workspace, name);
    const stat = await lstat(filename);
    need(stat.nlink === 1 && (stat.mode & 0o111 ? "100755" : "100644") === headTree.get(name).mode &&
      (await readClosed(filename, 64 * 1024)).equals(bytes), "Planning worktree input differs");
  }
  const specRoot = planningPrefix(change) + "specs/";
  const specs = Object.keys(inputs).filter((name) => name.startsWith(specRoot));
  if (grant.mode === "goal-first") {
    const proposal = utf8(frozen.get(planningPrefix(change) + "proposal.md"));
    const blocks = [...proposal.matchAll(/^```openspec-goal-contract\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
    need(blocks.length === 1 && tasks.length === 1 && specs.some((name) => name.endsWith("/spec.md")), "Missing one approved Goal Contract or native outcome");
    const contract = parseStrictJson(Buffer.from(blocks[0][1]));
    const bound = [specRoot, "openspec/config.yaml", planningPrefix(change) + ".openspec.yaml"];
    const boundInputs = Object.fromEntries(Object.entries(inputs).filter(([name]) =>
      bound.some((item) => item.endsWith("/") ? name.startsWith(item) : name === item)));
    need(hash(jsonBytes({ change, policyRevision: grant.policyRevision, contract, inputs: boundInputs }).subarray(0, -1)) === planDigest &&
      contract.outcome === request.outcome && equal(contract.acceptance, request.acceptance) &&
      Array.isArray(contract.scope) && request.mutablePaths.every((name) => contract.scope.some((root) => relative(root) && within(root, name))) &&
      Array.isArray(contract.nonGoals) && contract.nonGoals.every((item) => request.nonGoals.includes(item)) &&
      contract.localAuthority?.stop === request.stop && Number.isSafeInteger(contract.budgets?.minutes) &&
      request.budget.limit <= contract.budgets.minutes && grant.limits.groupMs <= contract.budgets.minutes * 60000 &&
      Number.isSafeInteger(contract.budgets.corrections) && grant.limits.corrections <= contract.budgets.corrections,
    "Goal Contract digest or invocation changed");
  }
  for (const name of request.mutablePaths) {
    const filename = path.join(workspace, name);
    await safePath(filename, true);
    try {
      const st = await lstat(filename);
      need(st.isFile() && st.nlink === 1, "Unsafe mutable file or alias");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  await compareKnownCheckouts(workspace, grant.repository, change, grant.knownWorkspaces,
    new Set(specs.map((name) => name.slice(specRoot.length).split("/")[0])));
}

export async function privateCheckoutIdentity(workspace) {
  await safePath(workspace);
  const st = await lstat(workspace, { bigint: true });
  need(st.isDirectory() && st.uid === BigInt(process.getuid()) && (st.mode & 0o022n) === 0n,
    "Unsafe or foreign checkout owner");
  return { device: String(st.dev), inode: String(st.ino) };
}

// Determine adoption from the independently approved revision. Workspace spec edits
// and existing frozen Goal-First grants cannot activate the prospective policy.
export function selectsAttemptDeadline(grant) {
  if (grant.mode !== "goal-first") return false;
  const filename = "openspec/specs/exclusive-worker-runtime/spec.md";
  const entry = tree(grant.workspace, grant.policyRevision, [filename]).get(filename);
  if (!entry || entry.mode !== "100644") return false;
  const spec = utf8(git(grant.workspace, "cat-file", "blob", entry.oid));
  return /^### Requirement: Bounded Goal-First attempt deadline$/m.test(spec) &&
    /^### Requirement: Bounded progress-based timeout continuation$/m.test(spec);
}

export function attemptWindow(request, grant, roles, history, createdAt, expiry, now = Date.now()) {
  const previous = history.at(-1);
  need(!previous || (Object.entries(grant.limits).every(([name, limit]) =>
    limit <= (previous.limits[name] ?? (name === "timeoutMs" ? Infinity : -1))) &&
    (!Object.hasOwn(previous.limits, "timeoutMs") || Object.hasOwn(grant.limits, "timeoutMs")) &&
    grant.expiresAt <= previous.grantExpiresAt), "A successor cannot widen retained limits");
  const first = history.find((launch) => launch.task === request.identity.task);
  const deadline = Math.min(grant.expiresAt, expiry, createdAt + grant.limits.totalMs,
    (first?.startedAt ?? now) + grant.limits.groupMs);
  const remainingMs = deadline - now - smokeBudgetMs;
  const prospective = roles.attemptPolicy === true;
  const selectedMs = prospective ? roles.goalFirstTimeoutMs ?? goalFirstDefaultMs : grant.limits.timeoutMs;
  const timeoutMs = prospective ? Math.min(selectedMs, grant.limits.timeoutMs ?? Infinity,
    request.budget.limit * 60000, remainingMs) : selectedMs;
  need(finite(timeoutMs, maximumAttemptMs) && timeoutMs <= remainingMs,
    "Finite grant, assignment or group deadline cannot admit the worker");
  return { deadline, timeoutMs, smokeBudgetMs };
}

export async function loadAuthority(entry, repository) {
  const r = entry.request;
  const { workspace, change, plan, planDigest, task } = r.identity;
  const [approval, grant] = await Promise.all([trustedJson(entry.approval), trustedJson(entry.grant)]);
  const identity = { workspace, change, repository, plan, planDigest, orchestrator: r.authority.orchestrator,
    authorSession: r.authority.authorSession };
  const authorityFields = ["schemaVersion", "kind", ...Object.keys(identity), "mode", "policyRevision", "branch"];
  fields(approval, [...authorityFields, "approved", "approvedAt"], "exact approval");
  fields(grant, [...authorityFields, "localOnly", "stop", "checkoutIdentity", "head", "eligibleTasks", "accepted", "knownWorkspaces",
    "mutablePaths", "restrictions", "limits", "issuedAt", "expiresAt", "approvalSha256", "hostSha256", "requestSha256",
    "overrideSha256", "continuation", "inference"], "bounded local execution grant", ["normalizedPlanDigest", "commits"]);
  for (const record of [approval, grant]) need(record.schemaVersion === 1 &&
    Object.entries(identity).every(([name, value]) => record[name] === value), "Exact approved assignment identity differs");
  need(["task-guided", "goal-first"].includes(grant.mode) && approval.mode === grant.mode &&
    approval.kind === (grant.mode === "goal-first" ? "exact-goal-approval" : "exact-plan-approval") && approval.approved === true &&
    grant.kind === "local-execution-grant" && grant.approvalSha256 === entry.approval.sha256 &&
    grant.hostSha256 === entry.host.sha256 && grant.requestSha256 === hash(requestBytes(r)) &&
    grant.localOnly === true && (!Object.hasOwn(grant, "commits") || typeof grant.commits === "boolean") &&
    grant.stop === r.stop && sha(grant.policyRevision) && grant.policyRevision === approval.policyRevision &&
    sha(grant.head) && typeof grant.branch === "string" && grant.branch === approval.branch &&
    /^refs\/heads\/[a-zA-Z0-9_.\/-]+$/.test(grant.branch), "Missing matching exact approval and bounded local grant");
  need(Array.isArray(grant.eligibleTasks) && grant.eligibleTasks.length > 0 && grant.eligibleTasks.length <= 128 &&
    grant.eligibleTasks.every(taskId) && new Set(grant.eligibleTasks).size === grant.eligibleTasks.length &&
    grant.eligibleTasks.includes(task) && Array.isArray(grant.accepted) && grant.accepted.length <= 127 &&
    Array.isArray(grant.knownWorkspaces) && grant.knownWorkspaces.length <= 32 && grant.knownWorkspaces.every(absolute) &&
    Array.isArray(grant.mutablePaths) && equal([...grant.mutablePaths].sort(), [...r.mutablePaths].sort()) &&
    Array.isArray(grant.restrictions) && grant.restrictions.every((item) => r.restrictions.includes(item)) &&
    (grant.mode !== "goal-first" || digest(grant.normalizedPlanDigest)), "Local grant scope, predecessor or restrictions differ");
  const prospective = selectsAttemptDeadline(grant);
  fields(grant.limits, ["stdoutBytes", "stderrBytes", "maxTurns", "totalMs", "groupMs", "corrections", "batchSize",
    ...(prospective ? [] : ["timeoutMs"])], "runtime limits", prospective ? ["timeoutMs"] : []);
  const { timeoutMs, stdoutBytes, stderrBytes, maxTurns, totalMs, groupMs, corrections, batchSize } = grant.limits;
  need((prospective ? !Object.hasOwn(grant.limits, "timeoutMs") || finite(timeoutMs, maximumAttemptMs) :
    finite(timeoutMs, 600000) && timeoutMs <= r.budget.limit * 60000 && timeoutMs <= groupMs) &&
    finite(stdoutBytes, captureLimit) && finite(stderrBytes, captureLimit) && finite(maxTurns, 128) &&
    finite(totalMs, maximumAttemptMs) && finite(groupMs, totalMs) &&
    Number.isSafeInteger(corrections) && corrections >= 0 && corrections <= 8 && finite(batchSize, maximumBatch),
  "Invalid finite wall-clock, stream, turn or batch budget");
  need(Number.isSafeInteger(approval.approvedAt) && Number.isSafeInteger(grant.issuedAt) && approval.approvedAt <= grant.issuedAt &&
    grant.issuedAt <= Date.now() && Number.isSafeInteger(grant.expiresAt) && grant.issuedAt < grant.expiresAt &&
    grant.expiresAt <= grant.issuedAt + totalMs, "Invalid execution grant time bounds");
  for (const item of grant.accepted) {
    fields(item, ["task", "candidate", "receipt"], "accepted dependency");
    locator(item.receipt);
  }
  for (const pin of [grant.inference, ...(grant.continuation === null ? [] : [grant.continuation]), ...grant.accepted.map(({ receipt }) => receipt)]) {
    locator(pin);
    need([workspace, ...r.evidenceRoots].every((root) => separate(root, pin.path)),
      "Execution locator overlaps the mutable checkout or evidence");
  }
  need(requiredPins.every((key) => entry[key].path !== grant.inference.path) &&
    grant.continuation?.path !== grant.inference.path, "Separate bounded inference authority is required");
  const inference = await trustedJson(grant.inference);
  fields(inference, ["schemaVersion", "kind", "attempt", "requestSha256", "hostSha256", "orchestrator",
    "maxRuns", "expiresAt"], "bounded provider invocation");
  need(inference.schemaVersion === 1 && inference.kind === "worker-inference-authority" &&
    inference.attempt === r.identity.attempt && inference.requestSha256 === grant.requestSha256 &&
    inference.hostSha256 === grant.hostSha256 && inference.orchestrator === r.authority.orchestrator &&
    inference.maxRuns === 1 && Number.isSafeInteger(inference.expiresAt) && inference.expiresAt > grant.issuedAt &&
    inference.expiresAt <= grant.expiresAt, "Independent single-run inference authority differs");
  await privateDirectory(path.dirname(r.evidenceRoots[0]));
  return { approval, grant, inference, prospective };
}
