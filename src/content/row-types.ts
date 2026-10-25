import { contentBuild } from "./versions";

// The build's activity bundle row type ids. Read when called, so importing
// this module doesn't load the build.
export function activityBundleItemType() {
  return contentBuild().bullshcript.ActivityBundleItemType;
}
