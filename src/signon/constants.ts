import { resolvePortList } from "../env";
import { signonBuild } from "./versions";

// Override the build's ports with SIGNON_HTTP_PORTS=443,32000,...
export function resolveSignonHttpPorts(): number[] {
  return resolvePortList("SIGNON_HTTP_PORTS", signonBuild().ports);
}
