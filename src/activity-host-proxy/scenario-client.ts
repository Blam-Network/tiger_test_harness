/**
 * 808008A4 scenario_client words from the named package tags.
 *
 *   +4  family / package checksum (FNV of the activity symbol)
 *   +8  PRIVATE compare (sub_83612298, ac type 0)
 *   +12 PUBLIC compare
 *   +44 bubbleCount (must match GAS+16)
 */

export interface ScenarioClient {
  activityName: string;
  bubbleCount: number;
  familyChecksum: number;
  privateChecksum: number;
  publicChecksum: number;
  tag: number;
}

export const SCENARIO_CLIENTS: Record<string, ScenarioClient> = {
  action_mock: {
    activityName: "action_mock",
    bubbleCount: 1,
    familyChecksum: 0xf7bd8718,
    privateChecksum: 0xb165117a,
    publicChecksum: 0xda201225,
    tag: 0x80d7e004,
  },
  ambient_city_tower: {
    activityName: "ambient_city_tower",
    bubbleCount: 5,
    familyChecksum: 0x0cdeb639,
    privateChecksum: 0xd45abddc,
    publicChecksum: 0x0fe217e2,
    tag: 0x80bb0004,
  },
  city_tower_default1: {
    activityName: "city_tower_default1",
    bubbleCount: 5,
    familyChecksum: 0x545aec79,
    privateChecksum: 0x2848170f,
    publicChecksum: 0x0fe217e2,
    tag: 0x80b86004,
  },
  orbit: {
    activityName: "orbit",
    bubbleCount: 8,
    familyChecksum: 0xb084dd2b,
    privateChecksum: 0xfc494bf6,
    publicChecksum: 0x8bea598a,
    tag: 0x80ade004,
  },
  pvp_factory: {
    activityName: "pvp_factory",
    bubbleCount: 1,
    familyChecksum: 0x54a75336,
    privateChecksum: 0x544111ef,
    publicChecksum: 0xda201225,
    tag: 0x80c04004,
  },
  pvp_greenhouse: {
    activityName: "pvp_greenhouse",
    bubbleCount: 1,
    familyChecksum: 0xd3249bc3,
    privateChecksum: 0x210d5a63,
    publicChecksum: 0xda201225,
    tag: 0x80c82004,
  },
  pvp_marsbattle: {
    activityName: "pvp_marsbattle",
    bubbleCount: 1,
    familyChecksum: 0x7124853d,
    privateChecksum: 0xbd6d8536,
    publicChecksum: 0xda201225,
    tag: 0x80d00004,
  },
  venus_chapter_2: {
    activityName: "venus_chapter_2",
    bubbleCount: 0x1e,
    familyChecksum: 0xe2c98505,
    privateChecksum: 0xb412f8d8,
    publicChecksum: 0xf47a9130,
    tag: 0x80b08006,
  },
};

export function scenarioClient(name: string): ScenarioClient | undefined {
  return SCENARIO_CLIENTS[name];
}
