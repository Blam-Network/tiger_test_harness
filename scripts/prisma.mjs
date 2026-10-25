// node scripts/prisma.mjs generate
//   Generates every build's client (prisma/<build folder>/schema.prisma).
// node scripts/prisma.mjs migrate <build folder> [-- prisma migrate dev args]
//   Runs prisma migrate dev (to author a migration) on that build's SQLite
//   file, tiger_test_harness-<build number>.db in the working directory. The
//   server itself applies existing migrations at startup.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import dotenv from "dotenv";
import {
  buildNumberOfFolder,
  tigerDatabaseUrlFor,
} from "./lib/tiger-database-url.mjs";

const PRISMA_DIR = "prisma";
const PRISMA_CLI = createRequire(import.meta.url).resolve(
  "prisma/build/index.js"
);

function prisma(args, env = process.env) {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildFolders() {
  return readdirSync(PRISMA_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(PRISMA_DIR, entry.name, "schema.prisma"))
    )
    .map((entry) => entry.name);
}

function generate() {
  for (const folder of buildFolders()) {
    prisma(["generate", "--schema", `${PRISMA_DIR}/${folder}/schema.prisma`]);
  }
}

function migrate(folder, extra) {
  if (!(folder && buildFolders().includes(folder))) {
    console.error(
      `usage: migrate <build folder> [-- args]; folders: ${buildFolders().join(", ")}`
    );
    process.exit(1);
  }
  dotenv.config();
  const url = tigerDatabaseUrlFor(".", buildNumberOfFolder(folder));
  prisma(
    [
      "migrate",
      "dev",
      "--schema",
      `${PRISMA_DIR}/${folder}/schema.prisma`,
      ...extra,
    ],
    { ...process.env, TIGER_DATABASE_URL: url }
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === "generate") {
  generate();
} else if (command === "migrate") {
  const [folder, ...extra] = rest;
  migrate(folder, extra[0] === "--" ? extra.slice(1) : extra);
} else {
  console.error(
    "usage: prisma.mjs generate | migrate <build folder> [-- args]"
  );
  process.exit(1);
}
