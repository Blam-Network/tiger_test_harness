import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";
import { contentBuild } from "../content/versions";
import { resolveContentManifestLanguage } from "../env";
import { signonBuild } from "./versions";

// Registers patchable packages only from the content manifest; unlisted
// files on disk are never loaded ("failed to load bootstrap_patchable"). We
// list what's on disk.

// The language codes the config takes and the package header's names for them.
const PACKAGE_LANGUAGE_NAMES = {
  en: "english",
  fr: "french",
  it: "italian",
  de: "german",
  sp: "spanish",
  jpn: "japanese",
  pt: "portuguese",
} as const;

// The package header language of a language code. Base packages are 0.
export function packageLanguage(code: string): number | undefined {
  const name =
    PACKAGE_LANGUAGE_NAMES[code as keyof typeof PACKAGE_LANGUAGE_NAMES];
  return name && contentBuild().readers.packageLanguage(name);
}

// Registering two variants of one id fails (-63), so pick one language.
export const CONTENT_MANIFEST_LANGUAGE = resolveContentManifestLanguage();

// The client's download buffer.
export const CONTENT_MANIFEST_MAX_BYTES = 320_576;

const PACKAGE_ID_MIN = 0x0a;
const PACKAGE_ID_MAX = 0x17_ff;

export interface PackageHeader {
  headerValue: bigint;
  language: number;
  name: string;
  packageId: number;
  patch: number;
}

// The manifest echoes the header's u64 at +8 (true name unknown).
function readPackageHeader(name: string, header: Buffer): PackageHeader {
  const { packageId, headerValue, patch, language } =
    contentBuild().readers.packageHeader(header);
  return { name, packageId, headerValue, patch, language };
}

// One entry per package id: the highest patch of the base or chosen-language
// variant. The *_unpatchable packages register without the manifest.
export function selectManifestPackages(
  headers: readonly PackageHeader[],
  language: number
): PackageHeader[] {
  const byId = new Map<number, PackageHeader>();
  for (const header of headers) {
    if (header.name.endsWith("_unpatchable_0")) {
      continue;
    }
    if (header.language !== 0 && header.language !== language) {
      continue;
    }
    if (
      header.packageId < PACKAGE_ID_MIN ||
      header.packageId > PACKAGE_ID_MAX
    ) {
      continue;
    }
    const current = byId.get(header.packageId);
    if (!current || header.patch > current.patch) {
      byId.set(header.packageId, header);
    }
  }
  return [...byId.values()].sort((a, b) => a.packageId - b.packageId);
}

// Bare protobuf; only valid with the signature flag cleared by Sunrise.
export function buildContentManifest(
  packages: readonly PackageHeader[]
): Buffer {
  const manifest = signonBuild().contentManifest;
  if (!manifest) {
    throw new Error("this build has no content manifest");
  }
  return manifest.encode(packages);
}

export function readPackageHeaders(dir: string): PackageHeader[] {
  const headers: PackageHeader[] = [];
  const size = contentBuild().readers.packageHeaderSize();
  const buffer = Buffer.alloc(size);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".pkg")) {
      continue;
    }
    const fd = openSync(join(dir, file), "r");
    try {
      readSync(fd, buffer, 0, size, 0);
    } finally {
      closeSync(fd);
    }
    headers.push(readPackageHeader(file.slice(0, -".pkg".length), buffer));
  }
  return headers;
}
