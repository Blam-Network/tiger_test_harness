import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { describe, expect, it } from "vitest";
import { e_build } from "../../../../builds";
import { hasPackages } from "../../../../test-support/build";
import { contentBuildForTest } from "../../../../test-support/content-build";

const BUILD = e_build.v40662_14_05_19_1414_pubalpha;
const pubalphaBuild = () => contentBuildForTest(BUILD);

describe.skipIf(!hasPackages(BUILD))("PS4 Alpha Trial activity bundles", () => {
  const readers = () => pubalphaBuild().readers;
  const types = () => pubalphaBuild().bullshcript.ActivityBundleItemType;

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
    expect(scenario?.bubbles).toHaveLength(22);
    expect(readers().activityScenario("no_such_activity")).toBeUndefined();
  });

  it("joins each sensor host to its bundle row by the split row reference", () => {
    const bundles = bundlesOf("cosmo_portal_1");
    const hosts = bundles.flatMap((bundle) =>
      bundle.hosts.map((host) => ({ bundle, host }))
    );
    expect(hosts.length).toBeGreaterThan(2000);
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
            other.typeId === types().Squad && other.index === host.actor?.squad
        );
        expect(host.actor.cell).toBeLessThan(squad?.squadMembers?.length ?? 0);
      }
    }
    expect(actors).toBe(58);
  });

  it("places the nav points", () => {
    const points = bundlesOf("cosmo_portal_1").flatMap(
      (bundle) => bundle.navPoints
    );
    expect(points).toHaveLength(171);
    expect(points.every((p) => [p.x, p.y, p.z].every(Number.isFinite))).toBe(
      true
    );
    expect(points.some((p) => Math.abs(p.x) > 1)).toBe(true);
  });

  it("has TriggerGroup and Machine rows", () => {
    const tower = bundlesOf("city_tower_default1");
    expect(
      tower.flatMap((b) => b.hosts).filter((h) => h.typeId === types().Machine)
    ).toHaveLength(71);
    const portal = bundlesOf("cosmo_portal_1");
    expect(
      portal
        .flatMap((b) => b.rows)
        .filter((row) => row.typeId === types().TriggerGroup)
        .map((row) => row.name)
    ).toEqual(["t_pit_kill_volume"]);
  });
});
