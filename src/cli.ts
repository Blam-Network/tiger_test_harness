// Start-up prompts: which build to serve and where its packages are, then
// the normal bootstrap (main.ts). Used by the release executable and
// `node dist/cli`; `node dist/main` still takes everything from the environment.
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { APP_NAME, VERSION_LINE } from "./build-info";
import { e_build, parseBuild } from "./builds";
import { describeDetected, detectPackagesBuild } from "./content/detect-build";
import { resolveGameBuild, resolvePackagesDir, workingDir } from "./env";

const QUOTED = /^"(.*)"$/;
const PACKAGES_FOLDER = "packages";

const USAGE = `usage: ${APP_NAME} [--build <build string or folder>] [--packages <dir>] [--version]

  --build     the game build to serve; without it (and TIGER_GAME_BUILD) you pick from a list
  --packages  the game's packages folder; without it (and TIGER_PACKAGES_DIR) a "${PACKAGES_FOLDER}"
              folder with .pkg files next to the executable is used, else you are asked
  --version   print the build string and exit
`;

function hasPackages(dir: string): boolean {
  try {
    return readdirSync(dir).some((name) => name.endsWith(".pkg"));
  } catch {
    return false;
  }
}

function parseArgs(argv: string[]): { build?: string; packages?: string } {
  const args: { build?: string; packages?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--version") {
      process.stdout.write(`${VERSION_LINE}\n`);
      process.exit(0);
    }
    if ((flag === "--build" || flag === "--packages") && value) {
      args[flag.slice(2) as "build" | "packages"] = value;
      i++;
    } else {
      process.stdout.write(USAGE);
      process.exit(flag === "--help" || flag === "-h" ? 0 : 1);
    }
  }
  return args;
}

// Lines come from the terminal or a pipe; an iterator keeps piped lines
// that arrive before they are asked for.
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(question: string): Promise<string> {
      process.stdout.write(question);
      const next = await lines.next();
      if (next.done) {
        throw new Error("input ended before every choice was made");
      }
      return String(next.value).trim();
    },
    close: () => rl.close(),
  };
}

async function pickBuild(
  ask: (question: string) => Promise<string>
): Promise<e_build> {
  const all = Object.values(e_build);
  process.stdout.write("Game builds:\n");
  all.forEach((build, i) => {
    process.stdout.write(`  ${i + 1}) ${build}\n`);
  });
  for (;;) {
    const answer = await ask(`Build to serve [1-${all.length}]: `);
    const chosen = all[Number(answer) - 1] ?? parseBuild(answer);
    if (chosen) {
      return chosen;
    }
    process.stdout.write("Not a build in the list.\n");
  }
}

async function askPackagesDir(
  ask: (question: string) => Promise<string>
): Promise<string> {
  for (;;) {
    const answer = await ask(
      `Packages folder (a "${PACKAGES_FOLDER}" folder with .pkg files next to ${APP_NAME} is used automatically): `
    );
    const dir = resolve(answer.replace(QUOTED, "$1"));
    if (answer && hasPackages(dir)) {
      return dir;
    }
    process.stdout.write(`No .pkg files in ${dir}.\n`);
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  process.stdout.write(`${VERSION_LINE}\n`);
  const prompter = createPrompter();
  try {
    const local = resolve(workingDir(), PACKAGES_FOLDER);
    const packages = resolve(
      args.packages ??
        resolvePackagesDir() ??
        (hasPackages(local) ? local : await askPackagesDir(prompter.ask))
    );
    process.env.TIGER_PACKAGES_DIR = packages;

    // The build the package headers name; an explicit choice must agree.
    const found = detectPackagesBuild(packages);
    const named = args.build ?? resolveGameBuild();
    let build: e_build;
    if (named) {
      const parsed = parseBuild(named);
      if (!parsed) {
        throw new Error(`unknown build ${named}`);
      }
      if (found.build && found.build !== parsed) {
        throw new Error(
          `build ${parsed} was asked for but the packages in ${packages} are ${found.build} (${describeDetected(found)})`
        );
      }
      build = parsed;
    } else if (found.build) {
      build = found.build;
      process.stdout.write(
        `Packages in ${packages} are ${build} (package headers: ${describeDetected(found)})
`
      );
    } else {
      process.stdout.write(
        `Packages in ${packages}: ${describeDetected(found)}; no single supported build.
`
      );
      build = await pickBuild(prompter.ask);
    }
    process.env.TIGER_GAME_BUILD = build;
    process.stdout.write(`Serving ${build}
`);
  } finally {
    prompter.close();
  }
  await import("./main");
}

run().catch((err) => {
  console.error(
    `[${APP_NAME}] failed to start:`,
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
