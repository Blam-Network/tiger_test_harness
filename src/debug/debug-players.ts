import { liveAhSessions } from "../activity-host-proxy/session";
import { activityName } from "../content/activities";
import { players } from "../players/registry";
import { scriptDebugger } from "./script-debugger";

// tiger/players: every signed-in player and the debugger target (activity)
// each is in now, so a client can lock onto one and follow it from activity
// to activity.

interface DebugPlayer {
  account: string;
  activity: string | undefined;
  // The slice the player stands in, `bubble.state`.
  bubble: string | undefined;
  character: string | undefined;
  id: string;
  // The character's name and level, when one is signed in.
  level: number | undefined;
  name: string | undefined;
  platform: string;
  powerLevel: number | undefined;
  targetId: string | undefined;
}

const hex = (value: bigint | undefined) =>
  value === undefined ? undefined : `0x${value.toString(16)}`;

function debugPlayers(): DebugPlayer[] {
  const sessions = liveAhSessions();
  return players().map((player) => {
    const mine = sessions.filter((s) => s.debugHosts() === player.hosts);
    // the socket that has an activity instance with a debugger target
    const inActivity = mine.find(
      (s) => s.activityInstance()?.debugTarget !== undefined
    );
    const start = player.hosts.getStartRequest();
    const summary = player.publisher.characterSummary?.();
    return {
      level: summary?.level,
      name: summary?.name,
      powerLevel: player.publisher.powerLevel?.(),
      account: hex(player.accountSoid) ?? "",
      activity: start ? activityName(start.activityId) : undefined,
      bubble: inActivity?.debugBubble(),
      character: hex(player.characterSoid),
      id: hex(player.characterSoid) ?? hex(player.accountSoid) ?? "",
      platform: hex(player.platformId) ?? "",
      targetId: inActivity?.activityInstance()?.debugTarget,
    };
  });
}

scriptDebugger.registerRequest("tiger/players", () => ({
  players: debugPlayers(),
}));
