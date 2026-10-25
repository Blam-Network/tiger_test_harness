// A package file's header, which the content manifest lists.
import type { ContentReaders } from "../../content-build";
import type { GibbonApi } from "./package-set";

export function packageHeaderReaders(
  g: GibbonApi
): Pick<
  ContentReaders,
  "packageHeader" | "packageHeaderSize" | "packageLanguage"
> {
  return {
    packageHeader(header) {
      const { pkg_id, unknown08, patch, language } = g.read_definition(
        header,
        g.s_package_header
      );
      return { packageId: pkg_id, headerValue: unknown08, patch, language };
    },
    packageHeaderSize: () => g.k_package_header_size,
    packageLanguage: (name) =>
      g.e_package_language[name as keyof typeof g.e_package_language],
  };
}
