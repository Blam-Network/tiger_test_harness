import { ActivityBundleItemType, type ActivityBundleTag } from "../types";

/** city_tower_default1 80800533 (809E2007). Bundle F2D88BD0. */
export const tag: ActivityBundleTag = {
  activityName: "city_tower_default1",
  bundle: 0xf2d88bd0,
  class: 0x80800533,
  tag: 0x809e2007,
  rows: [
    {
      typeId: ActivityBundleItemType.PlayerObjective,
      typeIndex: 0,
      nameHash: 0x402107a0,
    }, // po_mission01
    {
      typeId: ActivityBundleItemType.PlayerObjective,
      typeIndex: 1,
      nameHash: 0x402107a3,
    }, // po_mission02
    {
      typeId: ActivityBundleItemType.Fireteam,
      typeIndex: 2,
      nameHash: 0xd7a09373,
    }, // host
    {
      typeId: ActivityBundleItemType.FiringArea,
      typeIndex: 3,
      nameHash: 0x0466a4cf,
    }, // firingarea
    {
      typeId: ActivityBundleItemType.TriggerVolume,
      typeIndex: 4,
      nameHash: 0xca7ae3b3,
    }, // killvolume_1
    {
      typeId: ActivityBundleItemType.NewMission,
      typeIndex: 5,
      nameHash: 0xd645ec0c,
    }, // pm_new_mission
    {
      typeId: ActivityBundleItemType.TriggerVolume,
      typeIndex: 6,
      nameHash: 0x30bb6e13,
    }, // killvolume
  ],
};
