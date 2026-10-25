// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./queuez/self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSchemas(self: SelfSchemas) {
  const {
    Unknown808017DB,
    Unknown808018D1,
    Unknown808043C5,
    Unknown808017F4,
    Unknown80801830,
    Unknown808018CB,
  } = self;
  // 80800AF2 @0x20c4580, size 0x30
  // login_account request inner
  const LoginAccountRequestInner = rsat.schema(0x80800af2, {
    unknown: rsat.nested(Unknown808043C5),
    trailing: rsat.u64(),
  });

  // 8080170A @0x2036bc0, size 0x30, headerChecksum 0x26e24eb4
  // login_account request (nid 503)
  const LoginAccountRequest = rsat.schema(0x8080170a, {
    account: rsat.nested(LoginAccountRequestInner),
  });

  // 80801777 @0x20f8a90, size 0x8, headerChecksum 0x4e822394
  // status nest shared by every response; status is 4 bits
  const Unknown80801777 = rsat.schema(0x80801777, {
    unknown0: rsat.i8({ size: 4, bias: 1 }),
    unknown1: rsat.i32(),
  });

  // 808045E5 @0x205fb00, size 0x2c
  const Unknown808045E5 = rsat.schema(0x808045e5, {
    unknown0: rsat.array(rsat.i16(), { lengthBits: 5, max: 20 }),
  });

  // 808046D1 @0x21f7150, size 0x54
  const Unknown808046D1 = rsat.schema(0x808046d1, {
    unknown0: rsat.array(rsat.nested(Unknown80801830), {
      lengthBits: 5,
      max: 20,
    }),
  });

  const UNIVERSE_CHECKSUM = 0x7e4e624e;

  // 808017F8 @0x21cd5a0, size 0x98, headerChecksum 0x7e4e624e
  // server_object
  const ServerObject = rsat.schema(0x808017f8, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown808045E5)),
    unknown3: rsat.optional(rsat.nested(Unknown808046D1)),
    unknown4: rsat.optional(rsat.u32()),
  });

  // 808018BC @0x2360e30, size 0xb0, headerChecksum 0xd2380837
  // login_account response (nid 503)
  const LoginAccountResponse = rsat.schema(0x808018bc, {
    unknown0: rsat.nested(Unknown80801777),
    accountSoid: rsat.u64(),
    schemaChecksum: rsat.u32(),
    contentChecksum: rsat.u32(),
    serverObject: rsat.nested(ServerObject),
  });

  // 80801756 @0x20bdee0, size 0x10, headerChecksum 0x42ca6e9f
  // fetch_family request (nid 206)
  const FetchFamilyRequest = rsat.schema(0x80801756, {
    familyType: rsat.i8({ size: 4, bias: 1 }),
    familyRootSoid: rsat.u64(),
  });

  // 8080183F @0x2257680, size 0x1, headerChecksum 0x9c34ba1b
  // fetch_family response (nid 206)
  const FetchFamilyResponse = rsat.schema(0x8080183f, {
    unknown0: rsat.i8({ size: 4, bias: 1 }),
  });

  // 808016B9 @0x1fa8dd0, size 0xa0, headerChecksum 0x0bd66bda
  // director_enter_orbit response (nid 104)
  const DirectorEnterOrbitResponse = rsat.schema(0x808016b9, {
    unknown0: rsat.nested(Unknown80801777),
    serverObject: rsat.nested(ServerObject),
  });

  // 80801881 @0x22fb9c0, size 0x2, headerChecksum 0xbd89d5d7
  // director_complete_bink_activity request (nid 105)
  const DirectorCompleteBinkActivityRequest = rsat.schema(0x80801881, {
    activityIndex: rsat.i16(),
  });

  // 808016E2 @0x1ff3040, size 0x8, headerChecksum 0x18fa5209
  // director_complete_bink_activity response (nid 105)
  const DirectorCompleteBinkActivityResponse = rsat.schema(0x808016e2, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 80801870 @0x22d87a0, size 0x8, headerChecksum 0xb5f53355
  // profile_set_account_profile response (nid 701)
  const ProfileSetAccountProfileResponse = rsat.schema(0x80801870, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 808017BB @0x215e8d0, size 0x4c0, headerChecksum 0x66508be9
  // profile_set_character_profile request (nid 702)
  const ProfileSetCharacterProfileRequest = rsat.schema(0x808017bb, {
    profile: rsat.nested(Unknown808018CB),
  });

  // 80801925 @0x241a6d0, size 0x8, headerChecksum 0xf797fcea
  // profile_set_character_profile response (nid 702)
  const ProfileSetCharacterProfileResponse = rsat.schema(0x80801925, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 808041CE @0x2126370, size 0x11
  const Unknown808041CE = rsat.schema(0x808041ce, {
    unknown0: rsat.repeat(rsat.i8(), 17),
  });

  // 80804257 @0x21cbe50, size 0x11
  // platform user name, 17 x i8
  const PlatformUserName = rsat.schema(0x80804257, {
    chars: rsat.nested(Unknown808041CE),
  });

  // 80801834 @0x224ace0, size 0x3c, headerChecksum 0x997f2aff
  // login_create_character request (nid 501)
  const LoginCreateCharacterRequest = rsat.schema(0x80801834, {
    appearanceEc: rsat.nested(Unknown808017DB),
    appearanceF0: rsat.nested(Unknown808017F4),
    name: rsat.nested(PlatformUserName),
  });

  // 80801831 @0x22424e0, size 0x10, headerChecksum 0x97c27d08
  // login_create_character response (nid 501)
  const LoginCreateCharacterResponse = rsat.schema(0x80801831, {
    unknown0: rsat.nested(Unknown80801777),
    characterSoid: rsat.u64(),
  });

  // 8080190F @0x23f1090, size 0x8, headerChecksum 0xf06ed89c
  // login_delete_character request (nid 502)
  const LoginDeleteCharacterRequest = rsat.schema(0x8080190f, {
    characterSoid: rsat.u64(),
  });

  // 808017D6 @0x21909e0, size 0x8, headerChecksum 0x70a513e4
  // login_delete_character response (nid 502)
  const LoginDeleteCharacterResponse = rsat.schema(0x808017d6, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 808017AE @0x214e2a0, size 0x8, headerChecksum 0x623cb7e8
  // login_character request (nid 504)
  const LoginCharacterRequest = rsat.schema(0x808017ae, {
    characterSoid: rsat.u64(),
  });

  // 8080181C @0x2213080, size 0x8, headerChecksum 0x8da8fe2b
  // login_character response (nid 504)
  const LoginCharacterResponse = rsat.schema(0x8080181c, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 80801859 @0x22a20d0, size 0x8, headerChecksum 0xaa913b7c
  // signout_character response (nid 505)
  const SignoutCharacterResponse = rsat.schema(0x80801859, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 8080173A @0x2088e50, size 0x20, headerChecksum 0x37ebb83e
  // loot_pickup_item request (nid 601)
  const LootPickupItemRequest = rsat.schema(0x8080173a, {
    state: rsat.i8({ size: 3, bias: 1 }),
    nonce: rsat.nested(Unknown808018D1),
  });

  // 8080178D @0x2122770, size 0x20, headerChecksum 0x582fac8c
  // loot_pickup_item response (nid 601)
  const LootPickupItemResponse = rsat.schema(0x8080178d, {
    unknown0: rsat.nested(Unknown80801777),
    nonce: rsat.nested(Unknown808018D1),
  });

  // 8080195C @0x21b8860, size 0x18
  // item reference: instance flag, soid, definition index
  const ItemReference = rsat.schema(0x8080195c, {
    hasInstance: rsat.bool(),
    itemSoid: rsat.u64(),
    defIndex: rsat.i16(),
  });

  // 80801749 @0x20ae0d0, size 0x18, headerChecksum 0x3f83bb16
  // inventory_perform_item_action request (nid 402)
  const InventoryPerformItemActionRequest = rsat.schema(0x80801749, {
    item: rsat.nested(ItemReference),
  });

  // 80801929 @0x2420750, size 0x8, headerChecksum 0xf93d00fc
  // inventory_perform_item_action response (nid 402)
  const InventoryPerformItemActionResponse = rsat.schema(0x80801929, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 8080191B @0x2405220, size 0x8, headerChecksum 0xf41b5e63
  // inventory_equip_item request (nid 403)
  const InventoryEquipItemRequest = rsat.schema(0x8080191b, {
    itemSoid: rsat.u64(),
  });

  // 8080180F @0x21fc6f0, size 0x8, headerChecksum 0x885dcd1e
  // inventory_equip_item response (nid 403)
  const InventoryEquipItemResponse = rsat.schema(0x8080180f, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 8080186F @0x22d83f0, size 0x8, headerChecksum 0xb5da35b8
  // inventory_unequip_item request (nid 404)
  const InventoryUnequipItemRequest = rsat.schema(0x8080186f, {
    itemSoid: rsat.u64(),
  });

  // 8080187C @0x22f3f60, size 0x8, headerChecksum 0xbc0daba3
  // inventory_unequip_item response (nid 404)
  const InventoryUnequipItemResponse = rsat.schema(0x8080187c, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 8080175A @0x20c26d0, size 0x10, headerChecksum 0x438ca322
  // vendor_buy_item request (nid 901)
  const VendorBuyItemRequest = rsat.schema(0x8080175a, {
    vendorIndex: rsat.i8(),
    purchaseIndex: rsat.i16(),
    unknown2: rsat.optional(rsat.u64()),
  });

  // 8080185B @0x22a7470, size 0x8, headerChecksum 0xabd42b4f
  // vendor_buy_item response (nid 901)
  const VendorBuyItemResponse = rsat.schema(0x8080185b, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 80801719 @0x204b020, size 0x20, headerChecksum 0x2b71d58a
  // vendor_sell_item request (nid 903)
  const VendorSellItemRequest = rsat.schema(0x80801719, {
    item: rsat.nested(ItemReference),
    quantity: rsat.i32(),
    vendorIndex: rsat.i8(),
  });

  // 80801814 @0x2201060, size 0x8, headerChecksum 0x89920499
  // vendor_sell_item response (nid 903)
  const VendorSellItemResponse = rsat.schema(0x80801814, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 80801703 @0x2029910, size 0x10, headerChecksum 0x24aab476
  // talent_grid_activate_step request (nid 801)
  const TalentGridActivateStepRequest = rsat.schema(0x80801703, {
    itemSoid: rsat.u64(),
    node: rsat.i8(),
  });

  // 80801704 @0x2029c70, size 0x8, headerChecksum 0x24c68e45
  // talent_grid_activate_step response (nid 801)
  const TalentGridActivateStepResponse = rsat.schema(0x80801704, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 8080172E @0x206f050, size 0x10, headerChecksum 0x32a0d934
  // talent_grid_binary_swap request (nid 802)
  const TalentGridBinarySwapRequest = rsat.schema(0x8080172e, {
    itemSoid: rsat.u64(),
    node: rsat.i8(),
  });

  // 80801816 @0x2204940, size 0x8, headerChecksum 0x8a6138df
  // talent_grid_binary_swap response (nid 802)
  const TalentGridBinarySwapResponse = rsat.schema(0x80801816, {
    unknown0: rsat.nested(Unknown80801777),
  });

  // 36-byte account nest
  const AccountUnknown36 = Unknown808043C5;

  return {
    LoginAccountRequestInner,
    LoginAccountRequest,
    Unknown80801777,
    Unknown808045E5,
    Unknown808046D1,
    UNIVERSE_CHECKSUM,
    ServerObject,
    LoginAccountResponse,
    FetchFamilyRequest,
    FetchFamilyResponse,
    DirectorEnterOrbitResponse,
    DirectorCompleteBinkActivityRequest,
    DirectorCompleteBinkActivityResponse,
    ProfileSetAccountProfileResponse,
    ProfileSetCharacterProfileRequest,
    ProfileSetCharacterProfileResponse,
    Unknown808041CE,
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
    AccountUnknown36,
  };
}
