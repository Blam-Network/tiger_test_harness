/** Host scenario FAH — class 80800890. */
export interface ScenarioFahTag {
  activityName: string;
  class: 0x80800890;
  /** +0x1C starting bubble. */
  initialBubble: number;
  tag: number;
}

/** scenario_client — class 808008A4. */
export interface ScenarioClientTag {
  activityName: string;
  bubbleCount: number;
  class: 0x808008a4;
  emptyBubbles?: readonly number[];
  familyChecksum: number;
  privateChecksum: number;
  publicChecksum: number;
  tag: number;
}
