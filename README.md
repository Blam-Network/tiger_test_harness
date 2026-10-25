![hero](./hero.jpg)
# Tiger Test Harness
Destiny (Tiger engine) test harness: a basic server for several Destiny builds, used to test [fukugen daihon](https://github.com/Blam-Network/tiger/tree/main/packages/fukugen-daihon) (rewritten mission scripts). It includes:
- Sign-on server, content manifest and Demonware auth (HTTP)
- Ticket Server (Datamine)
- Bungie Access Protocol TCP server
- Activity Host server, running bullshcript activity scripts
- DemonWare 3.1 lobby server
- Basic ShadPSN server

**This is not a full Destiny server.** The investment system (gear, unlocks, drops, progression) is minimal, and outside the activity host most services answer with canned responses, kept in each service's `stubs/` folder. The project is heavily vibecoded and not meant for production or as a foundation. The mission scripting is the careful, regularly tested part: see [bullshcript](https://github.com/Blam-Network/tiger/tree/main/packages/bullshcript).

## Builds
One process serves one build, chosen by `TIGER_GAME_BUILD` (build string or folder name). The builds are listed in `src/builds.ts` (`e_build`); each service keeps its per-build code in `versions/<folder>/`.

| Build | Folder |
|---|---|
| `41375.14.07.03.1501.live` | `v41375_14_07_03_1501_live` |
| `40662.14.05.19.1414.pubalpha` | `v40662_14_05_19_1414_pubalpha` |
| `39573.14.04.03.1336.ff` | `v39573_14_04_03_1336_ff` |
| `38464.14.02.28.1027.betath` | `v38464_14_02_28_1027_betath` |
| `36735.13.12.02.1953.alpha` | `v36735_13_12_02_1953_alpha` |

## Setup
1. Get tiger: `vendor/tiger` is a git submodule pinned to a tiger commit, and web-tiger depends on its `gibbon`, `bullshcript`, `poodle`, `rsat` and `datamine` packages through `file:vendor/tiger/...`. Clone with `--recurse-submodules`, or run `git submodule update --init` in an existing clone. Edit tiger inside `vendor/tiger`; to move the pin, commit and push there, then `git add vendor/tiger` here.
2. `npm run tiger:build` (installs tiger and builds those packages), then `npm install`.
3. Create a `.env` file in the project root:
    ```env
    # Required: the game's packages directory for the served build
    TIGER_PACKAGES_DIR=
    # Required: the build to serve (build string or folder name)
    TIGER_GAME_BUILD=41375.14.07.03.1501.live

    # Address the console dials for BAP (default 127.0.0.1); the listener binds BAP_BIND_IP (default 0.0.0.0)
    # BAP_SIGNON_IP=127.0.0.1
    # BAP_BIND_IP=0.0.0.0
    # BAP_SIGNON_PORT=37000
    # Activity host (addresses default to BAP's)
    # ACTIVITY_HOST_PROXY_IP=
    # ACTIVITY_HOST_PROXY_BIND_IP=
    # ACTIVITY_HOST_PROXY_PORT=37001
    # Sign-on HTTP ports and Demonware lobby ports (default: the build's own), datamine ports (default 32556)
    # SIGNON_HTTP_PORTS=443
    # DEMONWARE_LOBBY_PORTS=1020,1021,1011   # DEMONWARE_LOBBY_PORT=<one port> wins over the list
    # DATAMINE_HTTP_PORTS=32556
    # Bind address for every listener, ahead of the *_BIND_IP settings; the lobby uses DEMONWARE_BIND_HOST (default HOSTNAME, else 0.0.0.0)
    # HOSTNAME=
    # DEMONWARE_BIND_HOST=0.0.0.0
    # Content manifest the sign-on server serves
    # CONTENT_MANIFEST_URL=https://www1.signon.deadorbit.net/content_manifest
    # CONTENT_MANIFEST_LANGUAGE=en

    # Write the event reports (debug.txt, reports/, datamine/) to this directory; unset is console only
    # TIGER_LOG_DIR=logs
    # Serve the live event stream for the datamine viewer on 127.0.0.1
    # DATAMINE_EVENTS_PORT=32557
    # Compiled activity scripts (default ./compiled_bs/<build folder>; a checkout only, the executable loads its prebuilt ones)
    # TIGER_COMPILED_BS_DIR=compiled_bs
    # Name hash dictionary (default: tiger's dictionary package)
    # TIGER_DICTIONARY_DIR=
    # Script debugger port
    # WEB_TIGER_DEBUG_PORT=8099

    # Stub policy
    # CHARACTER_LEVEL=34                  # level every character reports
    # DIRECTOR_MODE=reveal                # reveal | unlock | locked
    # DEBUG_UNLOCK=1                      # 0 turns the debug unlock off
    # TOWER_STATE=                        # default | iron_banner | queen
    # UNIVERSE_TIME=                      # universe clock start (unix seconds or "now")
    # TIGER_SCRIPT_HANDLES=               # named handles the scripts read as active, comma separated
    # TIGER_START_BUBBLE=                 # per-activity start bubble overrides, <activity>:<bubble>
    ```
4. Generate the protobuf and Prisma code with `npm run proto:generate` and `npm run prisma:generate` (`start:dev`, `build` and `release` do both).
5. Accounts and characters need no database server: each build has its own SQLite file, `tiger_test_harness-<build number>.db` (for example `tiger_test_harness-41375.db`), in the working directory. The server creates it and applies the build's migrations at startup. To author a migration, edit `prisma/<build folder>/schema.prisma` and run `npm run tiger:migrate -- <build folder>`; more `prisma migrate dev` arguments follow a second `--`.
6. Optional dev config in the project root, re-read while running: `debug-toggles.json` (gitignored, see `src/dev-config/debug-toggles.ts`) and `item-grants.<build folder>.json` (def indices differ per build, see `src/dev-config/item-grants.ts`).

## Running
```bash
npm run start                          # nest start
npm run start:dev                      # watch mode, also rebuilds tiger on change
npm run build && npm run start:prod    # node dist/main
```
`node dist/cli` asks for the packages folder and build the way the release executable does (see below); `node dist/main` takes everything from the environment.

## Tests
`npm run validate` runs lint (`ultracite`), tests and typecheck without any local test packages, as CI does; it is also the pre-commit hook.

`npm test` also runs the tests that read game data, on each build's own packages: copy `.env.test.example` to `.env.test` and point each `TIGER_TEST_PACKAGES_<BUILD FOLDER>` at that build's packages folder (its `.pkg` headers must name the build). `TIGER_PACKAGES_DIR` from `.env` never reaches the tests. A build with no folder skips its package tests, and the run prints a line saying so.

A test runs on the build its `versions/<folder>/` names, else on the live build. Suites for every build are `*.builds.test.ts` files that use `describeEachBuild` (`describeBuild` runs one suite under a given build, both in `src/test-support/build.ts`); vitest runs each build's in a project and process of its own. To run only one build's: `npx vitest run --project <build folder>`.

## Logging
Every log line is an event from [`@blamnetwork/datamine`](https://github.com/Blam-Network/tiger/tree/main/packages/datamine), Halo style: `event_message("networking:bap: client connected %s", address)`. The category is the `a:b:` prefix; its levels, colour and log file are in `src/utils/event-categories.ts`. Events show on the console (message and up), go to the log files, and, at message and up, become datamine records. Nest's framework lines come in as `nest:<context>:`.

With `TIGER_LOG_DIR` set the server writes `debug.txt` (errors, recreated each run), `reports/debug.txt`, `reports/debug_full.txt` (everything), a file per busy category (`networking_debug.txt`, `activities_debug.txt`, `demonware_debug.txt`, `bullshcript_debug.txt`) and `datamine/*.datamine` under it. Nothing is uploaded. `DATAMINE_EVENTS_PORT` serves the live stream (`/datamine/info`, `/datamine/events`) for the datamine viewer.

The server factories (`createTigerServer` and the per-service `create…Server`) and the modules' `ShutdownObserver` start the events when nothing has (`src/utils/events.ts`), so a library consumer gets console output without setup. A consumer that calls `events_initialize` itself keeps its setup.

## Release executable
`npm run release` builds `release/<platform>-<arch>/tiger_test_harness` (`.exe` on Windows) for the platform it runs on (`win32-x64`, `linux-x64` and `darwin-arm64` are built in CI): a single file with Node, the server and every static file it reads, so users need no Node, npm or Docker. It is a Node single executable application: `tsc` compiles `src/` (Nest needs the decorator metadata), esbuild bundles the result with the tiger packages, and `postject` injects the blob into a copy of `node`. It needs the same setup as `npm run build` (tiger built in `vendor/tiger`, `npm install`) and Node 24 or newer. On macOS the copy of `node` has its signature removed before the blob goes in and is signed ad hoc after.

Embedded as assets: each build's migration SQL (`prisma/<folder>/migrations`), each build's BungieScript compiled at release time (from tiger's `fukugen-daihon`, or `FUKUGEN_DAIHON_DIR`; the exe compiles nothing and writes no `compiled_bs/`), `item-grants.<folder>.json`, and Prisma's native query engine. The engine is unpacked at start to `<temp>/tiger_test_harness/engine/<hash>/` because a native library can't load from inside the file.

```
tiger_test_harness [--build <build string or folder>] [--packages <dir>] [--version]
```
- Version: `--version` prints the build string (`tiger_test_harness 00042.26.10.25.0612.main`) and exits. The banner and the server's first log line say it too.
- Packages: `--packages`, else `TIGER_PACKAGES_DIR`, else a `packages` folder with `.pkg` files next to the executable, else it asks for the folder.
- Build: read from the packages. Each `.pkg` header holds the build number of the tool that wrote it (u32 at 0x18, big-endian in 360 packages, little-endian in PS4 ones; the platform is the u16 at 0x02), and if all packages agree on one supported build the executable serves it and says so. `--build` or `TIGER_GAME_BUILD` names the build instead; if the packages are from another build it stops with an error. If the packages match no supported build, or several (a PS4 patch folder holds many), it prints what it found and asks which build to serve.
- Nothing about those choices is saved. The only file it writes beside the executable is the build's `tiger_test_harness-<build number>.db` (and its journal); the activity table cache and the unpacked engine go under `<temp>/tiger_test_harness/`. Datamine uploads are only logged. The other `.env` settings still apply, and `.env` is optional.

The executable is unsigned, so Windows SmartScreen may warn on first run; it is about 125 MB and only runs on the platform that built it.

## Builds and versions
Builds are numbered like Bungie's: `{seq}.{yy}.{mm}.{dd}.{hhmm}.{branch}` (`00042.26.10.25.0612.main`: CI run 42, UTC time, branch), or `untracked version` for pull requests, a detached HEAD and any local build. `scripts/compute-build-string.mjs` works it out from `TIGER_TEST_HARNESS_SEQ` and `TIGER_TEST_HARNESS_BRANCH` (`TIGER_TEST_HARNESS_UNTRACKED=1` forces untracked); `npm run release` embeds the result (`src/build-info.ts`), taking it from `TIGER_TEST_HARNESS_BUILD_INFO` (the script's JSON) when CI passes it in. Nest and tsc builds are always untracked.

GitHub Actions (`.github/workflows`):
- `ci.yml`: lint, tests and typecheck (`npm run validate`) on pushes to main and pull requests.
- `build.yml`: every branch push builds the executable on Windows, Linux and macOS (Apple silicon), attaches them to the run as `tiger_test_harness-<os>-<arch>` (tar.gz on Linux and macOS to keep the executable bit) and tags the commit with the build string. A push to main also publishes a GitHub release on that tag with the three executables.
- `build_pr.yml`: the same for pull requests, untracked and untagged.
- `release-assets.yml`: publishing a release by hand on another branch's build tag attaches that build's executables.

They check out the `vendor/tiger` submodule at its pinned commit, so code here that needs newer tiger changes builds only after tiger is pushed and the pin bumped.
