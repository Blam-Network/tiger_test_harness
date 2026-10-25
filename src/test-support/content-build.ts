import { buildFolder, e_build } from "../builds";
import type { ContentBuild } from "../content/versions/content-build";
import { loadContentBuild as v36735_13_12_02_1953_alpha } from "../content/versions/v36735_13_12_02_1953_alpha";
import { loadContentBuild as v38464_14_02_28_1027_betath } from "../content/versions/v38464_14_02_28_1027_betath";
import { loadContentBuild as v39573_14_04_03_1336_ff } from "../content/versions/v39573_14_04_03_1336_ff";
import { loadContentBuild as v40662_14_05_19_1414_pubalpha } from "../content/versions/v40662_14_05_19_1414_pubalpha";
import { buildPackagesDir } from "./build";

// The builds whose readers take the packages directory they read.
type PackagesBuild = Exclude<e_build, typeof e_build.v41375_14_07_03_1501_live>;

const loaders: Record<PackagesBuild, (packagesDir: string) => ContentBuild> = {
  [e_build.v36735_13_12_02_1953_alpha]: v36735_13_12_02_1953_alpha,
  [e_build.v38464_14_02_28_1027_betath]: v38464_14_02_28_1027_betath,
  [e_build.v39573_14_04_03_1336_ff]: v39573_14_04_03_1336_ff,
  [e_build.v40662_14_05_19_1414_pubalpha]: v40662_14_05_19_1414_pubalpha,
};

const loaded = new Map<PackagesBuild, ContentBuild>();

// A build's content over its test packages (TIGER_TEST_PACKAGES_<FOLDER>),
// loaded once. Throws without them: gate the suite with hasPackages.
export function contentBuildForTest(build: PackagesBuild): ContentBuild {
  let content = loaded.get(build);
  if (!content) {
    const dir = buildPackagesDir(build);
    if (!dir) {
      throw new Error(`the ${buildFolder(build)} packages are not set`);
    }
    content = loaders[build](dir);
    loaded.set(build, content);
  }
  return content;
}
