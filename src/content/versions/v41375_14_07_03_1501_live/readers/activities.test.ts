import { expect, it } from "vitest";
import { describeWithPackages } from "../../../../test-support/build";
import {
  activityIds,
  activityName,
  activityPlaylist,
} from "../../../activities";
import { incidentNames } from "../../../incident-names";

// Opening the package set takes seconds on a loaded machine.
describeWithPackages("activity table", { timeout: 30_000 }, () => {
  it("names activities by their definitions", () => {
    expect(activityName(0)).toBe("city_tower_default1");
    expect(activityName(16)).toBe("venus_portal_1");
    expect(activityName(3)).toBeUndefined();
    expect(activityName(126)).toBe("act_cosmo_m0_highway");
    expect(activityName(237)).toBe("venus_portal_1");
    expect(activityName(125)).toBeUndefined();
    expect(activityIds()).toContain(126);
    // The Devils' Lair: the Cosmodrome node's strike (5, 6) and the heroic
    // entries the Vanguard playlists open on.
    expect(activityName(5)).toBe("cosmo_portal_1");
    expect(activityName(241)).toBe("cosmo_portal_1");
  });

  it("lists a playlist's picks", () => {
    expect(activityPlaylist(229)?.[0]).toBe(241);
    expect(activityPlaylist(237)).toBeUndefined();
    // Every Vanguard playlist opens on the Devils' Lair.
    for (const playlist of [228, 229, 230, 231, 232]) {
      const first = activityPlaylist(playlist)?.[0];
      expect(first === undefined ? undefined : activityName(first)).toBe(
        "cosmo_portal_1"
      );
    }
  });

  it("reads the client's incident registry", () => {
    const names = incidentNames();
    expect(names).toHaveLength(1383);
    expect(incidentNames()).toBe(names);
  });
});
