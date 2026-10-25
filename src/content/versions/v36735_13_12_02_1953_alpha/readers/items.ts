// Item definitions, read off the disc packages. The item table's row order is
// the item definition index the wire uses. Names and tiers come from the
// client-side item display table (client globals slot "item_displays") and the
// string lists beside it.
import type { ItemRecord } from "../../../model/investment";
import type { ContentReaders } from "../../content-build";
import type { InvestmentGlobals } from "./investment-globals";
import type { Packages } from "./package-set";

const NO_STRING = 0xff_ff;

// A display's tier code is this plus the item definition's tier.
const TIER_CODE_BASE = 21;

// u8 / u16 "none" (0xFF / 0xFFFF) as the signed -1 the wire fields use.
const signed8 = (value: number) => (value > 0x7f ? value - 0x1_00 : value);
const signed16 = (value: number) =>
  value > 0x7f_ff ? value - 0x1_00_00 : value;

interface StringList {
  keys: number[];
  strings: string[];
}

export function itemReaders(
  packages: () => Packages,
  investment: InvestmentGlobals
): Pick<ContentReaders, "itemDefinitions" | "itemName"> {
  let displayTable: any;
  let listTable: any;
  const lists = new Map<number, StringList | null>();
  // Several indices share a display tag.
  const displays = new Map<number, any>();

  function displayOf(defIndex: number): any {
    displayTable ??= investment.clientTable(
      "item_displays",
      "s_item_display_table"
    );
    const row = displayTable.displays[defIndex];
    if (!row) {
      return;
    }
    if (!displays.has(row.tag)) {
      displays.set(row.tag, investment.readTag(row.tag, "s_item_display"));
    }
    return displays.get(row.tag);
  }

  // One string list: its sorted keys and the English bank (bank 0).
  function stringList(index: number): StringList | null {
    const cached = lists.get(index);
    if (cached !== undefined) {
      return cached;
    }
    const { g, set } = packages();
    listTable ??= investment.clientTable("string_lists", "s_string_list_table");
    let list: StringList | null = null;
    const row = listTable.lists[index];
    const data: Buffer | undefined = row && set.try_read_tag(row.tag);
    if (data) {
      const definition = g.read_definition(data, g.s_string_list);
      const bank: Buffer | undefined = set.try_read_tag(definition.banks[0]);
      if (bank) {
        list = {
          keys: definition.keys.map((key: { key: number }) => key.key),
          strings: g.read_string_bank(bank),
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

  function itemRecordOf(def: any, defIndex: number): ItemRecord {
    const { equipable, scaling } = def;
    const stats: any[] = def.stats
      ? def.stats.stats.slice(0, def.stats.stat_count)
      : [];
    return {
      bucket: def.bucket,
      equipSlot: equipable ? equipable.equip_slot : null,
      sandboxPattern: equipable ? signed8(equipable.pattern) : -1,
      artArrangement: equipable ? signed16(equipable.art_arrangement) : -1,
      instanced: def.instanced !== 0,
      // The alpha's equipable block names no class.
      classFlag: null,
      tier: displayOf(defIndex).tier_code - TIER_CODE_BASE,
      // The alpha scales by a bias and a value instead (scaling).
      level: 0,
      quality: 0,
      scaling: scaling
        ? {
            bias: scaling.bias,
            values: scaling.slots
              .slice(0, scaling.slot_count)
              .map((slot: { key: number; value: number }) => [
                slot.key,
                slot.value,
              ]),
          }
        : undefined,
      maxStack: def.max_stack,
      gridIndex: def.talent_grid ? def.talent_grid.grid_index : null,
      stats: stats.map((stat) => [stat.key, stat.value] as const),
    };
  }

  return {
    itemDefinitions() {
      const { g, set } = packages();
      return g
        .item_definition_tags(set)
        .map((tag: number, defIndex: number) =>
          itemRecordOf(
            g.read_definition(set.read_tag(tag), g.s_item_definition),
            defIndex
          )
        );
    },

    itemName(defIndex) {
      const display = displayOf(defIndex);
      return display ? stringRef(display.name) : "";
    },
  };
}
