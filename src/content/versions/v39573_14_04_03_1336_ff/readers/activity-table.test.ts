import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v39573_14_04_03_1336_ff;
const ffBuild = () => contentBuildForTest(BUILD);

describe.skipIf(!hasPackages(BUILD))(
  "PS4 ff activity bundles",
  { timeout: 120_000 },
  () => {
    const readers = () => ffBuild().readers;
    const types = () => ffBuild().bullshcript.ActivityBundleItemType;

    const bundlesOf = (activity: string) => {
      const scenario = readers().activityScenario(activity);
      const tags = new Set(
        scenario?.bubbles
          .flat()
          .flatMap(({ blueprints }) => [
            ...blueprints.global,
            ...blueprints.authoritative,
            ...blueprints.private,
          ])
      );
      return [...tags].map((tag) => readers().activityBundle(tag));
    };

    it("finds a scenario by its activity's name", () => {
      const scenario = readers().activityScenario("cosmo_portal_1");
      expect(scenario?.familyChecksum).toBe(fnv1("cosmo_portal_1"));
      // One state per bubble.
      expect(scenario?.bubbles).toHaveLength(19);
      expect(scenario?.bubbles.every((states) => states.length === 1)).toBe(
        true
      );
      expect(readers().activityScenario("no_such_activity")).toBeUndefined();
    });

    it("joins each sensor host to its bundle row by the split row reference", () => {
      const bundles = bundlesOf("cosmo_portal_1");
      const hosts = bundles.flatMap((bundle) =>
        bundle.hosts.map((host) => ({ bundle, host }))
      );
      expect(hosts).toHaveLength(2237);
      for (const { bundle, host } of hosts) {
        expect(bundle.rows[host.index]?.typeId).toBe(host.typeId);
      }
    });

    it("puts each named actor in a cell of its squad", () => {
      const bundles = bundlesOf("cosmo_portal_1");
      let actors = 0;
      for (const bundle of bundles) {
        for (const host of bundle.hosts) {
          if (!host.actor) {
            continue;
          }
          actors++;
          const squad = bundle.hosts.find(
            (other) =>
              other.typeId === types().Squad &&
              other.index === host.actor?.squad
          );
          expect(host.actor.cell).toBeLessThan(
            squad?.squadMembers?.length ?? 0
          );
        }
      }
      expect(actors).toBe(61);
    });

    it("places every nav point", () => {
      const bundles = bundlesOf("cosmo_portal_1");
      const points = bundles.flatMap((bundle) => bundle.navPoints);
      expect(points).toHaveLength(
        bundles
          .flatMap((bundle) => bundle.rows)
          .filter((row) => row.typeId === types().NavPoint).length
      );
      expect(points).toHaveLength(176);
      // phase00.obj_s1_phase00_m1._nav_point, in the rocketyard.
      expect(points[0]).toMatchObject({ sliceSet: 17, typeIndex: 52 });
      expect(points[0]?.x).toBeCloseTo(181.69, 2);
      expect(points[0]?.y).toBeCloseTo(-287.1, 2);
      expect(points[0]?.z).toBeCloseTo(5.69, 2);
    });

    it("has TriggerGroup rows and Machine rows", () => {
      expect(types().Machine).toBe(40);
      const portal = bundlesOf("cosmo_portal_1");
      expect(
        portal
          .flatMap((b) => b.rows)
          .filter((row) => row.typeId === types().TriggerGroup)
          .map((row) => row.name)
      ).toEqual([
        "t_kill_volume_tripwire01",
        "t_kill_volume_tripwire02",
        "t_kill_volume_tripwire03",
        "t_pit_kill_volume",
      ]);
    });
  }
);
