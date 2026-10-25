import { fnv1 } from "@blamnetwork/bullshcript/destiny1/common";
import { activityInstanceForDebugTarget } from "../activity-host-proxy/activity-instance";
import { packBubbleStateHandle } from "../activity-host-proxy/rsat";
import { scenarioClient } from "../activity-host-proxy/scenario-client";
import { liveAhSessions } from "../activity-host-proxy/session";
import { scriptDebugger } from "./script-debugger";

// The script debugger's commands that act on the activity host connections.

const BUBBLE_STATE = /^(\d+)(?:\.(\d+))?$/;
const HASH_LITERAL = /^0x[0-9a-f]{1,8}$/i;

// After any debugger action on a target, its changed rows go out at once.
scriptDebugger.onChanged((targetId) => {
  const instance = activityInstanceForDebugTarget(targetId);
  const session = liveAhSessions().find(
    (candidate) =>
      instance !== undefined && candidate.activityInstance() === instance
  );
  const sent = session?.debugFlushRows() ?? 0;
  if (sent > 0) {
    session?.logRowsFlushed(sent);
  }
});

// /kick: drop every activity host connection of the target's activity, so
// its players go back to orbit and the instance ends.
scriptDebugger.registerCommand("kick", {
  usage: "",
  run: (_args, targetId) => {
    const instance = activityInstanceForDebugTarget(targetId);
    if (!instance) {
      return `no activity for ${targetId}`;
    }
    const dropped = liveAhSessions()
      .filter((session) => session.activityInstance() === instance)
      .map((session) => session.debugKick());
    return dropped.length > 0
      ? `kicked to orbit: ${dropped.join(", ")}`
      : `no connection in ${instance.activityName}`;
  },
});

// /teleport <bubble>[.<state>] [spawn point]: every player of the target's
// activity into that bubble's state, entering at the named spawn point (the
// scenario's spawn transition when none is named; a name the slice set has
// no spawn point for lands at its default).
scriptDebugger.registerCommand("teleport", {
  usage: "<bubble>[.<state>] [spawn point name | 0xhash] | clear",
  run: (args, targetId) => {
    if (args[0] === "clear" || args[0] === "abort") {
      const instance = activityInstanceForDebugTarget(targetId);
      const session = liveAhSessions().find(
        (candidate) => instance && candidate.activityInstance() === instance
      );
      return session
        ? session.debugTeleportClear()
        : `no player in ${targetId}`;
    }
    const match = (args[0] ?? "").match(BUBBLE_STATE);
    if (!match) {
      return "usage: /teleport <bubble>[.<state>] [spawn point name | 0xhash]";
    }
    const instance = activityInstanceForDebugTarget(targetId);
    if (!instance) {
      return `no activity for ${targetId}`;
    }
    const region = packBubbleStateHandle(
      Number(match[1]),
      Number(match[2] ?? 0)
    );
    const name = args.slice(1).join(" ");
    let transition =
      scenarioClient(instance.activityName)?.spawnTransition ?? 0;
    if (name) {
      transition = HASH_LITERAL.test(name)
        ? Number.parseInt(name, 16) >>> 0
        : fnv1(name);
    }
    const session = liveAhSessions().find(
      (candidate) => candidate.activityInstance() === instance
    );
    return session
      ? session.debugTeleport(region, transition)
      : `no player connected to ${instance.activityName}`;
  },
});
