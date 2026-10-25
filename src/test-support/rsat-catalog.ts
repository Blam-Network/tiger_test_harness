import { readFileSync } from "node:fs";
import {
  BitReader,
  BitWriter,
  decode,
  encode,
  type RsatSchema,
} from "@blamnetwork/rsat";

// A build's RSAT schema catalog, as scripts/rsat-descriptors.py dumps it from
// the client, and a codec that writes values straight from its member lists.
// The tests hold a build's hand-written schemas to it: the catalog writes a
// value, the schema must read it back member for member and write the same
// bits.

interface CatalogMember {
  array?: { countMember: number; lengthBits: number; max: number };
  bias?: number;
  bits?: number;
  kind: number;
  max?: number;
  min?: number;
  nested: string | null;
  optional: boolean;
  quantized?: boolean;
}

interface CatalogDescriptor {
  address: string;
  checksum: string;
  members?: CatalogMember[];
}

export interface RsatCatalog {
  descriptors: Record<string, CatalogDescriptor>;
}

export function readRsatCatalog(path: string): RsatCatalog {
  return JSON.parse(readFileSync(path, "utf8")) as RsatCatalog;
}

const NESTED = 1;
const BOOL = 2;
const U64_KINDS = new Set([6, 10]);
const INT_KINDS = new Set([3, 4, 5, 7, 8, 9]);
const REAL32 = 11;

// A value laid out like the catalog: a struct is its members in order (count
// members left out), an array member its elements. Quantized floats hold the
// wire value.
export type CatalogValue =
  | bigint
  | boolean
  | number
  | undefined
  | { struct: CatalogValue[] }
  | { list: CatalogValue[] };

export class UnsupportedKind extends Error {}

function hex(id: number): string {
  return (id >>> 0).toString(16).padStart(8, "0");
}

function descriptor(catalog: RsatCatalog, id: string): CatalogDescriptor {
  const found = catalog.descriptors[id];
  if (!found?.members) {
    throw new UnsupportedKind(`${id} has no definition`);
  }
  return found;
}

// The members a value lists: an array's count member travels with the array.
function valueMembers(catalog: RsatCatalog, id: string): CatalogMember[] {
  const members = descriptor(catalog, id).members ?? [];
  const counts = new Set(
    members.flatMap((m) => (m.array ? [m.array.countMember] : []))
  );
  return members.filter((_, i) => !counts.has(i));
}

// An array container's element: its first member (all of them are alike).
function element(catalog: RsatCatalog, member: CatalogMember): CatalogMember {
  const container = descriptor(catalog, member.nested ?? "");
  const first = container.members?.[0];
  if (!first) {
    throw new UnsupportedKind(`${member.nested} has no element`);
  }
  return first;
}

function supported(member: CatalogMember): boolean {
  return (
    member.kind === NESTED ||
    member.kind === BOOL ||
    member.kind === REAL32 ||
    INT_KINDS.has(member.kind) ||
    U64_KINDS.has(member.kind)
  );
}

// Every member set, with numbers that differ from member to member (present),
// or every optional absent, every array empty and every number 0 (zero).
// Optional members and array elements the codec cannot write are left out.
export function sampleValue(
  catalog: RsatCatalog,
  id: string,
  mode: "present" | "zero"
): CatalogValue {
  let seed = 0;
  const one = (member: CatalogMember): CatalogValue => {
    if (!supported(member)) {
      throw new UnsupportedKind(`kind ${member.kind}`);
    }
    seed += 1;
    if (member.kind === NESTED) {
      return struct(member.nested ?? "");
    }
    if (member.kind === BOOL) {
      return mode === "present" && seed % 2 === 1;
    }
    if (member.kind === REAL32) {
      if (member.quantized) {
        return mode === "present" && seed % 2 === 1
          ? 2 ** (member.bits ?? 0) - 1
          : 0;
      }
      return mode === "present" ? seed + 0.5 : 0;
    }
    const bits = member.bits ?? 0;
    const bias = member.bias ?? 0;
    if (U64_KINDS.has(member.kind)) {
      const wire =
        mode === "present"
          ? (BigInt(seed) * 0x9e_37_79_b9_7f_4a_7c_15n) % 2n ** BigInt(bits)
          : BigInt(bias);
      return wire - BigInt(bias);
    }
    // Wires stay below 2^31, so a u32 reads back as the same number.
    const wire =
      mode === "present"
        ? ((seed * 0x9e_37_79_b1) >>> 0) % 2 ** Math.min(bits, 31)
        : bias;
    return wire - bias;
  };
  // What the codec cannot write: the fallback, or the error for a required
  // member.
  const orElse = <T>(make: () => T, fallback: () => T): T => {
    try {
      return make();
    } catch (error) {
      if (error instanceof UnsupportedKind) {
        return fallback();
      }
      throw error;
    }
  };
  const slot = (member: CatalogMember): CatalogValue => {
    if (member.optional && mode === "zero") {
      return;
    }
    if (member.array) {
      const array = member.array;
      if (mode === "zero") {
        return { list: [] };
      }
      return orElse<CatalogValue>(
        () => {
          const of = element(catalog, member);
          const count = Math.min(2, array.max);
          return { list: Array.from({ length: count }, () => one(of)) };
        },
        () => ({ list: [] })
      );
    }
    if (member.optional) {
      return orElse<CatalogValue>(
        () => one(member),
        () => undefined
      );
    }
    return one(member);
  };
  const struct = (nestedId: string): CatalogValue => ({
    struct: valueMembers(catalog, nestedId).map(slot),
  });
  return struct(id);
}

function write(
  catalog: RsatCatalog,
  member: CatalogMember,
  value: CatalogValue,
  bw: BitWriter
): void {
  if (member.kind === NESTED) {
    writeStruct(catalog, member.nested ?? "", value, bw);
  } else if (member.kind === BOOL) {
    bw.writeBit(value === true);
  } else if (member.kind === REAL32) {
    if (member.quantized) {
      bw.write(value as number, member.bits ?? 0);
    } else {
      const scratch = Buffer.alloc(4);
      scratch.writeFloatBE(value as number);
      bw.write(scratch.readUInt32BE(), 32);
    }
  } else if (U64_KINDS.has(member.kind)) {
    bw.write((value as bigint) + BigInt(member.bias ?? 0), member.bits ?? 64);
  } else if (INT_KINDS.has(member.kind)) {
    bw.write((value as number) + (member.bias ?? 0), member.bits ?? 0);
  } else {
    throw new UnsupportedKind(`kind ${member.kind}`);
  }
}

function writeStruct(
  catalog: RsatCatalog,
  id: string,
  value: CatalogValue,
  bw: BitWriter
): void {
  const members = valueMembers(catalog, id);
  const values = (value as { struct: CatalogValue[] }).struct;
  members.forEach((member, i) => {
    const v = values[i];
    if (member.optional) {
      bw.writeBit(v !== undefined);
      if (v === undefined) {
        return;
      }
    }
    if (member.array) {
      const list = (v as { list: CatalogValue[] }).list;
      bw.write(list.length, member.array.lengthBits);
      const of = element(catalog, member);
      for (const item of list) {
        write(catalog, of, item, bw);
      }
      return;
    }
    write(catalog, member, v, bw);
  });
}

// The catalog's encoding of a value, and its length in bits.
export function catalogEncode(
  catalog: RsatCatalog,
  id: number,
  value: CatalogValue
): { bits: number; bytes: Buffer } {
  const bw = new BitWriter(1 << 20);
  writeStruct(catalog, hex(id), value, bw);
  const bits = bw.bitCount;
  return { bits, bytes: bw.finish() };
}

const UNKNOWN_FIELD = /^unknown(\d+)$/;

function same(a: unknown, b: unknown): boolean {
  return typeof a === typeof b && a === b;
}

// A decoded schema value against the catalog value it was read from: keys in
// member order, unknownN named by its position, the same numbers. Each
// difference is one line in `out`.
function compareValue(
  catalog: RsatCatalog,
  member: CatalogMember,
  decoded: unknown,
  value: CatalogValue,
  path: string,
  out: string[]
): void {
  if (value === undefined) {
    if (decoded !== undefined) {
      out.push(`${path}: present, the catalog has it absent`);
    }
  } else if (typeof value === "object" && "struct" in value) {
    compareStruct(catalog, member.nested ?? "", decoded, value, path, out);
  } else if (typeof value === "object" && "list" in value) {
    const of = element(catalog, member);
    const items = [...(decoded as Iterable<unknown>)];
    if (items.length !== value.list.length) {
      out.push(
        `${path}: ${items.length} entries, the catalog ${value.list.length}`
      );
      return;
    }
    value.list.forEach((item, i) => {
      compareValue(catalog, of, items[i], item, `${path}[${i}]`, out);
    });
  } else if (member.kind === REAL32 && member.quantized) {
    if (typeof decoded !== "number") {
      out.push(`${path}: not a number`);
    }
  } else {
    const want = member.kind === REAL32 ? Math.fround(value as number) : value;
    if (!same(decoded, want)) {
      out.push(`${path}: ${String(decoded)}, the catalog ${String(want)}`);
    }
  }
}

function compareStruct(
  catalog: RsatCatalog,
  id: string,
  decoded: unknown,
  value: { struct: CatalogValue[] },
  path: string,
  out: string[]
): void {
  const members = valueMembers(catalog, id);
  const record = decoded as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === members.length) {
    keys.forEach((key, i) => {
      const named = UNKNOWN_FIELD.exec(key);
      if (named && Number(named[1]) !== i) {
        out.push(`${path}.${key}: member ${i}`);
      }
      const member = members[i] as CatalogMember;
      compareValue(
        catalog,
        member,
        record[key],
        value.struct[i],
        `${path}.${key}`,
        out
      );
    });
    return;
  }
  // A one-field schema over a run of identical members (repeat, options
  // array): the field holds one entry per member.
  const [only] = keys;
  if (keys.length !== 1) {
    out.push(
      `${path} (${id}): ${keys.length} fields, the catalog ${members.length}`
    );
    return;
  }
  const items = [...(record[only as string] as Iterable<unknown>)];
  if (items.length !== members.length) {
    out.push(
      `${path}.${only} (${id}): ${items.length} entries, the catalog ${members.length}`
    );
    return;
  }
  members.forEach((member, i) => {
    compareValue(
      catalog,
      member,
      items[i],
      value.struct[i],
      `${path}.${only}[${i}]`,
      out
    );
  });
}

// sampleValue of the schema with this hash.
export function sampleSchema(
  catalog: RsatCatalog,
  hash: number,
  mode: "present" | "zero"
): CatalogValue {
  return sampleValue(catalog, hex(hash), mode);
}

// Where the schema does not read the catalog's bits of `value` member for
// member, or does not write them back unchanged; empty when it does.
export function schemaMismatches<T extends Record<string, unknown>>(
  catalog: RsatCatalog,
  schema: RsatSchema<T>,
  value: CatalogValue
): string[] {
  const id = hex(schema.hash);
  const { bits, bytes } = catalogEncode(catalog, schema.hash, value);
  const out: string[] = [];
  const br = new BitReader(bytes);
  const decoded = schema.decode(br);
  if (br.bitPos !== bits) {
    out.push(`${id}: read ${br.bitPos} bits, the catalog wrote ${bits}`);
  }
  const bw = new BitWriter(1 << 20);
  schema.encode(bw, decoded);
  const written = bw.bitCount;
  if (written !== bits || !bw.finish().equals(bytes)) {
    out.push(`${id}: writes other bits back (${written} of ${bits})`);
  }
  compareStruct(
    catalog,
    id,
    decoded,
    value as { struct: CatalogValue[] },
    id,
    out
  );
  return out;
}

export interface RoundTrip {
  again: Uint8Array;
  back: unknown;
  bytes: Uint8Array;
  value: unknown;
}

// decode(encode(value)) must give the value back (absent optionals are
// undefined) and re-encode to the same bytes.
export function roundTrip<T extends Record<string, unknown>>(
  schema: RsatSchema<T>,
  value: T
) {
  return (): RoundTrip => {
    const bytes = encode(schema, value);
    const back = decode(schema, bytes);
    return { value, back, bytes, again: encode(schema, back) };
  };
}
