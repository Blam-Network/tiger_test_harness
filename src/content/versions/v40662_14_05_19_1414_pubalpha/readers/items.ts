// Item definitions, read off the disc packages. The item table's row order is
// the item definition index the wire uses. Names come from the client-side
// item display table through the investment localized strings, both under the
// investment globals root.
import type { ItemRecord } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { Packages } from "./package-set";

const NO_STRING = 0xff_ff;

const UNLOCK_OP_FLAG_SET = 1;

// u8 / u16 "none" (0xFF / 0xFFFF) as the signed -1 the wire fields use.
const signed8 = (value: number) => (value > 0x7f ? value - 0x1_00 : value);
const signed16 = (value: number) =>
  value > 0x7f_ff ? value - 0x1_00_00 : value;

// An equip unlock made of exactly one class flag names the class: its flag.
function classFlagOf(equipable: any): number | null {
  if (!equipable || equipable.unlock.length !== 1) {
    return null;
  }
  const { tokens } = equipable.unlock[0];
  if (tokens.length !== 1 || tokens[0].op !== UNLOCK_OP_FLAG_SET) {
    return null;
  }
  return tokens[0].operand;
}

function itemRecordOf(def: any): ItemRecord {
  const { equipable, level } = def;
  const stats: any[] = def.stats?.stats ?? [];
  return {
    bucket: def.bucket,
    equipSlot: equipable ? equipable.equip_slot : null,
    sandboxPattern: equipable ? signed8(equipable.pattern) : -1,
    artArrangement: equipable ? signed16(equipable.art_arrangement) : -1,
    instanced: def.instanced !== 0,
    classFlag: classFlagOf(equipable),
    tier: signed8(def.tier),
    level: level ? level.level : 0,
    quality: level ? level.unknown08 : 0,
    maxStack: def.max_stack,
    gridIndex: def.talent_grid ? def.talent_grid.grid_index : null,
    stats: equipable
      ? stats.map((stat) => [stat.key, stat.value] as const)
      : [],
  };
}

interface StringList {
  keys: number[];
  strings: string[];
}

// A string bank (class 808008BE). 64-bit blocks ({u64 count, i64 offset},
// the offset relative to itself): +0x18 the characters, UTF-16LE, and +0x28
// one block of parts per string, in key order. A part is 0x20 bytes {u64,
// u32 hash, u32, i64 start, i64 end}, start and end relative to themselves
// into the characters; a part with a hash and no characters is an inline
// token. No cipher.
const BANK_STRINGS = 0x28;
const BLOCK_FIELD_SIZE = 16;
const BLOCK_HEADER_SIZE = 16;
const BANK_PART_SIZE = 0x20;
const BANK_PART_START = 0x10;
const BANK_PART_END = 0x18;

const relative = (bank: Buffer, at: number) =>
  at + Number(bank.readBigInt64LE(at));

function blockElements(bank: Buffer, field: number, size: number): number[] {
  const count = Number(bank.readBigInt64LE(field));
  if (count === 0) {
    return [];
  }
  const first = relative(bank, field + 8) + BLOCK_HEADER_SIZE;
  return Array.from({ length: count }, (_, i) => first + i * size);
}

function decodeBank(bank: Buffer): string[] {
  return blockElements(bank, BANK_STRINGS, BLOCK_FIELD_SIZE).map((parts) =>
    blockElements(bank, parts, BANK_PART_SIZE)
      .map((part) =>
        bank
          .subarray(
            relative(bank, part + BANK_PART_START),
            relative(bank, part + BANK_PART_END)
          )
          .toString("utf16le")
      )
      .join("")
  );
}

export function itemReaders(
  packages: () => Packages,
  investment: InvestmentGlobals
): Pick<ContentReaders, "itemDefinitions" | "itemName"> {
  let displayTable: any;
  let listTable: any;
  const lists = new Map<number, StringList | null>();

  // One localized strings tag: its sorted keys and the English bank (bank 0).
  function stringList(index: number): StringList | null {
    const cached = lists.get(index);
    if (cached !== undefined) {
      return cached;
    }
    const { g, set } = packages();
    listTable ??= investment.clientTable(
      "localized_strings",
      "s_localized_strings_table"
    );
    let list: StringList | null = null;
    const row = listTable.lists[index];
    const data: Buffer | undefined = row && set.try_read_tag(row.tag);
    if (data) {
      const definition = g.read_definition(data, g.s_localized_strings);
      const bank: Buffer | undefined = set.try_read_tag(definition.banks[0]);
      if (bank) {
        list = {
          keys: definition.keys.map((key: { hash: number }) => key.hash),
          strings: decodeBank(bank),
        };
      }
    }
    lists.set(index, list);
    return list;
  }

  function stringRef(ref: { key: number; list: number }): string {
    if (ref.list === NO_STRING) {
      return "";
    }
    const list = stringList(ref.list);
    const position = list?.keys.indexOf(ref.key) ?? -1;
    return position < 0 ? "" : (list?.strings[position] ?? "").trim();
  }

  return {
    itemDefinitions() {
      const { g, set } = packages();
      return g
        .item_definition_tags(set)
        .map((tag: number) =>
          itemRecordOf(
            g.read_definition(set.read_tag(tag), g.s_item_definition)
          )
        );
    },

    itemName(defIndex) {
      displayTable ??= investment.clientTable(
        "item_displays",
        "s_item_display_table"
      );
      const row = displayTable.displays[defIndex];
      const { g, set } = packages();
      const data: Buffer | undefined = row && set.try_read_tag(row.tag);
      return data
        ? stringRef(g.read_definition(data, g.s_item_display).name)
        : "";
    },
  };
}
