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
export interface AlphaActivityHostBuild extends ActivityHostBuild {
  ah: AhSchemas;
}

// Defines every schema once; forBuild memoizes the result.
export function loadActivityHostBuild(): AlphaActivityHostBuild {
  const ah = defineAhSchemas();
  return {
    ah,
    applyLayout: {
      activityWideSensors: false,
      fillsBundleSlots: true,
      keysEveryPlayerRow: true,
      minimalBinderGrant: true,
      rowsOnlyApply: true,
      squadsAtDefinition: true,
    },
    clientReports: createClientReportsWire(ah),
    entitySlots: createEntitySlotsWire(),
    globalActivityState: createGlobalActivityStateWire(ah),
    hardWipe: hardWipeRules,
    incidents: createIncidentWire(),
    join: createJoinWire(ah),
    // The console's 6-byte id.
    machineIdBytes: 6,
    membership: createMembershipWire(ah),
    notificationHeader: notificationHeaders,
    sensor: { ...createSensorAuth(ah), sense: createSenseWire(ah) },
    startRequest: defineStartRequestSchemas(),
  };
}
