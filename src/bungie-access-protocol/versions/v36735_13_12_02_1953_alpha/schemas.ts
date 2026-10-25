import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./queuez/self";
import type { SharedSchemas } from "./queuez/shared";

export function defineMessageSchemas(
  deps: Pick<
    SelfSchemas,
    "Unknown808019F3" | "Unknown8080181F" | "Unknown8080198F"
  > &
    Pick<SharedSchemas, "AppearanceEc" | "AppearanceF0">
) {
  const {
    Unknown808019F3,
    Unknown8080181F,
    Unknown8080198F,
    AppearanceEc,
    AppearanceF0,
  } = deps;

  // 80801A2B — status nest used by several responses.
  const Unknown80801A2B = rsat.schema(0x80801a2b, {
    unknown0: rsat.i32({ size: 3, bias: 1 }),
    unknown1: rsat.i32({ size: 32, bias: 0x80000000 }),
  });

  // 808018D0 — server_object.
  const ServerObject = rsat.schema(0x808018d0, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.rawBytes()),
    unknown3: rsat.optional(rsat.rawBytes()),
    unknown4: rsat.optional(rsat.u32()),
  });

  // 80801AB0 — login_account response (nid 503).
  const LoginAccountResponse = rsat.schema(0x80801ab0, {
    unknown0: rsat.nested(Unknown80801A2B),
    accountSoid: rsat.u64(),
    schemaChecksum: rsat.u32({ size: 32, bias: 0 }),
    contentChecksum: rsat.u32({ size: 32, bias: 0 }),
    serverObject: rsat.nested(ServerObject),
  });

  // 80801A8D — fetch_family request (nid 206).
  const FetchFamilyRequest = rsat.schema(0x80801a8d, {
    familyType: rsat.i32({ size: 4, bias: 1 }),
    familyRootSoid: rsat.u64(),
  });

  // 80801A8E — fetch_family response (nid 206).
  const FetchFamilyResponse = rsat.schema(0x80801a8e, {
    unknown0: rsat.i32({ size: 3, bias: 1 }),
  });

  // 80801A52 — director_enter_orbit response.
  const DirectorEnterOrbitResponse = rsat.schema(0x80801a52, {
    unknown0: rsat.nested(Unknown80801A2B),
    serverObject: rsat.nested(ServerObject),
  });

  // 80801ABA — profile_set_account_profile response (nid 701).
  const ProfileSetAccountProfileResponse = rsat.schema(0x80801aba, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801ABB — profile_set_character_profile request (nid 702).
  const ProfileSetCharacterProfileRequest = rsat.schema(0x80801abb, {
    profile: rsat.nested(Unknown808019F3),
  });

  // 80801ABC — profile_set_character_profile response (nid 702).
  const ProfileSetCharacterProfileResponse = rsat.schema(0x80801abc, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80800E38 — 36-byte nest (fixed bytes on wire).
  const AccountUnknown36 = rsat.schema(0x80800e38, {
    bytes: rsat.bytes(36),
  });

  // 80804A43 — login_account request inner.
  const LoginAccountRequestInner = rsat.schema(0x80804a43, {
    unknown: rsat.nested(AccountUnknown36),
    trailing: rsat.u64(),
  });

  // 80801AAF — login_account request (nid 503).
  const LoginAccountRequest = rsat.schema(0x80801aaf, {
    account: rsat.nested(LoginAccountRequestInner),
  });

  // 80801BFF — platform user name, 17 x UTF-16 code units.
  const PlatformUserName = rsat.schema(0x80801bff, {
    chars: rsat.bytes(34),
  });

  // 80801AA9 — login_create_character request (nid 501).
  const LoginCreateCharacterRequest = rsat.schema(0x80801aa9, {
    appearanceEc: rsat.nested(AppearanceEc),
    appearanceF0: rsat.nested(AppearanceF0),
    name: rsat.nested(PlatformUserName),
  });

  // 80801AAC — login_create_character response (nid 501).
  const LoginCreateCharacterResponse = rsat.schema(0x80801aac, {
    unknown0: rsat.nested(Unknown80801A2B),
    characterSoid: rsat.u64(),
  });

  // 80801AAD — login_delete_character request (nid 502).
  const LoginDeleteCharacterRequest = rsat.schema(0x80801aad, {
    characterSoid: rsat.u64(),
  });

  // 80801AAE — login_delete_character response (nid 502).
  const LoginDeleteCharacterResponse = rsat.schema(0x80801aae, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AB1 — login_character request (nid 504).
  const LoginCharacterRequest = rsat.schema(0x80801ab1, {
    characterSoid: rsat.u64(),
  });

  // 80801AB2 — login_character response (nid 504).
  const LoginCharacterResponse = rsat.schema(0x80801ab2, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AB4 — signout_character response (nid 505).
  const SignoutCharacterResponse = rsat.schema(0x80801ab4, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AB5 — loot_pickup_item request (nid 601), no presence bits.
  const LootPickupItemRequest = rsat.schema(0x80801ab5, {
    state: rsat.i8({ size: 3, bias: 1 }),
    nonce: rsat.nested(Unknown8080181F),
  });

  // 80801AB6 — loot_pickup_item response (nid 601).
  const LootPickupItemResponse = rsat.schema(0x80801ab6, {
    unknown0: rsat.nested(Unknown80801A2B),
    nonce: rsat.nested(Unknown8080181F),
  });

  // 80801AA1 — inventory_destroy_item request (nid 401).
  const InventoryDestroyItemRequest = rsat.schema(0x80801aa1, {
    itemSoid: rsat.u64(),
  });

  // 80801AA2 — inventory_destroy_item response (nid 401).
  const InventoryDestroyItemResponse = rsat.schema(0x80801aa2, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80804BD1 — item reference: instance flag, soid, definition index.
  const ItemReference = rsat.schema(0x80804bd1, {
    hasInstance: rsat.bool(),
    itemSoid: rsat.u64(),
    defIndex: rsat.i16({ bias: 0x8000 }),
  });

  // 80801AA5 — inventory_perform_item_action request (nid 402).
  const InventoryPerformItemActionRequest = rsat.schema(0x80801aa5, {
    item: rsat.nested(ItemReference),
  });

  // 80801AA6 — inventory_perform_item_action response (nid 402).
  const InventoryPerformItemActionResponse = rsat.schema(0x80801aa6, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AA3 — inventory_equip_item request (nid 403).
  const InventoryEquipItemRequest = rsat.schema(0x80801aa3, {
    itemSoid: rsat.u64(),
  });

  // 80801AA4 — inventory_equip_item response (nid 403).
  const InventoryEquipItemResponse = rsat.schema(0x80801aa4, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AA7 — inventory_unequip_item request (nid 404).
  const InventoryUnequipItemRequest = rsat.schema(0x80801aa7, {
    itemSoid: rsat.u64(),
  });

  // 80801AA8 — inventory_unequip_item response (nid 404).
  const InventoryUnequipItemResponse = rsat.schema(0x80801aa8, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801ACB — vendor_buy_item request (nid 901).
  const VendorBuyItemRequest = rsat.schema(0x80801acb, {
    vendorIndex: rsat.i8({ bias: 0x80 }),
    purchaseIndex: rsat.i16({ bias: 0x8000 }),
  });

  // 80801ACC — vendor_buy_item response (nid 901).
  const VendorBuyItemResponse = rsat.schema(0x80801acc, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801ACF — vendor_sell_item request (nid 903).
  const VendorSellItemRequest = rsat.schema(0x80801acf, {
    item: rsat.nested(ItemReference),
    quantity: rsat.i32({ bias: 0x80000000 }),
    vendorIndex: rsat.i8({ bias: 0x80 }),
  });

  // 80801AD0 — vendor_sell_item response (nid 903).
  const VendorSellItemResponse = rsat.schema(0x80801ad0, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AC5 — talent_grid_activate_step request (nid 801). The client sends
  // only soid + node; step and the trailing field are always 0 - the server
  // picks the step.
  const TalentGridActivateStepRequest = rsat.schema(0x80801ac5, {
    itemSoid: rsat.u64(),
    node: rsat.nested(Unknown8080198F),
    // True name unknown; same shape as the 80801A2B status enum. Always 0.
    unknown2: rsat.i8({ size: 3, bias: 1 }),
  });

  // 80801AC6 — talent_grid_activate_step response (nid 801).
  const TalentGridActivateStepResponse = rsat.schema(0x80801ac6, {
    unknown0: rsat.nested(Unknown80801A2B),
  });

  // 80801AC7 — talent_grid_binary_swap request (nid 802).
  const TalentGridBinarySwapRequest = rsat.schema(0x80801ac7, {
    itemSoid: rsat.u64(),
    node: rsat.i8({ bias: 0x80 }),
  });

  // 80801AC8 — talent_grid_binary_swap response (nid 802).
  const TalentGridBinarySwapResponse = rsat.schema(0x80801ac8, {
    unknown0: rsat.nested(Unknown80801A2B),
  });
  return {
    Unknown80801A2B,
    ServerObject,
    LoginAccountResponse,
    FetchFamilyRequest,
    FetchFamilyResponse,
    DirectorEnterOrbitResponse,
    ProfileSetAccountProfileResponse,
    ProfileSetCharacterProfileRequest,
    ProfileSetCharacterProfileResponse,
    AccountUnknown36,
    LoginAccountRequestInner,
    LoginAccountRequest,
    PlatformUserName,
    LoginCreateCharacterRequest,
    LoginCreateCharacterResponse,
    LoginDeleteCharacterRequest,
    LoginDeleteCharacterResponse,
    LoginCharacterRequest,
    LoginCharacterResponse,
    SignoutCharacterResponse,
    LootPickupItemRequest,
    LootPickupItemResponse,
    InventoryDestroyItemRequest,
    InventoryDestroyItemResponse,
    ItemReference,
    InventoryPerformItemActionRequest,
    InventoryPerformItemActionResponse,
    InventoryEquipItemRequest,
    InventoryEquipItemResponse,
    InventoryUnequipItemRequest,
    InventoryUnequipItemResponse,
    VendorBuyItemRequest,
    VendorBuyItemResponse,
    VendorSellItemRequest,
    VendorSellItemResponse,
    TalentGridActivateStepRequest,
    TalentGridActivateStepResponse,
    TalentGridBinarySwapRequest,
    TalentGridBinarySwapResponse,
  };
}
