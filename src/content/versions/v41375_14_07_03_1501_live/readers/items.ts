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

// A string bank (class 808008BE): +0x24 string count, +0x28 rel -> header,
// combos {i32 rel parts, u32 count} from header+16; a part is 20 bytes
// {_, u32 rel data (from +4), u32 hash, u16 bytes, u16 chars, u16 cipher,
// u16 flags}, each byte plus the cipher except UTF-8 lead bytes ("Façade of
// the Hezen Lords" is stored C3 88 with cipher 1F).
function decodeBank(bank: Buffer): string[] {
  const strings: string[] = [];
  const count = bank.readUInt32BE(0x24);
  const header = 0x28 + bank.readUInt32BE(0x28);
  for (let s = 0; s < count; s++) {
    const combo = header + 16 + s * 8;
    if (combo + 8 > bank.length) {
      break;
    }
    let part = combo + bank.readInt32BE(combo);
    const parts = bank.readUInt32BE(combo + 4);
    const bytes: number[] = [];
    for (let k = 0; k < parts && part + 20 <= bank.length; k++, part += 20) {
      const data = part + 4 + bank.readUInt32BE(part + 4);
      const length = bank.readUInt16BE(part + 12);
      const cipher = bank.readUInt16BE(part + 16) & 0xff;
      for (let i = data; i < data + length && i < bank.length; i++) {
        bytes.push(bank[i] >= 0xc0 ? bank[i] : (bank[i] + cipher) & 0xff);
      }
    }
    strings.push(Buffer.from(bytes).toString("utf8"));
  }
  return strings;
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
