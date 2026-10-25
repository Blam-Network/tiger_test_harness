import { resolvePortList } from "../env";

export const DATAMINE_HTTP_PORTS_DEFAULT = [32_556] as const;

export function resolveDatamineHttpPorts(): number[] {
  return resolvePortList("DATAMINE_HTTP_PORTS", DATAMINE_HTTP_PORTS_DEFAULT);
}
