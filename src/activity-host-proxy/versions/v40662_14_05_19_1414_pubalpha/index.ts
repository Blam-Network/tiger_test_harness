import type { ActivityHostBuild } from "../activity-host-build";
import { defineAhSchemas } from "./ah";
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

// Defines every schema once; forBuild memoizes the result.
export function loadActivityHostBuild(): ActivityHostBuild {
  const ah = defineAhSchemas();
  return {
    applyLayout: {
      activityWideSensors: true,
      fillsBundleSlots: false,
      keysEveryPlayerRow: false,
      minimalBinderGrant: false,
      rowsOnlyApply: false,
      squadsAtDefinition: false,
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
