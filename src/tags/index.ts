import { tag as orbitClient } from "./scenario_client/80ADE004_orbit_scenario_client";
import { tag as venusChapter2Client } from "./scenario_client/80B08006_venus_chapter_2_scenario_client";
import { tag as cityTowerDefault1Client } from "./scenario_client/80B86004_city_tower_default1_scenario_client";
import { tag as ambientCityTowerClient } from "./scenario_client/80BB0004_ambient_city_tower_scenario_client";
import { tag as pvpFactoryClient } from "./scenario_client/80C04004_pvp_factory_scenario_client";
import { tag as pvpGreenhouseClient } from "./scenario_client/80C82004_pvp_greenhouse_scenario_client";
import { tag as actionMockClient } from "./scenario_client/80D7E004_action_mock_scenario_client";
import { tag as pvpMarsbattleClient } from "./scenario_client/80D00004_pvp_marsbattle_scenario_client";
import { tag as pvpFactoryFah } from "./scenario_fah/80A0C004_pvp_factory_scenario_fah";
import { tag as actionMockFah } from "./scenario_fah/80A8A004_action_mock_scenario_fah";
import { tag as pvpGreenhouseFah } from "./scenario_fah/80A36004_pvp_greenhouse_scenario_fah";
import { tag as pvpMarsbattleFah } from "./scenario_fah/80A60004_pvp_marsbattle_scenario_fah";
import { tag as venusBounty1Fah } from "./scenario_fah/809B800A_venus_bounty_1_scenario_fah";
import { tag as venusChapter2Fah } from "./scenario_fah/809B8006_venus_chapter_2_scenario_fah";
import { tag as venusPortal1Fah } from "./scenario_fah/809B8008_venus_portal_1_scenario_fah";
import { tag as cityTowerDefault1Fah } from "./scenario_fah/809E2004_city_tower_default1_scenario_fah";
import type { ScenarioClientTag, ScenarioFahTag } from "./types";

export {
  ACTIVITY_BUNDLE_TAGS,
  ACTIVITY_SLICE_BUNDLE_HASHES,
  activityBundleForSlice,
} from "./activity_bundle";
export { ACTIVITY_ID_NAMES } from "./package_entry/808018BE_package_entry";
export type { ScenarioClientTag, ScenarioFahTag } from "./types";

/**
 * Host-scenario FAH tags (class 80800890). `initialBubble` is the u32be
 * at +0x1C. GAH of the same class is −1 on every dump — not listed.
 */
export const SCENARIO_FAH_TAGS: readonly ScenarioFahTag[] = [
  actionMockFah,
  cityTowerDefault1Fah,
  pvpFactoryFah,
  pvpGreenhouseFah,
  pvpMarsbattleFah,
  venusBounty1Fah,
  venusChapter2Fah,
  venusPortal1Fah,
];

/**
 * scenario_client tags (class 808008A4). Checksums at +4/+8/+12,
 * bubbleCount at +44.
 */
export const SCENARIO_CLIENT_TAGS: readonly ScenarioClientTag[] = [
  actionMockClient,
  ambientCityTowerClient,
  cityTowerDefault1Client,
  orbitClient,
  pvpFactoryClient,
  pvpGreenhouseClient,
  pvpMarsbattleClient,
  venusChapter2Client,
];

/** activityName → 80800890+0x1C */
export const FAH_INITIAL_BUBBLE: Record<string, number> = Object.fromEntries(
  SCENARIO_FAH_TAGS.map((t) => [t.activityName, t.initialBubble])
);
