import { tmpdir } from "node:os";
import {
  e_event_level,
  events_dispose,
  events_initialize,
  events_initialized,
  events_register_listener,
  k_event_level_none,
  type s_event_listener_event,
} from "@blamnetwork/datamine";

let current: ReturnType<typeof start> | undefined;

// Starts the datamine package's events with no files and no console, and
// collects what the code under test raises. A second call while they run
// shares the first one's collection. dispose() ends them.
export function captureEvents() {
  if (!(current && events_initialized())) {
    current = start();
  }
  return current;
}

function start() {
  const events: s_event_listener_event[] = [];
  events_initialize({
    root: tmpdir(),
    install_exit_flush: false,
    write_files: false,
    initial_levels: {
      display: e_event_level.verbose,
      log: e_event_level.verbose,
      remote_log: k_event_level_none,
    },
    sinks: { display: () => undefined },
  });
  events_register_listener("", (event) => events.push(event));
  return {
    events,
    // the events of one level
    at: (level: e_event_level) => events.filter((e) => e.level === level),
    texts: () => events.map((e) => e.text),
    dispose: () => events_dispose(),
  };
}
