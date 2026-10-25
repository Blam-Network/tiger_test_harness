import { decode, type RsatSchema } from "@blamnetwork/rsat";
import { expect, it } from "vitest";
import { e_build } from "../../../builds";
import {
  type CatalogValue,
  catalogEncode,
  sampleSchema,
  schemaMismatches,
  UnsupportedKind,
} from "../../../test-support/rsat-catalog";
import { describeWithRsatDescriptors } from "../../../test-support/rsat-descriptors";
import { defineAhSchemas } from "./ah";
import { ZERO_AUTH } from "./zero-auth";

const ah = defineAhSchemas();

type AnySchema = RsatSchema<Record<string, unknown>>;

function schemas(): AnySchema[] {
  return (Object.values(ah) as unknown[]).filter(
    (value): value is AnySchema =>
      typeof value === "object" && value !== null && "hash" in value
  );
}

describeWithRsatDescriptors(
  e_build.v40662_14_05_19_1414_pubalpha,
  "activity host schemas against the eboot's catalog",
  (catalog) => {
    // The squad auth's roster is 80804252 (i32 cells), the type the squad
    // sense's tally uses too.
    it("lays out the squad auth as the catalog does", () => {
      expect(Object.keys(ah.SquadAuth.fields)).toEqual([
        "ref0",
        "ref1",
        "temperaments",
        "roster",
        "unknown4",
        "epoch",
        "unknown6",
        "bindingGeneration",
        "unknown8",
        "unknown9",
        "task",
        "killPolicy",
        "carrierCargo",
      ]);
      expect(ah.SquadCells.hash).toBe(0x80_80_42_52);
      for (const mode of ["present", "zero"] as const) {
        expect(
          schemaMismatches(
            catalog,
            ah.SquadAuth,
            sampleSchema(catalog, 0x80_80_07_1e, mode)
          )
        ).toEqual([]);
        expect(
          schemaMismatches(
            catalog,
            ah.SquadCells,
            sampleSchema(catalog, 0x80_80_42_52, mode)
          )
        ).toEqual([]);
      }
    });

    it("round-trips roster cells past the i16 range", () => {
      const cells = [70_000, -70_000];
      const { bytes } = catalogEncode(catalog, 0x80_80_42_52, {
        struct: [{ list: cells }],
      });
      expect(decode(ah.SquadCells, bytes).cells).toEqual(cells);
    });

    it("matches the catalog for every schema it defines", () => {
      const unsupported: string[] = [];
      for (const schema of schemas()) {
        let present: CatalogValue;
        try {
          present = sampleSchema(catalog, schema.hash, "present");
        } catch (error) {
          if (!(error instanceof UnsupportedKind)) {
            throw error;
          }
          unsupported.push((schema.hash >>> 0).toString(16));
          continue;
        }
        expect(schemaMismatches(catalog, schema, present)).toEqual([]);
        expect(
          schemaMismatches(
            catalog,
            schema,
            sampleSchema(catalog, schema.hash, "zero")
          )
        ).toEqual([]);
      }
      // A required member of a kind the codec does not write: 80800D17's
      // kind-34 member and PlayerIdentity's kind-35 one (an i64 stand-in), with
      // PlayerAuth holding it.
      expect(unsupported).toEqual(["80800d17", "80800646", "808022a5"]);
    });

    it("has the catalog's zero auth bodies", () => {
      const unsupported: string[] = [];
      for (const [id, body] of Object.entries(ZERO_AUTH)) {
        let zero: CatalogValue;
        try {
          zero = sampleSchema(catalog, Number(id), "zero");
        } catch (error) {
          if (!(error instanceof UnsupportedKind)) {
            throw error;
          }
          unsupported.push((Number(id) >>> 0).toString(16));
          continue;
        }
        const { bits, bytes } = catalogEncode(catalog, Number(id), zero);
        expect(body, (Number(id) >>> 0).toString(16)).toEqual({
          bits,
          hex: bytes.toString("hex"),
        });
      }
      expect(unsupported).toEqual(["8080065c", "808022a5"]);
    });
  }
);
