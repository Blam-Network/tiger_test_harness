// node scripts/release.mjs
//   Builds release/<platform>-<arch>/tiger_test_harness(.exe): one file holding Node,
//   the bundled server and every static file it reads (Node single
//   executable application), the BungieScript compiled for every build
//   (compiled_bs trees) included. Run `npm run prisma:generate` and
//   `npm run proto:generate` first (npm run release does).
//   Steps: tsc (decorator metadata) -> esbuild bundle -> SEA blob with the
//   assets -> node binary copy with the blob injected by postject (on macOS
//   the copy's signature is removed first and replaced by an ad-hoc one).
//   The build string (src/build-info.ts) is TIGER_TEST_HARNESS_BUILD_INFO,
//   the JSON of scripts/compute-build-string.mjs, which CI passes in; without
//   it the script computes one, and that is the untracked version unless
//   TIGER_TEST_HARNESS_SEQ is set.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileScriptFiles,
  loadScriptFolder,
  writeCompiledBs,
} from "@blamnetwork/bullshcript/destiny1/common";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const APP_NAME = "tiger_test_harness";
const PLATFORM = `${process.platform}-${process.arch}`;
const BUILD_DIR = join("release", ".build");
const TSC_DIR = join(BUILD_DIR, "tsc");
const OUT_DIR = join("release", PLATFORM);
const EXE = join(
  OUT_DIR,
  process.platform === "win32" ? `${APP_NAME}.exe` : APP_NAME
);
const SEA_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function exec(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const run = (args) => exec(process.execPath, args);

function buildInfo() {
  const fromEnv = process.env.TIGER_TEST_HARNESS_BUILD_INFO;
  if (fromEnv) {
    return JSON.parse(fromEnv);
  }
  return JSON.parse(
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("compute-build-string.mjs", import.meta.url))],
      { encoding: "utf8" }
    )
  );
}

function walk(dir, filter) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(path, filter);
    }
    return filter(path) ? [path] : [];
  });
}

// Packages the server loads only when present (ws and Nest's optional peers).
const OPTIONAL_PACKAGES = [
  "bufferutil",
  "utf-8-validate",
  "@nestjs/microservices",
  "@nestjs/websockets",
  "class-validator",
  "class-transformer",
  "cache-manager",
];

const key = (path) => relative(".", path).replaceAll("\\", "/");

const info = buildInfo();

rmSync(BUILD_DIR, { recursive: true, force: true });
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// 1. tsc, for emitDecoratorMetadata; the generated Prisma clients are plain JS.
run([
  require.resolve("typescript/bin/tsc"),
  "-p",
  "tsconfig.build.json",
  "--outDir",
  TSC_DIR,
  "--incremental",
  "false",
  "--declaration",
  "false",
  "--sourceMap",
  "false",
]);
const prismaClients = join("src", "generated", "prisma");
cpSync(prismaClients, join(TSC_DIR, "generated", "prisma"), {
  recursive: true,
  filter: (path) => !/\.(node|wasm|ts)$/.test(path) || path.endsWith(".js"),
});

// 2. One CommonJS file. __dirname is the executable's folder (Prisma's client
// looks for its engine and schema beside itself); require.resolve of a
// bundled module has no meaning, so it answers with the specifier.
const bundle = join(BUILD_DIR, "bundle.cjs");
await build({
  entryPoints: [join(TSC_DIR, "release.js")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  keepNames: true,
  logLevel: "warning",
  banner: {
    js: `const __exeDir = require("node:path").dirname(process.execPath);\nconst __bundledResolve = (id) => id;`,
  },
  define: {
    __dirname: "__exeDir",
    __TIGER_TEST_HARNESS_BUILD__: JSON.stringify({
      branch: info.branch,
      buildString: info.buildString,
      builtAt: info.builtAt,
      commit: info.commit,
      seq: info.seq,
    }),
  },
  external: OPTIONAL_PACKAGES,
  plugins: [
    {
      name: "require-resolve",
      setup(b) {
        b.onLoad({ filter: /\.[cm]?js$/ }, (args) => {
          const text = readFileSync(args.path, "utf8");
          return text.includes("require.resolve(")
            ? {
                contents: text.replaceAll(
                  "require.resolve(",
                  "__bundledResolve("
                ),
                loader: "js",
              }
            : undefined;
        });
      },
    },
  ],
});

// 3. Assets: per-build migrations, item grants and compiled scripts, the
// Prisma engine.
const assets = {};
for (const folder of readdirSync("prisma")) {
  for (const file of walk(join("prisma", folder, "migrations"), (p) =>
    p.endsWith(".sql")
  )) {
    assets[key(file)] = file;
  }
  const grants = `item-grants.${folder}.json`;
  if (existsSync(grants)) {
    assets[grants] = grants;
  }
}
const fukugenRoot =
  process.env.FUKUGEN_DAIHON_DIR ??
  join(
    realpathSync("node_modules/@blamnetwork/bullshcript"),
    "../fukugen-daihon"
  );
// Every build's scripts compiled here; the executable loads these trees
// (src/activity-host-proxy/script-host/script-build.ts) and compiles nothing.
for (const folder of readdirSync("prisma")) {
  const compiled = compileScriptFiles(
    loadScriptFolder(join(fukugenRoot, "destiny1", folder)).files
  );
  const tree = join(BUILD_DIR, "compiled_bs", folder);
  writeCompiledBs(tree, compiled);
  for (const file of walk(tree, () => true)) {
    assets[
      `compiled_bs/${folder}/${relative(tree, file).replaceAll("\\", "/")}`
    ] = file;
  }
}
const clientDir = join(prismaClients, readdirSync(prismaClients)[0]);
const engine = readdirSync(clientDir).find((name) =>
  /query_engine.*\.node$/.test(name)
);
if (!engine) {
  throw new Error(
    `no Prisma engine library in ${clientDir}: run npm run prisma:generate`
  );
}
assets["engine/query_engine.node"] = join(clientDir, engine);
const manifestFile = join(BUILD_DIR, "manifest.json");
writeFileSync(
  manifestFile,
  JSON.stringify({
    engineHash: createHash("sha256")
      .update(readFileSync(assets["engine/query_engine.node"]))
      .digest("hex")
      .slice(0, 16),
    keys: Object.keys(assets).sort(),
  })
);
assets["manifest.json"] = manifestFile;

// 4. The blob, then a copy of this node with it injected.
const blob = join(BUILD_DIR, "sea.blob");
const seaConfig = join(BUILD_DIR, "sea-config.json");
writeFileSync(
  seaConfig,
  JSON.stringify({
    main: bundle,
    output: blob,
    disableExperimentalSEAWarning: true,
    assets,
  })
);
run(["--experimental-sea-config", seaConfig]);
copyFileSync(process.execPath, EXE);
// Node's own signature would not cover the injected segment.
if (process.platform === "darwin") {
  exec("codesign", ["--remove-signature", EXE]);
}
run([
  require.resolve("postject/dist/cli.js"),
  EXE,
  "NODE_SEA_BLOB",
  blob,
  "--sentinel-fuse",
  SEA_FUSE,
  ...(process.platform === "darwin"
    ? ["--macho-segment-name", "NODE_SEA"]
    : []),
]);
if (process.platform === "darwin") {
  exec("codesign", ["--sign", "-", EXE]);
}

const mb = (path) => (statSync(path).size / 1024 / 1024).toFixed(1);
console.log(
  `${EXE}: ${mb(EXE)} MB (blob ${mb(blob)} MB, ${Object.keys(assets).length} assets), ${info.buildString}`
);
