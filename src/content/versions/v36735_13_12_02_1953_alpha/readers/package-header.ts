// A package file's header, which the content manifest lists.
import type { ContentReaders } from "../../content-build";
import type { GibbonApi } from "./package-set";

// The header language of the packages that carry one. Only English ships
// (the `_en_` files); the rest are base packages (0).
const PACKAGE_LANGUAGES: Readonly<Record<string, number>> = { english: 1 };

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
    packageLanguage: (name) => PACKAGE_LANGUAGES[name],
  };
}
