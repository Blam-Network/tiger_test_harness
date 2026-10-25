import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v38464_14_02_28_1027_betath;
const betathBuild = () => contentBuildForTest(BUILD);

describe.skipIf(!hasPackages(BUILD))(
  "PS4 pre-alpha activity bundles",
  { timeout: 120_000 },
  () => {
    const readers = () => betathBuild().readers;
    const types = () => betathBuild().bullshcript.ActivityBundleItemType;

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
      expect(hosts).toHaveLength(2145);
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
      expect(actors).toBe(73);
    });

    it("places every nav point", () => {
      const bundles = bundlesOf("cosmo_portal_1");
      const points = bundles.flatMap((bundle) => bundle.navPoints);
      expect(points).toHaveLength(
        bundles
          .flatMap((bundle) => bundle.rows)
          .filter((row) => row.typeId === types().NavPoint).length
      );
      expect(points).toHaveLength(92);
      // phase04.ap_eliminate_fallen01, in the refinery.
      expect(points[0]).toMatchObject({ sliceSet: 1, typeIndex: 88 });
      expect(points[0]?.x).toBeCloseTo(52.66, 2);
      expect(points[0]?.y).toBeCloseTo(-330.58, 2);
      expect(points[0]?.z).toBeCloseTo(6.03, 2);
    });

    it("has TriggerGroup rows and no Machine rows", () => {
      expect(types().Machine).toBeUndefined();
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
