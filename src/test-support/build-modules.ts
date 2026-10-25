import { e_build } from "../builds";

// A build's own modules for the suites that run on every build. Each loads
// on call, so after describeBuild has reset the modules it is that build's.

// The build's BAP schemas and messages (its xBap() accessor).
export const bapOf: Record<e_build, () => Promise<{ schemas: any }>> = {
  [e_build.v36735_13_12_02_1953_alpha]: async () =>
    (
      await import(
        "../bungie-access-protocol/versions/v36735_13_12_02_1953_alpha/alpha-bap"
      )
    ).alphaBap(),
  [e_build.v38464_14_02_28_1027_betath]: async () =>
    (
      await import(
        "../bungie-access-protocol/versions/v38464_14_02_28_1027_betath/betath-bap"
      )
    ).betathBap(),
  [e_build.v39573_14_04_03_1336_ff]: async () =>
    (
      await import(
        "../bungie-access-protocol/versions/v39573_14_04_03_1336_ff/ff-bap"
      )
    ).ffBap(),
  [e_build.v40662_14_05_19_1414_pubalpha]: async () =>
    (
      await import(
        "../bungie-access-protocol/versions/v40662_14_05_19_1414_pubalpha/pubalpha-bap"
      )
    ).pubalphaBap(),
  [e_build.v41375_14_07_03_1501_live]: async () =>
    (
      await import(
        "../bungie-access-protocol/versions/v41375_14_07_03_1501_live/live-bap"
      )
    ).liveBap(),
};
