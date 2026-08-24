/**
 * 808008A4 scenario_client words from the named package tags.
 *
 *   +4  family / package checksum (FNV of the activity symbol)
 *   +8  PRIVATE compare (sub_83612298, ac type 0)
 *   +12 PUBLIC compare
 *   +44 bubbleCount (must match Global Activity State +16)
 *
 * Initial slice is not on this tag. It is the FAH host-scenario dword
 * at 80800890+0x1C — see {@link FAH_INITIAL_BUBBLE}.
 */

export interface ScenarioClient {
  activityName: string;
  bubbleCount: number;
  /**
   * Empty bubbles which have no states.
   * We track these in the Global Activity State so we can mark them as inaccessible.
   */
  emptyBubbles?: readonly number[];
  familyChecksum: number;
  initialBubble?: number;
  privateChecksum: number;
  publicChecksum: number;
  tag: number;
}

/**
 * FAH host-scenario (class 80800890) u32be at +0x1C.
 * Dumped from the named `:scenario_fah` package tags.
 */
export const FAH_INITIAL_BUBBLE: Record<string, number> = {
  action_mock: 0, // 80A8A004
  city_tower_default1: 3, // 809E2004
  pvp_factory: 0, // 80A0C004
  pvp_greenhouse: 0, // 80A36004
  pvp_marsbattle: 0, // 80A60004
  venus_bounty_1: 21, // 809B800A
  venus_chapter_2: 16, // 809B8006
  venus_portal_1: 16, // 809B8008
};

export const SCENARIO_CLIENTS: Record<string, ScenarioClient> = {
  action_mock: {
    activityName: "action_mock",
    bubbleCount: 1,
    familyChecksum: 0xf7bd8718,
    initialBubble: FAH_INITIAL_BUBBLE.action_mock,
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
    initialBubble: FAH_INITIAL_BUBBLE.city_tower_default1,
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
    initialBubble: FAH_INITIAL_BUBBLE.pvp_factory,
    privateChecksum: 0x544111ef,
    publicChecksum: 0xda201225,
    tag: 0x80c04004,
  },
  pvp_greenhouse: {
    activityName: "pvp_greenhouse",
    bubbleCount: 1,
    familyChecksum: 0xd3249bc3,
    initialBubble: FAH_INITIAL_BUBBLE.pvp_greenhouse,
    privateChecksum: 0x210d5a63,
    publicChecksum: 0xda201225,
    tag: 0x80c82004,
  },
  pvp_marsbattle: {
    activityName: "pvp_marsbattle",
    bubbleCount: 1,
    familyChecksum: 0x7124853d,
    initialBubble: FAH_INITIAL_BUBBLE.pvp_marsbattle,
    privateChecksum: 0xbd6d8536,
    publicChecksum: 0xda201225,
    tag: 0x80d00004,
  },
  venus_chapter_2: {
    activityName: "venus_chapter_2",
    bubbleCount: 0x1e,
    // one of these is jungle
    emptyBubbles: [11, 15, 20, 22],
    familyChecksum: 0xe2c98505,
    initialBubble: FAH_INITIAL_BUBBLE.venus_chapter_2,
    privateChecksum: 0xb412f8d8,
    publicChecksum: 0xf47a9130,
    tag: 0x80b08006,
  },
};

export function scenarioClient(name: string): ScenarioClient | undefined {
  return SCENARIO_CLIENTS[name];
}
