import type { ActivityHostBuild } from "../activity-host-build";
import { type AhSchemas, defineAhSchemas } from "./ah";
import { createClientReportsWire } from "./client-reports";
import { createEntitySlotsWire } from "./entity-slots";
import { createGlobalActivityStateWire } from "./global-activity-state";
import { hardWipeRules } from "./hard-wipe";
import { createIncidentWire } from "./incident";
import { createJoinWire } from "./join";
import { createMembershipWire } from "./membership";
import { notificationHeaders } from "./notification-header";
import { createSensorAuth } from "./sensor-auth";
import { createSenseWire } from "./sensor-sense";
import { defineStartRequestSchemas } from "./start-request";

// A build's own structures, for the tests that read them.
export interface FfActivityHostBuild extends ActivityHostBuild {
  ah: AhSchemas;
}

// Defines every schema once; forBuild memoizes the result.
export function loadActivityHostBuild(): FfActivityHostBuild {
  const ah = defineAhSchemas();
  return {
    ah,
    applyLayout: {
      activityWideSensors: true,
      fillsBundleSlots: false,
      keysEveryPlayerRow: false,
      minimalBinderGrant: false,
      rowsOnlyApply: false,
      squadBindingByGeneration: true,
      // The client asserts a squad auth's roster has a cell per definition
      // member when it reconciles the bubble (0x16363DD), so no squad goes
      // out with the zero auth.
      squadsAtDefinition: true,
    },
    clientReports: createClientReportsWire(ah),
    entitySlots: createEntitySlotsWire(),
    globalActivityState: createGlobalActivityStateWire(ah),
    hardWipe: hardWipeRules,
    incidents: createIncidentWire(),
    join: createJoinWire(ah),
    // The 6-byte console id and two zero bytes, per a retail capture's
    // membership.
    machineIdBytes: 8,
    membership: createMembershipWire(ah),
    notificationHeader: notificationHeaders,
    sensor: { ...createSensorAuth(ah), sense: createSenseWire(ah) },
    startRequest: defineStartRequestSchemas(),
  };
}
