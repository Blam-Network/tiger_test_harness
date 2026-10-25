import { describe, expect, it } from "vitest";
import { requirePackagesDir } from "../env";
import { hasPackages } from "../test-support/build";
import {
  buildContentManifest,
  CONTENT_MANIFEST_MAX_BYTES,
  type PackageHeader,
  packageLanguage,
  readPackageHeaders,
  selectManifestPackages,
} from "./content-manifest";

// The English package header language.
const ENGLISH = 1;

function header(
  name: string,
  packageId: number,
  language = 0,
  patch = 0
): PackageHeader {
  return {
    name,
    packageId,
    headerValue: 0xc2_22_92_b9_42_d1_0f_36n,
    patch,
    language,
  };
}

describe("content manifest", () => {
  it("encodes a list 3 entry like the client expects", () => {
    const bytes = buildContentManifest([
      header("360_client_bootstrap_patchabl_0172_0", 0x172),
    ]);
    expect(bytes.toString("hex")).toBe(
      "1a360800122433363" +
        "05f636c69656e745f626f6f7473747261705f70617463686162" +
        "6c5f303137325f301" +
        "8f20220b69ec49694d7a491c201" +
        // field 5, the build's guid
        "2a2430303030303030302d303030302d303030302d303030302d303030303030303431333735"
    );
  });

  it("takes the package languages from the header enum", () => {
    expect(packageLanguage("en")).toBe(ENGLISH);
    expect(packageLanguage("pt")).toBe(7);
    expect(packageLanguage("xx")).toBeUndefined();
  });

  it("keeps base and one language, skips unpatchable, takes the top patch", () => {
    const selected = selectManifestPackages(
      [
        header("360_globals_0153_en_0", 0x153, 1),
        header("360_globals_0153_fr_0", 0x153, 2),
        header("360_globals_0151_0", 0x151),
        header("360_globals_0151_1", 0x151, 0, 1),
        header("360_client_bootstrap_unpatchable_0", 0x179),
      ],
      ENGLISH
    );
    expect(selected.map((p) => p.name)).toEqual([
      "360_globals_0151_1",
      "360_globals_0153_en_0",
    ]);
  });

  it.skipIf(!hasPackages())("builds from the packages on disk", () => {
    const selected = selectManifestPackages(
      readPackageHeaders(requirePackagesDir()),
      ENGLISH
    );
    const names = selected.map((p) => p.name);
    expect(names).toContain("360_client_bootstrap_patchabl_0172_0");
    expect(names).toContain("360_globals_0153_en_0");
    expect(names).not.toContain("360_globals_0153_fr_0");
    const bytes = buildContentManifest(selected);
    expect(bytes.length).toBeLessThan(CONTENT_MANIFEST_MAX_BYTES);
  });
});
