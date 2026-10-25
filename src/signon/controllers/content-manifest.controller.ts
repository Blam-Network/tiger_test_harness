import { event_message, event_warning } from "@blamnetwork/datamine";
import { Controller, Get, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { requirePackagesDir } from "../../env";
import {
  buildContentManifest,
  CONTENT_MANIFEST_LANGUAGE,
  packageLanguage,
  readPackageHeaders,
  selectManifestPackages,
} from "../content-manifest";
import { signonBuild } from "../versions";

// CONTENT_MANIFEST_URL (Engine Configuration 1.2) points here.
@ApiTags("Content Manifest")
@Controller("/content_manifest")
export class ContentManifestController {
  private manifest: Buffer | undefined;

  @Get()
  get(@Res() res: Response) {
    if (!signonBuild().contentManifest) {
      event_warning(
        "signon:content_manifest: this build has no content manifest, answering 404"
      );
      return res.status(404).end();
    }
    this.manifest ??= this.build();
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Length", this.manifest.length.toString());
    return res.status(200).send(this.manifest);
  }

  private build(): Buffer {
    const packagesDir = requirePackagesDir();
    const language = packageLanguage(CONTENT_MANIFEST_LANGUAGE) ?? 1;
    const packages = selectManifestPackages(
      readPackageHeaders(packagesDir),
      language
    );
    const manifest = buildContentManifest(packages);
    event_message(
      "signon:content_manifest: Content manifest: %d packages (%s), %d bytes from %s",
      packages.length,
      CONTENT_MANIFEST_LANGUAGE,
      manifest.length,
      packagesDir
    );
    return manifest;
  }
}
