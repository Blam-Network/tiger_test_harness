// The disc packages, opened once per process. The readers find tags by
// traversal from named roots rather than by tag id.
import type * as betath_gibbon from "@blamnetwork/gibbon/destiny1/v38464_14_02_28_1027_betath";
import { e_build } from "../../../../builds";
import { checkedPackagesDir } from "../../../detect-build";

// The scans of an activity's bundles walk far more blocks than the
// default cache (32) holds.
const BLOCK_CACHE = 512;

// What the readers use of gibbon's build.
export type GibbonApi = Pick<
  typeof betath_gibbon,
  | "c_package_set"
  | "e_investment_client_global"
  | "e_investment_global"
  | "e_package_language"
  | "e_unlock_flag_source"
  | "host_offsets"
  | "investment_client_global_tag"
  | "investment_global_tag"
  | "item_definition_tags"
  | "k_character_level_progression_role"
  | "k_nav_point_set_definition_type"
  | "k_package_header_size"
  | "k_scenario_client_class"
  | "read_client_incident_names"
  | "read_definition"
  | "s_ability_table"
  | "s_activity_bundle"
  | "s_activity_definition_tag"
  | "s_activity_lookup"
  | "s_activity_table"
  | "s_actor_sensor_host_definition"
  | "s_character_constants"
  | "s_client_blueprint_set"
  | "s_client_destination_table"
  | "s_inventory_buckets"
  | "s_item_definition"
  | "s_item_display"
  | "s_item_display_table"
  | "s_new_character_defaults"
  | "s_objective_sensor_host_definition"
  | "s_package_header"
  | "s_progression_table"
  | "s_record_table"
  | "s_row_group_definition"
  | "s_scenario_client"
  | "s_sensor_host_definition"
  | "s_sequence_sensor_host_definition"
  | "s_server_message_table"
  | "s_slice_descriptor"
  | "s_squad_definition"
  | "s_squad_sensor_host_definition"
  | "s_stat_curve_table"
  | "s_localized_strings"
  | "s_localized_strings_table"
  | "s_talent_grid"
  | "s_talent_grid_table"
  | "s_unlock_flag_name_table"
  | "s_unlock_slot_table"
  | "s_unlock_time_table"
  | "s_vendor"
  | "s_vendor_table"
>;

// gibbon's build and a package set opened on it. The set is untyped here:
// the readers take it as `any`.
export interface Packages {
  g: GibbonApi;
  set: any;
}

// The package set of a gibbon build, opened on first use in the directory
// `packagesDir` names.
export function packageSetOf(
  g: GibbonApi,
  packagesDir: () => string
): () => Packages {
  let opened: Packages | undefined;
  return () => {
    opened ??= {
      g,
      set: g.c_package_set.open_directory(
        checkedPackagesDir(packagesDir(), e_build.v38464_14_02_28_1027_betath),
        {
          cache_blocks: BLOCK_CACHE,
        }
      ),
    };
    return opened;
  };
}
