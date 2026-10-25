import {
  e_event_level,
  type s_event_category_default_configuration,
  type s_real_rgb_color,
} from "@blamnetwork/datamine";

const white: s_real_rgb_color = { red: 1, green: 1, blue: 1 };
const magenta: s_real_rgb_color = { red: 0.95, green: 0.4, blue: 0.95 };
const gray: s_real_rgb_color = { red: 0.55, green: 0.55, blue: 0.55 };

// Console and datamine at message, everything to the logs. The category
// paths are derived per module: networking (BAP), activities (activity host
// proxy and its script host session), demonware, signon, http, datamine,
// debug, content, lifecycle, nest (framework lines) and bullshcript (the
// script VM). A category created later (networking:bap:) copies its parent.
function category(
  name: string,
  overrides: Partial<s_event_category_default_configuration> = {}
): s_event_category_default_configuration {
  return {
    name,
    display_color: white,
    display_level: e_event_level.message,
    log_level: e_event_level.verbose,
    remote_log_level: e_event_level.message,
    ...overrides,
  };
}

// A log file only where a category is high volume.
export const k_server_event_category_defaults: readonly s_event_category_default_configuration[] =
  [
    // server startup, shutdown and the served build
    category("lifecycle:"),
    // the TCP protocols the console speaks: BAP
    category("networking:", { log_name: "networking_debug.txt" }),
    // activity host proxy, its script host session and region crossings
    category("activities:", { log_name: "activities_debug.txt" }),
    // lobby, matchmaking and the auth endpoint
    category("demonware:", { log_name: "demonware_debug.txt" }),
    // the script VM, its natives and the activity scripts' own output
    category("bullshcript:", {
      log_name: "bullshcript_debug.txt",
      display_color: magenta,
    }),
    category("signon:"),
    // every request the console makes over HTTP
    category("http:", { display_level: e_event_level.status }),
    category("datamine:"),
    // the script debugger server
    category("debug:"),
    // game data read from the packages
    category("content:"),
    // Nest's own framework lines
    category("nest:", {
      display_level: e_event_level.warning,
      display_color: gray,
    }),
  ];
