// The disc packages, opened once per process. The readers find tags by
// traversal from named roots rather than by tag id.
import type * as alpha_gibbon from "@blamnetwork/gibbon/destiny1/v36735_13_12_02_1953_alpha";
import { e_build } from "../../../../builds";
import { checkedPackagesDir } from "../../../detect-build";

// The scans of an activity's bundles walk far more blocks than the
// default cache (32) holds.
const BLOCK_CACHE = 512;

// What the readers use of gibbon's build.
export type GibbonApi = Pick<
  typeof alpha_gibbon,
  | "c_package_set"
  | "character_level_progression"
  | "e_investment_client_global"
  | "e_investment_global"
  | "e_unlock_flag_source"
  | "find_named_tag"
  | "investment_client_global_tag"
  | "investment_global_tag"
  | "item_definition_tags"
  | "k_activity_bundle_class"
  | "k_nav_point_sensor_definition_type"
  | "k_package_header_size"
  | "k_scenario_client_class"
  | "k_scenario_fah_class"
  | "k_squad_definition_class"
  | "read_activity_table"
  | "read_command_script"
  | "read_definition"
  | "read_incident_names"
  | "read_string_bank"
  | "s_activity_bundle"
  | "s_actor_sensor_host_definition"
  | "s_activity_definition_tag"
  | "s_activity_lookup"
  | "s_character_constants"
  | "s_client_blueprint_set"
  | "s_face_command"
  | "s_flag_command"
  | "s_move_command"
  | "s_named_command"
  | "s_blueprint_bundle"
  | "s_inventory_buckets"
  | "s_item_definition"
  | "s_item_display"
  | "s_item_display_table"
  | "s_nav_point_sensor_host_definition"
  | "s_new_character_defaults"
  | "s_object_sensor_host_definition"
  | "s_objective_sensor_host_definition"
  | "s_package_header"
  | "s_scenario_client"
  | "s_row_reference"
  | "s_scenario_fah"
  | "s_set_channel_command"
  | "s_sensor_host_definition"
  | "s_sensor_host_instance"
  | "s_sequence_sensor_host_definition"
  | "s_sleep_command"
  | "s_snap_to_command"
  | "s_slice_descriptor"
  | "s_squad_definition"
  | "s_squad_sensor_host_definition"
  | "s_loot_sensor_host_definition"
  | "s_stat_curve_table"
  | "s_string_list"
  | "s_string_list_table"
  | "s_ability_command"
  | "s_ability_table"
  | "s_achievement_table"
  | "s_progression_table"
  | "s_server_message_table"
  | "s_talent_grid"
  | "s_temperament_command"
  | "s_timed_end_condition"
  | "s_talent_grid_table"
  | "s_unlock_flag_name_table"
  | "s_unlock_slot_table"
  | "s_unlock_time_table"
  | "s_vendor"
  | "s_vendor_table"
  | "stat_curve_points"
  | "tag_format_error"
  | "tag_hash_package"
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
        checkedPackagesDir(packagesDir(), e_build.v36735_13_12_02_1953_alpha),
        {
          cache_blocks: BLOCK_CACHE,
        }
      ),
    };
    return opened;
  };
}
