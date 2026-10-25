// The ability table, read off the disc packages on first use (the client's
// own table). A subclass's gear block names its abilities by index into it.
import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { contentBuild } from "./versions";

// The names cracked so far; the table holds only hashes. The ability at index
// 14 (0x93136377) matches none of them: true name unknown.
const KNOWN_ABILITY_NAMES = [
  "ability_blink",
  "ability_double_jump",
  "ability_fist_of_havoc",
  "ability_ghost_gun",
  "ability_glide",
  "ability_titan_melee",
  "ability_hunter_melee",
  "ability_lift",
  "ability_nova_bomb",
  "ability_radiance",
  "ability_arc_blade",
  "ability_sprint",
  "ability_ward_of_dawn",
  "ability_warlock_melee",
  "ability_bolt_arc",
  "ability_bolt_thermal",
  "ability_bolt_void",
  "ability_field_arc",
  "ability_field_thermal",
  "ability_field_void",
  "ability_flare_arc",
  "ability_flare_thermal",
  "ability_flare_void",
  "ability_flux_arc",
  "ability_flux_thermal",
  "ability_flux_void",
  "ability_prox_arc",
  "ability_prox_thermal",
  "ability_prox_void",
  "ability_pulse_arc",
  "ability_pulse_thermal",
  "ability_pulse_void",
];

let hashes: readonly number[] | undefined;
let names: readonly string[] | undefined;

// Every ability's name hash, by ability index.
export function abilityNameHashes(): readonly number[] {
  if (!hashes) {
    hashes = contentBuild()
      .readers.abilities()
      .map((ability) => ability.nameHash);
  }
  return hashes ?? [];
}

// Each ability's name by index, "unknown" where no known name hashes to the
// table's.
export function abilityNames(): readonly string[] {
  names ??= abilityNameHashes().map(
    (hash) =>
      KNOWN_ABILITY_NAMES.find((name) => fnv1(name) === hash) ?? "unknown"
  );
  return names;
}
