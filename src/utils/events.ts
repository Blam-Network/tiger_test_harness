import {
  data_mine_dispose,
  data_mine_initialize,
  e_event_level,
  event_message,
  event_warning,
  events_dispose,
  events_initialize,
  events_initialized,
  events_server_start,
  events_server_stop,
  events_spam_suppression_enable,
  type s_events_initialize_options,
  type s_real_rgb_color,
} from "@blamnetwork/datamine";
import { activeBuild, type e_build } from "../builds";
import {
  resolveDatamineEventsPort,
  resolveLogDir,
  resolveNoColor,
  workingDir,
} from "../env";
import { k_server_event_category_defaults } from "./event-categories";

// Events and the datamine file for this process. The first caller starts
// them (the server factories, or a Nest app embedding the modules). A
// consumer that initialized the datamine package itself keeps ownership:
// startEvents then does nothing and stopEvents only tears down what
// startEvents started.

// ANSI colours by level. Messages keep their category's colour when it has one
// (the script VM's magenta), so the server's own lines and the scripts' stay apart.
const levelColors: Record<e_event_level, string> = {
  [e_event_level.verbose]: "90",
  [e_event_level.status]: "36",
  [e_event_level.message]: "",
  [e_event_level.warning]: "33",
  [e_event_level.error]: "31",
  [e_event_level.critical]: "1;91",
};

function categoryColor(color: s_real_rgb_color): string {
  if (color.red === 1 && color.green === 1 && color.blue === 1) {
    return "";
  }
  const [red, green, blue] = [color.red, color.green, color.blue].map(
    (channel) => Math.round(channel * 255)
  );
  return `38;2;${red};${green};${blue}`;
}

function lineColor(level: e_event_level, color: s_real_rgb_color): string {
  return level === e_event_level.message
    ? categoryColor(color)
    : levelColors[level];
}

let quiet = false;

function display(
  line: string,
  level: e_event_level,
  color: s_real_rgb_color
): void {
  if (quiet) {
    return;
  }
  const code = resolveNoColor() ? "" : lineColor(level, color);
  const stream =
    level >= e_event_level.warning ? process.stderr : process.stdout;
  stream.write(code ? `\x1B[${code}m${line}\x1B[0m\n` : `${line}\n`);
}

// The served build, unless TIGER_GAME_BUILD names none (the first event
// should still go out then).
function servedBuild(): e_build | undefined {
  try {
    return activeBuild();
  } catch {
    return;
  }
}

function eventsOptions(
  version: string,
  files: boolean
): Partial<s_events_initialize_options> {
  return {
    version_string: version,
    categories: k_server_event_category_defaults,
    // Without a log directory only the console and the live stream are left.
    write_files: files,
    separate_session_reports: false,
    // The reports folder takes debug.txt and debug_full.txt, and debug.txt is
    // also written in the log directory itself.
    root_debug_log: true,
    full_log: true,
    // A dev server that restarts on each edit would otherwise cut the logs
    // to nothing at every start.
    trim_bytes: 64 * 1024 * 1024,
    // The served build's layout, so the lines match the datamine file.
    layout: "3.1",
  };
}

let owned = false;
let starting: Promise<void> | undefined;

async function start(): Promise<void> {
  if (events_initialized()) {
    return;
  }
  const dir = resolveLogDir();
  const build = servedBuild();
  const version = build ? `web-tiger ${build}` : "web-tiger";
  events_initialize({
    root: dir ?? workingDir(),
    ...eventsOptions(version, dir !== undefined),
    sinks: { display },
  });
  owned = true;
  // The console limiter would cut a busy server off after a few lines. The
  // switch announces itself on the console, which the server doesn't need.
  quiet = true;
  events_spam_suppression_enable(false);
  quiet = false;

  if (dir) {
    // data_mine_initialize always opens a file, so it only runs with a dir.
    try {
      data_mine_initialize({
        root: dir,
        title: "web_tiger",
        // No served build leaves the package's untracked defaults, which never upload.
        ...(build && {
          build_string: build,
          build_number: Number.parseInt(build, 10),
        }),
        enabled: true,
      });
    } catch (error) {
      event_warning(
        "datamine: not writing datamine files: %s",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const port = resolveDatamineEventsPort();
  if (port) {
    try {
      const { url } = await events_server_start({ port, host: "127.0.0.1" });
      event_message("datamine:events: live event server at %s", url);
    } catch (error) {
      event_warning(
        "datamine:events: live event server on port %d failed: %s",
        port,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Idempotent. Without TIGER_LOG_DIR events only reach the console and the
// live stream.
export function startEvents(): Promise<void> {
  starting ??= start();
  return starting;
}

export async function stopEvents(): Promise<void> {
  if (!owned) {
    return;
  }
  owned = false;
  starting = undefined;
  event_message("lifecycle: shutting down");
  await events_server_stop();
  data_mine_dispose();
  events_dispose();
}

// Ctrl+C or a kill ends the standalone server through stopEvents, so the
// logs and the datamine file are flushed and closed.
export function stopEventsOnSignal(): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stopEvents().finally(() => process.exit(0));
    });
  }
}
