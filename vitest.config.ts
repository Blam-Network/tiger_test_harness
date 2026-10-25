import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { e_build } from "./src/builds";

const root = path.dirname(fileURLToPath(import.meta.url));
// Suites for every build (describeEachBuild) run once per build, each in a
// process of its own: rsat's schema registry is process-wide and the builds'
// schemas must not meet in it.
const perBuild = "src/**/*.builds.test.ts";

export default defineConfig({
  resolve: {
    alias: [
      // Published blf ESM has directory imports; Nest uses CJS which is fine.
      {
        find: "@blamnetwork/blf",
        replacement: path.join(
          root,
          "node_modules/@blamnetwork/blf/dist-cjs/index.js"
        ),
      },
      {
        find: "@blamnetwork/rsat",
        replacement: path.join(
          root,
          "node_modules/@blamnetwork/rsat/dist-cjs/index.js"
        ),
      },
      // The events live on globalThis, but one copy of the module is simpler.
      {
        find: /^@blamnetwork\/datamine$/,
        replacement: path.join(
          root,
          "node_modules/@blamnetwork/datamine/dist-cjs/index.js"
        ),
      },
      // Published cstruct ESM omits .js extensions; use CJS for vitest.
      {
        find: "@craftycodie/cstruct",
        replacement: path.join(
          root,
          "node_modules/@craftycodie/cstruct/dist-cjs/index.js"
        ),
      },
      // The content layer requires gibbon and bullshcript (CJS), so static
      // imports must resolve to the same copy or module state and instanceof
      // would split between an ESM and a CJS one.
      ...["bullshcript", "gibbon"].map((name) => ({
        find: new RegExp(`^@blamnetwork/${name}/destiny1/(.+)$`),
        replacement: `${path.join(root, "node_modules/@blamnetwork", name, "dist-cjs/versions/destiny1")}/$1.js`,
      })),
    ],
  },
  test: {
    setupFiles: ["src/test-support/default-build.ts"],
    // Cold package and script loads run long when files share the machine.
    hookTimeout: 30_000,
    testTimeout: 15_000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: [perBuild],
        },
      },
      ...Object.entries(e_build).map(([folder, build]) => ({
        extends: true as const,
        test: {
          name: folder,
          include: [perBuild],
          env: { TIGER_GAME_BUILD: build },
        },
      })),
    ],
  },
});
