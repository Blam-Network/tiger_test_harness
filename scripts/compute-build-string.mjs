// Computes the build string: {seq}.{yy}.{mm}.{dd}.{hhmm}.{branch}
// Example: 00042.26.10.25.0612.main
//
// Seq is the CI run number. Without one (a local build) the build is the
// "untracked version", as it is for PRs and a detached HEAD.
//
// Prints JSON: { buildString, packageVersion, showWatermark, seq, branch, stamp, commit, builtAt }
// (packageVersion and showWatermark are unused here; the shape matches Datamine Explorer's script)
//
// Env:
//   TIGER_TEST_HARNESS_BRANCH: branch name override (default: git rev-parse --abbrev-ref HEAD)
//   TIGER_TEST_HARNESS_SEQ: build sequence
//   TIGER_TEST_HARNESS_UNTRACKED=1: force the "untracked version" build
import { execSync } from "node:child_process";

const pad2 = (n) => String(n).padStart(2, "0");

const sanitizeBranch = (branch) =>
  branch
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_");

const git = (args) => {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

const now = new Date();
const builtAt = now.toISOString();
const commit = (process.env.GITHUB_SHA || git("rev-parse HEAD")).slice(0, 7);

const branchRaw =
  process.env.TIGER_TEST_HARNESS_BRANCH ||
  git("rev-parse --abbrev-ref HEAD") ||
  "unknown";
const seq = Number.parseInt(process.env.TIGER_TEST_HARNESS_SEQ || "", 10);

if (
  process.env.TIGER_TEST_HARNESS_UNTRACKED === "1" ||
  branchRaw === "HEAD" ||
  !(Number.isFinite(seq) && seq > 0)
) {
  const result = {
    buildString: "untracked version",
    packageVersion: "0.0.1",
    showWatermark: true,
    seq: 0,
    branch: branchRaw,
    stamp: "00.00.00.0000",
    commit,
    builtAt,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

const branch = sanitizeBranch(branchRaw);
const stamp = `${pad2(now.getUTCFullYear() % 100)}.${pad2(now.getUTCMonth() + 1)}.${pad2(now.getUTCDate())}.${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}`;
const result = {
  buildString: `${String(seq).padStart(5, "0")}.${stamp}.${branch}`,
  packageVersion: `0.${seq}.0`,
  showWatermark: branchRaw !== "release",
  seq,
  branch,
  stamp,
  commit,
  builtAt,
};
process.stdout.write(`${JSON.stringify(result)}\n`);
