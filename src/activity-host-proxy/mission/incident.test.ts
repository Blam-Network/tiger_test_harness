import { describe, expect, it } from "vitest";
import { incidentNames } from "../../content/incident-names";
import { BitBuilder } from "../../test-support/bit-builder";
import { hasPackages } from "../../test-support/build";
import * as incidents from "./incident";
import {
  INCIDENT_GATHER_MATERIAL,
  INCIDENT_PLAYER_SPAWNED,
  INCIDENT_PLAYER_TRIGGER,
  incidentCarriesU32,
  isKillFamilyIncident,
  parseIncident,
} from "./incident";

// Envelope: 4b N, N x 32b names, 9b metadata byte length L, then the
// metadata blob (L x 8 bits, reserved but not necessarily fully used) — all
// one continuous bitstream, padded to a byte only at the very end.
function buildEnvelope(names: readonly number[], metadata: BitBuilder): Buffer {
  const body = new BitBuilder().write(names.length, 4);
  for (const name of names) {
    body.write(name, 32);
  }
  const metadataBytes = Math.ceil(metadata.bitLength / 8);
  body.write(metadataBytes, 9).append(metadata);
  return body.toBuffer();
}

// Common header 808004C9: u32 incident number, i8 3b bias1 submitter kind,
// i64 submitter id.
function buildHeader(
  incidentNumber: number,
  submitterKind: number,
  submitterId: bigint
): BitBuilder {
  return new BitBuilder()
    .write(incidentNumber, 32)
    .write(submitterKind - 1, 3)
    .write(submitterId, 64);
}

describe("isKillFamilyIncident", () => {
  it("is not a kill-family incident for player_trigger alone", () => {
    expect(isKillFamilyIncident([INCIDENT_PLAYER_TRIGGER])).toBe(false);
  });
});

describe("gather_material", () => {
  // 808049FE ahead of the u32 is not fixed-width, so the material sits at
  // whatever bit the toucher leaves it - an odd one here.
  it("finds the material at any bit offset past the header", () => {
    const material = 0x71_26_f3_d0;
    const metadata = buildHeader(7, 1, 0x0000000200000004n)
      .write(0x5, 3)
      .write(material, 32)
      .write(0, 16);
    const payload = buildEnvelope([INCIDENT_GATHER_MATERIAL], metadata);
    // 4-bit count, one name, the 9-bit length
    const bit = 4 + 32 + 9;
    expect(incidentCarriesU32(payload, bit, material)).toBe(true);
    expect(incidentCarriesU32(payload, bit, 0x8c_52_c4_1d)).toBe(false);
  });
});

describe("parseIncident", () => {
  // The client's first Tower incident (Xenia capture): three registry
  // indices, no plain hashes, 48 metadata bytes.
  const SPAWN = Buffer.from(
    "31ad3f568860b6dd997880000000800000021000000010000000406b64157d9e9f786804800000000000000004000000000000000028",
    "hex"
  );

  it.skipIf(!hasPackages())(
    "names the Tower spawn player_spawned, player_resurrected, player_spawned_initial",
    () => {
      const incident = parseIncident(SPAWN, []);
      expect(incident?.names).toEqual([
        INCIDENT_PLAYER_SPAWNED,
        0xeb_1f_ee_95,
        0x84_d5_0d_24,
      ]);
      // 37 bits of names, the hash-list bit, the 9-bit length: 48 bytes left.
      expect(incident?.metadataBit).toBe(47);
      expect(SPAWN.length * 8 - (incident?.metadataBit ?? 0)).toBe(48 * 8 + 1);
    }
  );
});

describe("incident name constants", () => {
  it("keep the hashes the captures showed", () => {
    expect(incidents.INCIDENT_PLAYER_TRIGGER).toBe(0xdd6d986f);
    expect(incidents.INCIDENT_PLAYER_SPAWNED).toBe(0x2766028d);
    expect(incidents.INCIDENT_INVENTORY_ITEM_ADDED).toBe(0xbd1fb418);
    expect(incidents.INCIDENT_SUICIDE).toBe(0x2cf1784f);
  });

  it.skipIf(!hasPackages())("are in the incident registry", () => {
    const registry = new Set(incidentNames());
    const constants = Object.entries(incidents).filter(
      ([name, value]) =>
        name.startsWith("INCIDENT_") && typeof value === "number"
    ) as [string, number][];
    expect(constants.length).toBeGreaterThan(10);
    for (const [name, hash] of constants) {
      // kill_player_to_ai is a specialization sent after the registry name.
      if (name === "INCIDENT_KILL_PLAYER_TO_AI") {
        expect(registry.has(hash), name).toBe(false);
      } else {
        expect(registry.has(hash), name).toBe(true);
      }
    }
  });
});
