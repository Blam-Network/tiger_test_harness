export enum BapMessageType {
  ClientToActivityHostManagerRequest = 0x6,
  ClientToActivityHostManagerResponse = 0x7,
  ClientToActivityHostNotification = 0x8,
  BapToClientActivityNotification = 0x9,
  ClientToWorldServerRequest = 0xa,
  ClientToWorldServerResponse = 0xb,
  ClientToBapSubscriptionRequest = 0xc,
  ClientToBapSubscriptionResponse = 0xd,
  ClientToBapUnsubscribeRequest = 0xe,
  ClientToBapUnsubscribeResponse = 0xf,
  ClientToBapGetActivityHostProxyRequest = 0x10,
  ClientToBapGetActivityHostProxyResponse = 0x11,
  ClientToBapClientConfigRequest = 0x12,
  ClientToBapClientConfigResponse = 0x13,
  ClientToBapAccountIdTranslationPlatformToInvestmentRequest = 0x17,
  ClientToBapAccountIdTranslationPlatformToInvestmentResponse = 0x18,
  ClientToBapSecureHelloRequest = 0x19,
  ClientToBapSecureHelloResponse = 0x1a,
  ClientToBapChannelStartupRequest = 0x1e,
  ClientToBapChannelStartupResponse = 0x1f,
  ActivityHostToClientNotification = 0x64,
  ClientToBapQueuezRegisterRequest = 0x79,
  ClientToBapQueuezRegisterResponse = 0x7a,
  QueuezToClientUpdateNotification = 0x7b,
  ClientToXetrovNotification = 0xab,
  ClientToBapEchoRequest = 0xfa,
  ClientToBapEchoResponse = 0xfb,
  ClientToBapRegisterRelayClientRequest = 0x12e,
  ClientToBapRegisterRelayClientResponse = 0x12f,
}

export function bapMessageTypeName(type: number): string {
  switch (type) {
    case BapMessageType.ClientToActivityHostManagerRequest:
      return "client_to_activity_host_manager_request";
    case BapMessageType.ClientToActivityHostManagerResponse:
      return "client_to_activity_host_manager_response";
    case BapMessageType.ClientToActivityHostNotification:
      return "client_to_activity_host_notification";
    case BapMessageType.BapToClientActivityNotification:
      return "bap_to_client_activity_notification";
    case BapMessageType.ClientToWorldServerRequest:
      return "client_to_world_server_request";
    case BapMessageType.ClientToWorldServerResponse:
      return "client_to_world_server_response";
    case BapMessageType.ClientToBapSubscriptionRequest:
      return "client_to_bap_subscription_request";
    case BapMessageType.ClientToBapSubscriptionResponse:
      return "client_to_bap_subscription_response";
    case BapMessageType.ClientToBapUnsubscribeRequest:
      return "client_to_bap_unsubscribe_request";
    case BapMessageType.ClientToBapUnsubscribeResponse:
      return "client_to_bap_unsubscribe_response";
    case BapMessageType.ClientToBapGetActivityHostProxyRequest:
      return "client_to_bap_get_activity_host_proxy_request";
    case BapMessageType.ClientToBapGetActivityHostProxyResponse:
      return "client_to_bap_get_activity_host_proxy_response";
    case BapMessageType.ClientToBapClientConfigRequest:
      return "client_to_bap_client_config_request";
    case BapMessageType.ClientToBapClientConfigResponse:
      return "client_to_bap_client_config_response";
    case BapMessageType.ClientToBapAccountIdTranslationPlatformToInvestmentRequest:
      return "client_to_bap_account_id_translation_platform_to_investment_request";
    case BapMessageType.ClientToBapAccountIdTranslationPlatformToInvestmentResponse:
      return "client_to_bap_account_id_translation_platform_to_investment_response";
    case BapMessageType.ClientToBapSecureHelloRequest:
      return "client_to_bap_secure_hello_request";
    case BapMessageType.ClientToBapSecureHelloResponse:
      return "client_to_bap_secure_hello_response";
    case BapMessageType.ClientToBapChannelStartupRequest:
      return "client_to_bap_channel_startup_request";
    case BapMessageType.ClientToBapChannelStartupResponse:
      return "client_to_bap_channel_startup_response";
    case BapMessageType.ActivityHostToClientNotification:
      return "activity_host_to_client_notification";
    case BapMessageType.ClientToBapQueuezRegisterRequest:
      return "client_to_bap_queuez_register_request";
    case BapMessageType.ClientToBapQueuezRegisterResponse:
      return "client_to_bap_queuez_register_response";
    case BapMessageType.QueuezToClientUpdateNotification:
      return "queuez_to_client_update_notification";
    case BapMessageType.ClientToXetrovNotification:
      return "client_to_xetrov_notification";
    case BapMessageType.ClientToBapEchoRequest:
      return "client_to_bap_echo_request";
    case BapMessageType.ClientToBapEchoResponse:
      return "client_to_bap_echo_response";
    case BapMessageType.ClientToBapRegisterRelayClientRequest:
      return "client_to_bap_register_relay_client_request";
    case BapMessageType.ClientToBapRegisterRelayClientResponse:
      return "client_to_bap_register_relay_client_response";
    default:
      return `unknown_0x${type.toString(16)}`;
  }
}
