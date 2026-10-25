import { e_event_level, event } from "@blamnetwork/datamine";
import type { LoggerService } from "@nestjs/common";

const categoryCharacters = /[^a-z0-9_-]+/g;
const contextName = /^[\w.-]{1,40}$/;

// Nest passes its context as the last argument; an error's stack can sit
// there when there is none.
function splitContext(params: unknown[]): [unknown[], string] {
  const last = params.at(-1);
  return typeof last === "string" && contextName.test(last)
    ? [params.slice(0, -1), last]
    : [params, "nest"];
}

function textOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  return JSON.stringify(value);
}

function raise(
  level: e_event_level,
  message: unknown,
  optionalParams: unknown[]
): void {
  const [rest, context] = splitContext(optionalParams);
  const category = context.toLowerCase().replace(categoryCharacters, "_");
  event(
    level,
    `nest:${category}: %s`,
    [message, ...rest].map(textOf).join(" ")
  );
}

// Nest's own framework lines (bootstrap, routes) as events.
export const nestLogger: LoggerService = {
  log: (message, ...params) => raise(e_event_level.message, message, params),
  error: (message, ...params) => raise(e_event_level.error, message, params),
  warn: (message, ...params) => raise(e_event_level.warning, message, params),
  debug: (message, ...params) => raise(e_event_level.verbose, message, params),
  verbose: (message, ...params) =>
    raise(e_event_level.verbose, message, params),
  fatal: (message, ...params) => raise(e_event_level.critical, message, params),
};
