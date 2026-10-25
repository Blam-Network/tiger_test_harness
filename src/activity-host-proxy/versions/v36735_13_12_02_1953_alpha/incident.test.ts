import { beforeAll, expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild } from "../../../test-support/build";

// MSB-first bit writer for building an incident body.
function bits(fields: readonly (readonly [number | bigint, number])[]): Buffer {
  const out: number[] = [];
  for (const [value, width] of fields) {
    const v = BigInt(value);
    for (let i = width - 1; i >= 0; i--) {
      out.push(Number((v >> BigInt(i)) & 1n));
    }
  }
  const buffer = Buffer.alloc(Math.ceil(out.length / 8));
  out.forEach((bit, i) => {
    if (bit) {
      buffer[i >> 3] |= 0x80 >> (i % 8);
    }
  });
  return buffer;
}

// The alpha's class 18 incidents name themselves by a 4-bit count and u32 name
// hashes, not by incident registry index.
describeBuild(e_build.v36735_13_12_02_1953_alpha, "alpha incidents", () => {
  let incident: typeof import("../../mission/incident");

  beforeAll(async () => {
    incident = await import("../../mission/incident");
  });

  // The client's player_spawned from a venus_chapter_2 run.
  const SPAWNED = Buffer.from(
    "12766028d1b80001a792000000020000000b000000004000000161c72459758a55ee83c3b39006000000000000000004000000000000000102393b8a00",
    "hex"
  );

  it("names the live player_spawned", () => {
    const parsed = incident.parseIncident(SPAWNED, []);
    expect(SPAWNED).toHaveLength(61);
    expect(parsed?.names).toEqual([incident.INCIDENT_PLAYER_SPAWNED]);
    expect(incident.incidentName(parsed?.nameHash ?? 0)).toBe("player_spawned");
    // 4-bit count, one name, the 9-bit metadata length
    expect(parsed?.metadataBit).toBe(45);
  });

  // venus_chapter_2's first warp gate kill: any_kill and kill, then the
  // metadata.
  it("names a kill by its hashes", () => {
    const kill = Buffer.from(
      "2324e9a2031d3123a4e80001cf220000000200000001c3dfd0f9566170f37351f03331d5d0f9566170f37351f03331d5effdc71fac7007850040000011020000",
      "hex"
    );
    const parsed = incident.parseIncident(kill, []);
    expect(parsed?.nameHash).toBe(incident.INCIDENT_ANY_KILL);
    expect(parsed?.names).toHaveLength(2);
    expect(parsed?.metadataBit).toBe(77);
    expect(incident.isKillFamilyIncident(parsed?.names ?? [])).toBe(true);
  });

  it("finds a player_trigger's row ref in the metadata", () => {
    const bundle = 0xde_ad_be_ef;
    const payload = bits([
      [1, 4],
      [incident.INCIDENT_PLAYER_TRIGGER, 32],
      [12, 9],
      // the common header: incident number, submitter kind and id
      [0x34_f2, 32],
      [0, 3],
      [0x2_0000_0001n, 64],
      [0, 8],
      [bundle, 32],
      [29 + 1, 6],
      [0x8000 + 62, 16],
    ]);
    const parsed = incident.parseIncident(payload, [bundle]);
    expect(parsed?.nameHash).toBe(incident.INCIDENT_PLAYER_TRIGGER);
    expect(parsed?.refs).toEqual([{ bundle, typeId: 29, typeIndex: 62 }]);
  });

  it("reads nothing from a body too short for its names", () => {
    expect(incident.parseIncident(Buffer.alloc(0), [])).toBeUndefined();
    expect(incident.parseIncident(bits([[3, 4]]), [])).toBeUndefined();
  });
});
