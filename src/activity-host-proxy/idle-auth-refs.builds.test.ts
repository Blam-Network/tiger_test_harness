import { decode } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { buildFolder, e_build } from "../builds";
import { describeEachBuild } from "../test-support/build";
import {
  type RsatCatalog,
  readRsatCatalog,
} from "../test-support/rsat-catalog";
import {
  hasRsatDescriptors,
  rsatDescriptorsPath,
} from "../test-support/rsat-descriptors";
import { k_empty_name_hash } from "../utils/name-hash";

// Per build: the client ref's schema id, the Passenger auth's, and the auths
// whose zero body names a type-0 row but that no scenario of the build
// idles a row with (the three left over).
const BUILDS: Partial<
  Record<e_build, { clientRef: string; left: string[]; passenger: number }>
> = {
  [e_build.v38464_14_02_28_1027_betath]: {
    clientRef: "80800486",
    left: ["808004dd", "8080064f", "808007fa"],
    passenger: 0x80_80_22_25,
  },
  [e_build.v39573_14_04_03_1336_ff]: {
    clientRef: "808004b1",
    left: ["80800506", "80800671", "80800820"],
    passenger: 0x80_80_22_13,
  },
};

// Whether a schema's every-member-zero body writes a client ref: one reached
// through required members only (an absent optional or an empty list holds
// none). The zero ref names type 0, which the client's ref check asserts
// against.
function zeroBodyHasRef(
  catalog: RsatCatalog,
  clientRef: string,
  id: string
): boolean {
  return (catalog.descriptors[id]?.members ?? []).some(
    (member) =>
      !(member.optional || member.array) &&
      member.nested !== null &&
      (member.nested === clientRef ||
        zeroBodyHasRef(catalog, clientRef, member.nested))
  );
}

const hex = (id: number) => (id >>> 0).toString(16);

describeEachBuild(
  "idle sensor auths",
  (build) => {
    const folder = buildFolder(build);
    const expected = BUILDS[build] as NonNullable<(typeof BUILDS)[e_build]>;
    const catalog = readRsatCatalog(rsatDescriptorsPath(build));
    let loaded: ReturnType<typeof loadBuild> | undefined;
    const load = () => {
      loaded ??= loadBuild();
      return loaded;
    };
    const loadBuild = async () => {
      const { defineAhSchemas } = await import(`./versions/${folder}/ah.ts`);
      const { createSensorAuth } = await import(
        `./versions/${folder}/sensor-auth.ts`
      );
      const { ZERO_AUTH } = await import(`./versions/${folder}/zero-auth.ts`);
      const ah = defineAhSchemas();
      return { ah, auth: createSensorAuth(ah), ZERO_AUTH };
    };

    // Every auth schema whose zero body names a type-0 row has its own idle
    // body. The three left over have no row in any of the build's scenarios.
    it("never idle a row on a type-0 ref", async () => {
      const { auth, ZERO_AUTH } = await load();
      const zeroWithRef = Object.keys(ZERO_AUTH)
        .map(Number)
        .filter((id) => zeroBodyHasRef(catalog, expected.clientRef, hex(id)));
      const left = zeroWithRef.filter((id) => {
        const zero = ZERO_AUTH[id];
        const idle = auth.idleAuth(id);
        return (
          zero &&
          idle?.bitCount === zero.bits &&
          idle.bytes.toString("hex") === zero.hex
        );
      });
      expect(left.map(hex)).toEqual(expected.left);
    });

    it("idles a Passenger riding nothing", async () => {
      const { ah, auth, ZERO_AUTH } = await load();
      const idle = auth.idleAuth(expected.passenger);
      if (!idle) {
        throw new Error("no idle Passenger auth");
      }
      expect(idle.bitCount).toBe(ZERO_AUTH[expected.passenger]?.bits);
      const value = decode(ah.PassengerAuth, idle.bytes) as {
        binding: { bundle: number; typeId: number; typeIndex: number };
        cookie: number;
      };
      expect({
        cookie: value.cookie,
        binding: { ...value.binding, bundle: value.binding.bundle >>> 0 },
      }).toEqual({
        cookie: 0,
        binding: { bundle: k_empty_name_hash, typeId: -1, typeIndex: -1 },
      });
    });
  },
  (Object.keys(BUILDS) as e_build[]).filter(hasRsatDescriptors)
);
