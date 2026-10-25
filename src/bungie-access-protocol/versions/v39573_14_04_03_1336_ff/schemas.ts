// Client schemas, from the eboot's schema registry (scripts/rsat-descriptors.py
// dumps it): record address, PS4 size and checksum. Unnamed fields are
// unknownN, their member index in the record.

import { rsat } from "@blamnetwork/rsat";
import type { SelfSchemas } from "./queuez/self";

// Schemas register by id when this runs, so only the build's loader calls it.
export function defineSchemas(self: SelfSchemas) {
  const {
    Unknown808017FC,
    Unknown808018FF,
    Unknown808043C6,
    Unknown8080181A,
    Unknown8080185C,
    Unknown8080193C,
  } = self;
  // 80800B1A @0x213b1b0, size 0x30
  // login_account request inner
  const LoginAccountRequestInner = rsat.schema(0x80800b1a, {
    unknown: rsat.nested(Unknown808043C6),
    trailing: rsat.u64(),
  });

  // 80801726 @0x20b0c60, size 0x30, headerChecksum 0x26e24eb4
  // login_account request (nid 503)
  const LoginAccountRequest = rsat.schema(0x80801726, {
    account: rsat.nested(LoginAccountRequestInner),
  });

  // 80801796 @0x216e6f0, size 0x8, headerChecksum 0x4e822394
  // status nest shared by every response; status is 4 bits
  const Unknown80801796 = rsat.schema(0x80801796, {
    unknown0: rsat.i8({ size: 4, bias: 1 }),
    unknown1: rsat.i32(),
  });

  // 808045F0 @0x20d7dd0, size 0x2c
  const Unknown808045F0 = rsat.schema(0x808045f0, {
    unknown0: rsat.array(rsat.i16(), { lengthBits: 5, max: 20 }),
  });

  // 808046E7 @0x2283e60, size 0x54
  const Unknown808046E7 = rsat.schema(0x808046e7, {
    unknown0: rsat.array(rsat.nested(Unknown8080185C), {
      lengthBits: 5,
      max: 20,
    }),
  });

  // 80801747 @0x20e2bf0, size 0xc
  const Unknown80801747 = rsat.schema(0x80801747, {
    unknown0: rsat.u32(),
    unknown1: rsat.u32(),
    unknown2: rsat.i32(),
  });

  // 808047AD @0x242a070, size 0x34
  const Unknown808047AD = rsat.schema(0x808047ad, {
    unknown0: rsat.array(rsat.nested(Unknown80801747), {
      lengthBits: 3,
      max: 4,
    }),
  });

  const UNIVERSE_CHECKSUM = 0xf3444942;

  // 80801941 @0x248f270, size 0xc8, headerChecksum 0xf3444942
  // server_object
  const ServerObject = rsat.schema(0x80801941, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown808045F0)),
    unknown3: rsat.optional(rsat.nested(Unknown808046E7)),
    unknown4: rsat.optional(rsat.nested(Unknown808047AD)),
    unknown5: rsat.optional(rsat.u32()),
  });

  // 80801825 @0x226bce0, size 0xe0, headerChecksum 0x81a8cf74
  // login_account response (nid 503)
  const LoginAccountResponse = rsat.schema(0x80801825, {
    unknown0: rsat.nested(Unknown80801796),
    accountSoid: rsat.u64(),
    schemaChecksum: rsat.u32(),
    contentChecksum: rsat.u32(),
    serverObject: rsat.nested(ServerObject),
  });

  // 80801774 @0x2136080, size 0x10, headerChecksum 0x42ca6e9f
  // fetch_family request (nid 206)
  const FetchFamilyRequest = rsat.schema(0x80801774, {
    familyType: rsat.i8({ size: 4, bias: 1 }),
    familyRootSoid: rsat.u64(),
  });

  // 80801869 @0x22e9de0, size 0x1, headerChecksum 0x9c34ba1b
  // fetch_family response (nid 206)
  const FetchFamilyResponse = rsat.schema(0x80801869, {
    unknown0: rsat.i8({ size: 4, bias: 1 }),
  });

  // 808018F8 @0x2415760, size 0xd0, headerChecksum 0xd9007600
  // director_enter_orbit response (nid 104)
  const DirectorEnterOrbitResponse = rsat.schema(0x808018f8, {
    unknown0: rsat.nested(Unknown80801796),
    serverObject: rsat.nested(ServerObject),
  });

  // 808018AF @0x238a460, size 0x2, headerChecksum 0xbd89d5d7
  // director_complete_bink_activity request (nid 105)
  const DirectorCompleteBinkActivityRequest = rsat.schema(0x808018af, {
    activityIndex: rsat.i16(),
  });

  // 80801702 @0x2071500, size 0x8, headerChecksum 0x18fa5209
  // director_complete_bink_activity response (nid 105)
  const DirectorCompleteBinkActivityResponse = rsat.schema(0x80801702, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080189B @0x2366f40, size 0x8, headerChecksum 0xb5f53355
  // profile_set_account_profile response (nid 701)
  const ProfileSetAccountProfileResponse = rsat.schema(0x8080189b, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 808016CF @0x20131c0, size 0x4c0, headerChecksum 0x08667bf4
  // profile_set_character_profile request (nid 702)
  const ProfileSetCharacterProfileRequest = rsat.schema(0x808016cf, {
    profile: rsat.nested(Unknown8080193C),
  });

  // 8080194D @0x24a7cb0, size 0x8, headerChecksum 0xf797fcea
  // profile_set_character_profile response (nid 702)
  const ProfileSetCharacterProfileResponse = rsat.schema(0x8080194d, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 808041CC @0x21a0340, size 0x11
  const Unknown808041CC = rsat.schema(0x808041cc, {
    unknown0: rsat.repeat(rsat.i8(), 17),
  });

  // 80804257 @0x2259c80, size 0x11
  // platform user name, 17 x i8
  const PlatformUserName = rsat.schema(0x80804257, {
    chars: rsat.nested(Unknown808041CC),
  });

  // 80801860 @0x22de5d0, size 0x3c, headerChecksum 0x997f2aff
  // login_create_character request (nid 501)
  const LoginCreateCharacterRequest = rsat.schema(0x80801860, {
    appearanceEc: rsat.nested(Unknown808017FC),
    appearanceF0: rsat.nested(Unknown8080181A),
    name: rsat.nested(PlatformUserName),
  });

  // 8080185D @0x22d4900, size 0x10, headerChecksum 0x97c27d08
  // login_create_character response (nid 501)
  const LoginCreateCharacterResponse = rsat.schema(0x8080185d, {
    unknown0: rsat.nested(Unknown80801796),
    characterSoid: rsat.u64(),
  });

  // 80801939 @0x2483cc0, size 0x8, headerChecksum 0xf06ed89c
  // login_delete_character request (nid 502)
  const LoginDeleteCharacterRequest = rsat.schema(0x80801939, {
    characterSoid: rsat.u64(),
  });

  // 808017F9 @0x220b920, size 0x8, headerChecksum 0x70a513e4
  // login_delete_character response (nid 502)
  const LoginDeleteCharacterResponse = rsat.schema(0x808017f9, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 808017CE @0x21c9a10, size 0x8, headerChecksum 0x623cb7e8
  // login_character request (nid 504)
  const LoginCharacterRequest = rsat.schema(0x808017ce, {
    characterSoid: rsat.u64(),
  });

  // 80801845 @0x22a0c90, size 0x8, headerChecksum 0x8da8fe2b
  // login_character response (nid 504)
  const LoginCharacterResponse = rsat.schema(0x80801845, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801886 @0x2330940, size 0x8, headerChecksum 0xaa913b7c
  // signout_character response (nid 505)
  const SignoutCharacterResponse = rsat.schema(0x80801886, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801757 @0x2101be0, size 0x20, headerChecksum 0x37ebb83e
  // loot_pickup_item request (nid 601)
  const LootPickupItemRequest = rsat.schema(0x80801757, {
    state: rsat.i8({ size: 3, bias: 1 }),
    nonce: rsat.nested(Unknown808018FF),
  });

  // 808017AB @0x219a850, size 0x20, headerChecksum 0x582fac8c
  // loot_pickup_item response (nid 601)
  const LootPickupItemResponse = rsat.schema(0x808017ab, {
    unknown0: rsat.nested(Unknown80801796),
    nonce: rsat.nested(Unknown808018FF),
  });

  // 80801983 @0x223a8a0, size 0x18
  // item reference: instance flag, soid, definition index
  const ItemReference = rsat.schema(0x80801983, {
    hasInstance: rsat.bool(),
    itemSoid: rsat.u64(),
    defIndex: rsat.i16(),
  });

  // 80801767 @0x2125c20, size 0x18, headerChecksum 0x3f83bb16
  // inventory_perform_item_action request (nid 402)
  const InventoryPerformItemActionRequest = rsat.schema(0x80801767, {
    item: rsat.nested(ItemReference),
  });

  // 80801953 @0x24ae2e0, size 0x8, headerChecksum 0xf93d00fc
  // inventory_perform_item_action response (nid 402)
  const InventoryPerformItemActionResponse = rsat.schema(0x80801953, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801942 @0x24924f0, size 0x8, headerChecksum 0xf41b5e63
  // inventory_equip_item request (nid 403)
  const InventoryEquipItemRequest = rsat.schema(0x80801942, {
    itemSoid: rsat.u64(),
  });

  // 80801834 @0x22881e0, size 0x8, headerChecksum 0x885dcd1e
  // inventory_equip_item response (nid 403)
  const InventoryEquipItemResponse = rsat.schema(0x80801834, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080189A @0x2366b90, size 0x8, headerChecksum 0xb5da35b8
  // inventory_unequip_item request (nid 404)
  const InventoryUnequipItemRequest = rsat.schema(0x8080189a, {
    itemSoid: rsat.u64(),
  });

  // 808018AB @0x2382340, size 0x8, headerChecksum 0xbc0daba3
  // inventory_unequip_item response (nid 404)
  const InventoryUnequipItemResponse = rsat.schema(0x808018ab, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801777 @0x2139450, size 0x10, headerChecksum 0x438ca322
  // vendor_buy_item request (nid 901)
  const VendorBuyItemRequest = rsat.schema(0x80801777, {
    vendorIndex: rsat.i8(),
    purchaseIndex: rsat.i16(),
    unknown2: rsat.optional(rsat.u64()),
  });

  // 80801888 @0x2335ef0, size 0x8, headerChecksum 0xabd42b4f
  // vendor_buy_item response (nid 901)
  const VendorBuyItemResponse = rsat.schema(0x80801888, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801734 @0x20c47b0, size 0x20, headerChecksum 0x2b71d58a
  // vendor_sell_item request (nid 903)
  const VendorSellItemRequest = rsat.schema(0x80801734, {
    item: rsat.nested(ItemReference),
    quantity: rsat.i32(),
    vendorIndex: rsat.i8(),
  });

  // 8080183A @0x228ddb0, size 0x8, headerChecksum 0x89920499
  // vendor_sell_item response (nid 903)
  const VendorSellItemResponse = rsat.schema(0x8080183a, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080171F @0x20a4550, size 0x10, headerChecksum 0x24aab476
  // talent_grid_activate_step request (nid 801)
  const TalentGridActivateStepRequest = rsat.schema(0x8080171f, {
    itemSoid: rsat.u64(),
    node: rsat.i8(),
  });

  // 80801720 @0x20a4a00, size 0x8, headerChecksum 0x24c68e45
  // talent_grid_activate_step response (nid 801)
  const TalentGridActivateStepResponse = rsat.schema(0x80801720, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080174D @0x20e6de0, size 0x10, headerChecksum 0x32a0d934
  // talent_grid_binary_swap request (nid 802)
  const TalentGridBinarySwapRequest = rsat.schema(0x8080174d, {
    itemSoid: rsat.u64(),
    node: rsat.i8(),
  });

  // 8080183D @0x22933e0, size 0x8, headerChecksum 0x8a6138df
  // talent_grid_binary_swap response (nid 802)
  const TalentGridBinarySwapResponse = rsat.schema(0x8080183d, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 36-byte account nest
  const AccountUnknown36 = Unknown808043C6;

  return {
    LoginAccountRequestInner,
    LoginAccountRequest,
    Unknown80801796,
    Unknown808045F0,
    Unknown808046E7,
    Unknown80801747,
    Unknown808047AD,
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
    Unknown808041CC,
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
