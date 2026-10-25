import { BitReader } from "@blamnetwork/rsat";
import { beforeAll, expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild } from "../../../test-support/build";
import type { Teleport } from "../../rsat/membership";
import type { BetathActivityHostBuild } from ".";

const IDENTITY = {
  machine: Buffer.from("1c697a7378030000", "hex"),
  player: Buffer.from("7081b90432aa3b8a", "hex"),
  account: 0x1_00_00_00_01n,
  character: 0x2_00_00_00_01n,
};

// The client takes the target from the second 80800DD4 (+0x14, 0x900390);
// with it in the first, it never accepted a debugger teleport.
describeBuild(
  e_build.v38464_14_02_28_1027_betath,
  "the host teleportation",
  () => {
    let build: BetathActivityHostBuild;
    let membership: typeof import("../../rsat/membership");
    const into7 = { id: 1, region: 7 << 3, transition: 0x2e_a8_fb_98 };

    beforeAll(async () => {
      const { activityHostBuild } = await import("..");
      build = activityHostBuild() as BetathActivityHostBuild;
      membership = await import("../../rsat/membership");
    });

    const teleportation = (teleport?: Teleport) => {
      const br = new BitReader(
        membership.buildReplicateMembershipRsat(IDENTITY, { teleport })
      );
      br.readBit();
      return build.ah.ReplicateMembership.decode(br).pahRegions?.unknown2;
    };

    it("names the target in the second nest while it runs", () => {
      for (const state of [1, 2]) {
        const running = teleportation({ ...into7, state });
        expect(running?.unknown0).toBe(1);
        expect(running?.unknown2).toEqual({
          unknown0: 1,
          unknown1: 56,
          unknown2: 0x2e_a8_fb_98,
          unknown3: 0,
        });
        expect(running?.unknown1.unknown0).toBe(0);
      }
    });

    it("goes inactive with the last finished equal to the target", () => {
      for (const state of [0, 3]) {
        const done = teleportation({ ...into7, state });
        expect(done?.unknown0).toBe(0);
        expect(done?.unknown1).toEqual(done?.unknown2);
        expect(done?.unknown2.unknown0).toBe(1);
      }
    });

    it("sends the idle zeros with none", () => {
      const idle = teleportation();
      expect(idle?.unknown0).toBe(0);
      expect(idle?.unknown1).toEqual(idle?.unknown2);
      expect(idle?.unknown2.unknown0).toBe(0);
    });
  }
);
