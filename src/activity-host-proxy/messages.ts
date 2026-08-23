export enum ActivityHostMessageType {
  EntitySlotsAllocated = 0,
  GlobalActivityState = 1,
  WorldGlobalsState = 2,
  JoinRequest = 3,
  JoinResult = 4,
  SensorAuthUpdate = 5,
  SensorSenseUpdate = 6,
  SensorMessage = 7,
  RequestActivityHost = 8,
  StartActivityHost = 9,
  StartActivityHostResponse = 10,
  ReplicateMembership = 11,
  RequestPeerReservation = 12,
  ReleasePeerReservation = 13,
  PeerLeaveRequest = 14,
  ActivityClientKeepaliveRequest = 15,
  ActivityClientKeepaliveResponse = 16,
  ActivityClientRequestStateRefresh = 17,
  Incident = 18,
  AllocateEntityIndices = 19,
  FreeEntityIndices = 20,
  ClientAuthoritativeDataUpdate = 21,
  ClientIdentityUpdate = 22,
  ClaimAuthorityOverAbandonedEntitySlots = 23,
  PurgeAbandonedEntitySlots = 24,
  AbandonEntitySlots = 25,
  RequestPurgeEntitySlots = 26,
  ResetEntitySlotAuthorityMask = 27,
  ResetEntitySlotAuthorityMaskAcknowledgement = 28,
  QueryEntitySlotAuthorityMask = 29,
  QueryEntitySlotAuthorityMaskPerBubbleResponse = 30,
  QueryEntitySlotAuthorityMaskResponse = 31,
  AbdicateAuthority = 32,
  ProcessDebugCommand = 33,
  DebugRequestMigration = 34,
  ConnectivityFailure = 35,
  MembershipAcknowledgement = 36,
  SendClientHeartbeat = 37,
  ScriptState = 38,
  ScriptEvent = 39,
  RequestScriptUpdates = 40,
  BugClaw = 41,
  AdvanceReplicationEpoch = 42,
  // Not in pre alpha?
  // ReservationsFailed = 43,
  // ReportLagSwitch = 44,
  // ConnectionQualityReport = 45,
  // SpeculativeMigration = 46,
  // HighWater = 47,
  // RefreshInspirations = 48,
}

export function isActivityHostMessageType(
  type: number
): type is ActivityHostMessageType {
  return Object.values(ActivityHostMessageType).includes(type);
}

export function activityHostMessageTypeName(
  type: ActivityHostMessageType
): string {
  switch (type) {
    case ActivityHostMessageType.EntitySlotsAllocated:
      return "entity_slots_allocated";
    case ActivityHostMessageType.GlobalActivityState:
      return "global_activity_state";
    case ActivityHostMessageType.WorldGlobalsState:
      return "world_globals_state";
    case ActivityHostMessageType.JoinRequest:
      return "join_request";
    case ActivityHostMessageType.JoinResult:
      return "join_result";
    case ActivityHostMessageType.SensorAuthUpdate:
      return "sensor_auth_update";
    case ActivityHostMessageType.SensorSenseUpdate:
      return "sensor_sense_update";
    case ActivityHostMessageType.SensorMessage:
      return "sensor_message";
    case ActivityHostMessageType.RequestActivityHost:
      return "request_activity_host";
    case ActivityHostMessageType.StartActivityHost:
      return "start_activity_host";
    case ActivityHostMessageType.StartActivityHostResponse:
      return "start_activity_host_response";
    case ActivityHostMessageType.ReplicateMembership:
      return "replicate_membership";
    case ActivityHostMessageType.RequestPeerReservation:
      return "request_peer_reservation";
    case ActivityHostMessageType.ReleasePeerReservation:
      return "release_peer_reservation";
    case ActivityHostMessageType.PeerLeaveRequest:
      return "peer_leave_request";
    case ActivityHostMessageType.ActivityClientKeepaliveRequest:
      return "activity_client_keepalive_request";
    case ActivityHostMessageType.ActivityClientKeepaliveResponse:
      return "activity_client_keepalive_response";
    case ActivityHostMessageType.ActivityClientRequestStateRefresh:
      return "activity_client_request_state_refresh";
    case ActivityHostMessageType.Incident:
      return "incident";
    case ActivityHostMessageType.AllocateEntityIndices:
      return "allocate_entity_indices";
    case ActivityHostMessageType.FreeEntityIndices:
      return "free_entity_indices";
    case ActivityHostMessageType.ClientAuthoritativeDataUpdate:
      return "client_authoritative_data_update";
    case ActivityHostMessageType.ClientIdentityUpdate:
      return "client_identity_update";
    case ActivityHostMessageType.ClaimAuthorityOverAbandonedEntitySlots:
      return "claim_authority_over_abandoned_entity_slots";
    case ActivityHostMessageType.PurgeAbandonedEntitySlots:
      return "purge_abandoned_entity_slots";
    case ActivityHostMessageType.AbandonEntitySlots:
      return "abandon_entity_slots";
    case ActivityHostMessageType.RequestPurgeEntitySlots:
      return "request_purge_entity_slots";
    case ActivityHostMessageType.ResetEntitySlotAuthorityMask:
      return "reset_entity_slot_authority_mask";
    case ActivityHostMessageType.ResetEntitySlotAuthorityMaskAcknowledgement:
      return "reset_entity_slot_authority_mask_acknowledgement";
    case ActivityHostMessageType.QueryEntitySlotAuthorityMask:
      return "query_entity_slot_authority_mask";
    case ActivityHostMessageType.QueryEntitySlotAuthorityMaskPerBubbleResponse:
      return "query_entity_slot_authority_mask_per_bubble_response";
    case ActivityHostMessageType.QueryEntitySlotAuthorityMaskResponse:
      return "query_entity_slot_authority_mask_response";
    case ActivityHostMessageType.AbdicateAuthority:
      return "abdicate_authority";
    case ActivityHostMessageType.ProcessDebugCommand:
      return "process_debug_command";
    case ActivityHostMessageType.DebugRequestMigration:
      return "debug_request_migration";
    case ActivityHostMessageType.ConnectivityFailure:
      return "connectivity_failure";
    case ActivityHostMessageType.MembershipAcknowledgement:
      return "membership_acknowledgement";
    case ActivityHostMessageType.SendClientHeartbeat:
      return "send_client_heartbeat";
    case ActivityHostMessageType.ScriptState:
      return "script_state";
    case ActivityHostMessageType.ScriptEvent:
      return "script_event";
    case ActivityHostMessageType.RequestScriptUpdates:
      return "request_script_updates";
    case ActivityHostMessageType.BugClaw:
      return "bug_claw";
    case ActivityHostMessageType.AdvanceReplicationEpoch:
      return "advance_replication_epoch";
    // case ActivityHostMessageType.ReservationsFailed:
    //   return "reservations_failed";
    // case ActivityHostMessageType.ReportLagSwitch:
    //   return "report_lag_switch";
    // case ActivityHostMessageType.ConnectionQualityReport:
    //   return "connection_quality_report";
    // case ActivityHostMessageType.SpeculativeMigration:
    //   return "speculative_migration";
    // case ActivityHostMessageType.HighWater:
    //   return "high_water";
    // case ActivityHostMessageType.RefreshInspirations:
    //   return "refresh_inspirations";
    default: {
      const _: never = type;
      return _;
    }
  }
}
