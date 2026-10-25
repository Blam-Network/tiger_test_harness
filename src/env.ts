import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { embedded } from "./assets";
import type { e_build } from "./builds";

// Next to the executable when released, else the working directory.
export function workingDir(): string {
  return embedded() ? dirname(process.execPath) : process.cwd();
}

// Load `.env` from the working directory and package roots (src/ or dist/).
export function loadWebTigerEnv(): void {
  const candidates = [
    join(workingDir(), ".env"),
    join(__dirname, "..", ".env"),
    join(__dirname, "..", "..", ".env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
    }
  }
}

// Each build's accounts, characters and items are one SQLite file,
// tiger_test_harness-<build number>.db (the build string's first field,
// 41375), in the working directory (the executable's own folder in the
// release). Same derivation as scripts/lib/tiger-database-url.mjs, which the
// migrations use. `dir` is a parameter so tests can isolate.
export function tigerDatabaseUrlFor(dir: string, build: e_build): string {
  const buildNumber = build.split(".")[0];
  return `file:${resolve(dir, `tiger_test_harness-${buildNumber}.db`).replaceAll("\\", "/")}`;
}

// Everything the server can regenerate (the table cache, the unpacked Prisma
// engine) lives under here.
export function harnessTempDir(): string {
  return join(tmpdir(), "tiger_test_harness");
}

// Named-handle stand-ins the scripts read with is_active(). Comma separated
// (`TIGER_SCRIPT_HANDLES=raid_phase0`); an unlisted handle reads false.
// The 8080128E handles' true meaning is unknown.
export function resolveScriptHandles(): Record<string, boolean> {
  loadWebTigerEnv();
  const raw = process.env.TIGER_SCRIPT_HANDLES?.trim();
  const handles: Record<string, boolean> = {};
  for (const name of raw ? raw.split(",") : []) {
    const trimmed = name.trim();
    if (trimmed) {
      handles[trimmed] = true;
    }
  }
  return handles;
}

// Directory holding the game's .pkg files. No default: code that needs the
// packages calls requirePackagesDir.
export function resolvePackagesDir(): string | undefined {
  loadWebTigerEnv();
  const raw = process.env.TIGER_PACKAGES_DIR?.trim();
  return raw || undefined;
}

export function requirePackagesDir(): string {
  const dir = resolvePackagesDir();
  if (!dir) {
    throw new Error(
      "TIGER_PACKAGES_DIR is not set: point it at the game's packages directory"
    );
  }
  return dir;
}

// The packages directory a build folder's gated tests read, named by
// TIGER_TEST_PACKAGES_<FOLDER IN UPPER CASE> in .env.test (see
// .env.test.example). Not TIGER_PACKAGES_DIR, which only the build the server
// serves reads. Unset, or not an existing directory, the tests skip
// (test-support/build.ts hasPackages also checks the headers).
export function testPackagesDir(folder: string): string | undefined {
  loadWebTigerEnv();
  const raw =
    process.env[`TIGER_TEST_PACKAGES_${folder.toUpperCase()}`]?.trim();
  return raw && existsSync(raw) ? raw : undefined;
}

// The build this process serves (TIGER_GAME_BUILD): a build string or a
// build folder name. Unset means the server's only build (builds.ts).
export function resolveGameBuild(): string | undefined {
  loadWebTigerEnv();
  const raw = process.env.TIGER_GAME_BUILD?.trim();
  return raw || undefined;
}

// CHARACTER_LEVEL (1..max) overrides the level the character sheet reports.
// Read as the level constant loads, so only the process environment counts
// (no loadWebTigerEnv, like the other policy constants).
export function resolveCharacterLevel(fallback: number, max: number): number {
  const raw = Number(process.env.CHARACTER_LEVEL?.trim());
  if (!Number.isInteger(raw) || raw < 1) {
    return fallback;
  }
  return Math.min(raw, max);
}

// The resolvers below read the process environment as it stands, without
// loadWebTigerEnv, because the config constants and policy tables that use
// them evaluate at import (like resolveCharacterLevel above).

// HOSTNAME: the address the listeners bind when the caller names none.
export function resolveHostname(): string | undefined {
  return process.env.HOSTNAME;
}

// A comma separated list of ports; unset or empty gives `fallback`, entries
// that are not positive numbers are dropped.
export function resolvePortList(
  name: string,
  fallback: readonly number[]
): number[] {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return [...fallback];
  }
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// DEMONWARE_LOBBY_PORT (one port) wins over DEMONWARE_LOBBY_PORTS (a list).
export function resolveDemonwareLobbyPortList(
  fallback: readonly number[]
): number[] {
  const single = process.env.DEMONWARE_LOBBY_PORT;
  if (single?.trim()) {
    return [Number(single)];
  }
  return resolvePortList("DEMONWARE_LOBBY_PORTS", fallback);
}

export function resolveDemonwareBindHost(): string {
  return process.env.DEMONWARE_BIND_HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
}

export function resolveBapSignonIp(): string {
  return process.env.BAP_SIGNON_IP ?? "127.0.0.1";
}

export function resolveBapBindIp(): string {
  return process.env.BAP_BIND_IP ?? "0.0.0.0";
}

export function resolveBapSignonPort(): number {
  return Number(process.env.BAP_SIGNON_PORT ?? 37_000);
}

export function resolveContentManifestUrl(): string {
  return (
    process.env.CONTENT_MANIFEST_URL ??
    "https://www1.signon.deadorbit.net/content_manifest"
  );
}

export function resolveContentManifestLanguage(): string {
  return process.env.CONTENT_MANIFEST_LANGUAGE ?? "en";
}

// The activity host proxy's advertised address, bind address and port; the
// addresses fall back to the BAP ones.
export function resolveActivityHostProxyIp(fallback: string): string {
  return process.env.ACTIVITY_HOST_PROXY_IP ?? fallback;
}

export function resolveActivityHostProxyBindIp(fallback: string): string {
  return process.env.ACTIVITY_HOST_PROXY_BIND_IP ?? fallback;
}

export function resolveActivityHostProxyPort(): number {
  return Number(process.env.ACTIVITY_HOST_PROXY_PORT ?? 37_001);
}

// TIGER_START_BUBBLE: `activity:bubble` entries, comma separated, or "".
export function resolveStartBubbleOverrides(): string {
  return process.env.TIGER_START_BUBBLE ?? "";
}

// TIGER_COMPILED_BS_DIR: where the compiled scripts go, before the build's
// folder is appended.
export function resolveCompiledBsDir(): string | undefined {
  return process.env.TIGER_COMPILED_BS_DIR;
}

export function resolveDictionaryDir(): string | undefined {
  return process.env.TIGER_DICTIONARY_DIR;
}

export function resolveDebugHttpPort(): number {
  return Number(process.env.WEB_TIGER_DEBUG_PORT ?? 8099);
}

export function resolveNoColor(): boolean {
  return Boolean(process.env.NO_COLOR);
}

// TIGER_LOG_DIR: where the event reports (debug.txt, reports/, datamine/)
// go. Unset is console only.
export function resolveLogDir(): string | undefined {
  return process.env.TIGER_LOG_DIR?.trim() || undefined;
}

// DATAMINE_EVENTS_PORT: serves the live event stream for the datamine
// viewer on loopback. Unset is off.
export function resolveDatamineEventsPort(): number | undefined {
  const port = Number(process.env.DATAMINE_EVENTS_PORT?.trim());
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

// UNIVERSE_TIME: "now", unix seconds, or `fallback` (also for anything that
// is not a positive number).
export function resolveUniverseStart(fallback: number): number | "now" {
  const raw = process.env.UNIVERSE_TIME?.trim();
  if (!raw) {
    return fallback;
  }
  if (raw === "now") {
    return "now";
  }
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
}

// DIRECTOR_MODE: "unlock", "locked", or the default "reveal".
export function resolveDirectorMode(): "unlock" | "reveal" | "locked" {
  const raw = process.env.DIRECTOR_MODE?.trim();
  return raw === "unlock" || raw === "locked" ? raw : "reveal";
}

// TOWER_STATE: which Tower the orbit node launches; unset is the default Tower.
export function resolveTowerState():
  | "default"
  | "iron_banner"
  | "queen"
  | undefined {
  const raw = process.env.TOWER_STATE?.trim();
  return raw === "default" || raw === "iron_banner" || raw === "queen"
    ? raw
    : undefined;
}

// DEBUG_UNLOCK=0 turns the client's debug unlock off.
export function resolveDebugUnlock(): boolean {
  return process.env.DEBUG_UNLOCK?.trim() !== "0";
}
