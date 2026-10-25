// Static files the server reads (migration SQL, Fukugen Daihon scripts, the
// Prisma engine), by key such as "prisma/<build folder>/migrations/<name>/migration.sql".
// In the release executable they are SEA assets, listed by the manifest the
// release build embeds; otherwise the keys are paths under the package root.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAsset, isSea } from "node:sea";

const MANIFEST_KEY = "manifest.json";

interface AssetManifest {
  // sha256 of the Prisma engine library, which names its cache folder
  readonly engineHash: string;
  readonly keys: readonly string[];
}

export function embedded(): boolean {
  return isSea();
}

let manifest: AssetManifest | undefined;

export function embeddedManifest(): AssetManifest {
  manifest ??= JSON.parse(readAsset(MANIFEST_KEY).toString("utf8"));
  return manifest as AssetManifest;
}

// The folder holding prisma/, found from src/ or dist/ upwards.
function packageRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, "prisma"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("prisma/ folder not found");
    }
    dir = parent;
  }
  return dir;
}

export function readAsset(key: string): Buffer {
  if (!embedded()) {
    return readFileSync(join(packageRoot(), key));
  }
  return Buffer.from(getAsset(key));
}

// Every key under `prefix` (a folder, with its trailing slash), sorted.
export function listAssets(prefix: string): string[] {
  if (embedded()) {
    return embeddedManifest().keys.filter((key) => key.startsWith(prefix));
  }
  const root = packageRoot();
  const keys: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), {
      withFileTypes: true,
    })) {
      const key = `${dir}${entry.name}`;
      if (entry.isDirectory()) {
        walk(`${key}/`);
      } else {
        keys.push(key);
      }
    }
  };
  if (existsSync(join(root, prefix))) {
    walk(prefix);
  }
  return keys.sort();
}
