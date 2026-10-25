import {
  activityBundles,
  activityPhases,
  activityPrivate,
  bubbleState,
} from "../content";
import { activityInstanceFor } from "./activity-instance";
import { ActivityHostMessageType } from "./messages";
import {
  buildGlobalActivityStateRsat,
  buildWorldGlobalsStateRsat,
  packBubbleStateHandle,
} from "./rsat";
import { type ScenarioClient, scenarioClient } from "./scenario-client";
import { ScriptHost } from "./script-host/runtime";
import type { SessionContext } from "./session-context";

// fnv1 of the phase the activity's scripts are running, when its phases are
// known.
export function phaseHash(
  session: SessionContext,
  activityName: string
): number | undefined {
  const host = session.scripts.host;
  if (!(host instanceof ScriptHost)) {
    return;
  }
  return activityPhases(activityName)[host.runtime.phaseIndex]?.hash;
}

// The region a private activity's client is in once it has entered the
// world, with the hash it reported for it (undefined when the client has not
// named the region, or before world entry).
function enteredRegion(
  session: SessionContext,
  activityName: string | undefined
): { bubble: number; state: number; transition?: number } | undefined {
  const { crossing } = session;
  if (
    !(
      session.worldEntered &&
      crossing.currentSlice !== undefined &&
      activityPrivate(activityName)
    )
  ) {
    return;
  }
  const bubble = crossing.currentSlice;
  const state = crossing.currentBubbleState;
  return {
    bubble,
    state,
    transition: crossing.clientRegionHashes.get(
      packBubbleStateHandle(bubble, state)
    ),
  };
}

// The start bubble's state the GAS names: the one the running phase owns (it
// moves when the intro ends), the scenario's before the scripts run.
function initialLifetimeState(
  session: SessionContext,
  activityName: string | undefined,
  scenario: ScenarioClient | undefined
): number | undefined {
  if (!(activityName && scenario && activityBundles(activityName))) {
    return;
  }
  const phase = phaseHash(session, activityName);
  return phase === undefined
    ? scenario.initialState
    : bubbleState(activityName, scenario.initialBubble ?? 0, phase);
}

// The GlobalActivityState and WorldGlobalsState pushes.
export function pushActivityGlobals(
  session: SessionContext,
  sessionId: bigint
): void {
  if (session.retired) {
    return;
  }
  const start = session.hosts.getStartRequest();
  const activityName = session.activityName();
  const scenario = activityName ? scenarioClient(activityName) : undefined;
  // PUBLIC CURRENT (GAH) compares GAS.activityChecksum to the scenario's
  // publicChecksum, FAH/PRIVATE to privateChecksum. The wrong side logs
  // `activity checksum mismatch` and the world instantiate returns 0.
  const activityChecksum =
    session.kind === "GAH"
      ? scenario?.publicChecksum
      : scenario?.privateChecksum;
  // From the second refresh on, the GAS names the region the client is in,
  // with the hash the client reports beside it. Until the world is entered it
  // is the scenario's start.
  const entered = enteredRegion(session, activityName);
  const initialBubble = entered?.bubble ?? scenario?.initialBubble;
  const initialState =
    entered?.state ?? initialLifetimeState(session, activityName, scenario);
  // The world server time is the instance's start in Unix seconds (every GAS
  // of a run carries the same one). A story mission's own data locks its time
  // of day, so this only shows where nothing locks it (the Tower, patrols).
  const instance = activityName
    ? activityInstanceFor(activityName, session.hosts)
    : undefined;
  const gas = buildGlobalActivityStateRsat({
    activityChecksum,
    activityId: start?.activityId,
    activityName: scenario?.activityName,
    bubbleCount: scenario?.bubbleCount,
    emptyBubbles: scenario?.emptyBubbles,
    initialBubble,
    initialState,
    instanceId: sessionId,
    worldServerTime:
      instance === undefined
        ? undefined
        : BigInt(instance.startedAtUnixSeconds),
    spawnTransitionName: entered?.transition ?? scenario?.spawnTransition,
  });
  const wgs = buildWorldGlobalsStateRsat();
  session.pushAh(
    sessionId,
    ActivityHostMessageType.GlobalActivityState,
    gas,
    `gas ${gas.length}B` +
      (start ? ` start activity=${start.activityId}` : " start=none") +
      (scenario
        ? ` name=${scenario.activityName} bubbles=${scenario.bubbleCount}` +
          (initialBubble === undefined
            ? ""
            : ` slice=${initialBubble}.${initialState ?? 0}`) +
          ` checksum=0x${(activityChecksum ?? 0).toString(16)}`
        : "")
  );
  session.pushAh(
    sessionId,
    ActivityHostMessageType.WorldGlobalsState,
    wgs,
    `wgs ${wgs.length}B`
  );
}
