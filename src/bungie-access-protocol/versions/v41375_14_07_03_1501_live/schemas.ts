// Client schemas, from the .schmr table. Unnamed fields are unknownN,
// their member index in the record.

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
  // 80800B1A @0x82275f70, size 0x30
  // login_account request inner
  const LoginAccountRequestInner = rsat.schema(0x80800b1a, {
    unknown: rsat.nested(Unknown808043C6),
    trailing: rsat.u64(),
  });

  // 80801726 @0x822340e8, size 0x30, headerChecksum 0x8887d321
  // login_account request (nid 503)
  const LoginAccountRequest = rsat.schema(0x80801726, {
    account: rsat.nested(LoginAccountRequestInner),
  });

  // 80801796 @0x823495a8, size 0x8, headerChecksum 0xd4216ae5
  // status nest shared by every response; status is 4 bits
  const Unknown80801796 = rsat.schema(0x80801796, {
    unknown0: rsat.i8({ size: 4, bias: 1 }),
    unknown1: rsat.i32(),
  });

  // 808045F0 @0x821f8ce0, size 0x2c
  const Unknown808045F0 = rsat.schema(0x808045f0, {
    unknown0: rsat.array(rsat.i16(), { lengthBits: 5, max: 20 }),
  });

  // 808046E7 @0x822201bc, size 0x54
  const Unknown808046E7 = rsat.schema(0x808046e7, {
    unknown0: rsat.array(rsat.nested(Unknown8080185C), {
      lengthBits: 5,
      max: 20,
    }),
  });

  // 80801747 @0x82238ebc, size 0xc
  const Unknown80801747 = rsat.schema(0x80801747, {
    unknown0: rsat.u32(),
    unknown1: rsat.u32(),
    unknown2: rsat.i32(),
  });

  // 808047AD @0x82214628, size 0x34
  const Unknown808047AD = rsat.schema(0x808047ad, {
    unknown0: rsat.array(rsat.nested(Unknown80801747), {
      lengthBits: 3,
      max: 4,
    }),
  });

  const UNIVERSE_CHECKSUM = 0xf3eabc94;

  // 80801941 @0x8236feac, size 0xc8, headerChecksum 0xf3eabc94
  // server_object
  const ServerObject = rsat.schema(0x80801941, {
    soid: rsat.optional(rsat.u64()),
    unknown1: rsat.optional(rsat.u64()),
    unknown2: rsat.optional(rsat.nested(Unknown808045F0)),
    unknown3: rsat.optional(rsat.nested(Unknown808046E7)),
    unknown4: rsat.optional(rsat.nested(Unknown808047AD)),
    unknown5: rsat.optional(rsat.u32()),
  });

  // 80801825 @0x821e63b8, size 0xe0, headerChecksum 0x03d65631
  // login_account response (nid 503)
  const LoginAccountResponse = rsat.schema(0x80801825, {
    unknown0: rsat.nested(Unknown80801796),
    accountSoid: rsat.u64(),
    schemaChecksum: rsat.u32(),
    contentChecksum: rsat.u32(),
    serverObject: rsat.nested(ServerObject),
  });

  // 80801774 @0x822b2190, size 0x10, headerChecksum 0x42c311b7
  // fetch_family request (nid 206)
  const FetchFamilyRequest = rsat.schema(0x80801774, {
    familyType: rsat.i8({ size: 4, bias: 1 }),
    familyRootSoid: rsat.u64(),
  });

  // 80801869 @0x822258c0, size 0x1, headerChecksum 0x74d57f58
  // fetch_family response (nid 206)
  const FetchFamilyResponse = rsat.schema(0x80801869, {
    unknown0: rsat.i8({ size: 4, bias: 1 }),
  });

  // 808018F8 @0x8231e344, size 0xd0, headerChecksum 0xaad0aaa4
  // director_enter_orbit response (nid 104)
  const DirectorEnterOrbitResponse = rsat.schema(0x808018f8, {
    unknown0: rsat.nested(Unknown80801796),
    serverObject: rsat.nested(ServerObject),
  });

  // 808018AF @0x8222f36c, size 0x2, headerChecksum 0x8145d692
  // director_complete_bink_activity request (nid 105)
  const DirectorCompleteBinkActivityRequest = rsat.schema(0x808018af, {
    activityIndex: rsat.i16(),
  });

  // 80801702 @0x8221a170, size 0x8, headerChecksum 0x61d563c5
  // director_complete_bink_activity response (nid 105)
  const DirectorCompleteBinkActivityResponse = rsat.schema(0x80801702, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080189B @0x821feb24, size 0x8, headerChecksum 0x30047ead
  // profile_set_account_profile response (nid 701)
  const ProfileSetAccountProfileResponse = rsat.schema(0x8080189b, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 808016CF @0x82271e04, size 0x8c8, headerChecksum 0xfdd0fc47
  // profile_set_character_profile request (nid 702)
  const ProfileSetCharacterProfileRequest = rsat.schema(0x808016cf, {
    profile: rsat.nested(Unknown8080193C),
  });

  // 8080194D @0x821f12ec, size 0x8, headerChecksum 0x180a2c07
  // profile_set_character_profile response (nid 702)
  const ProfileSetCharacterProfileResponse = rsat.schema(0x8080194d, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 808041CC @0x82215d74, size 0x11
  const Unknown808041CC = rsat.schema(0x808041cc, {
    unknown0: rsat.repeat(rsat.i8(), 17),
  });

  // 80804257 @0x822d4438, size 0x11
  // platform user name, 17 x i8
  const PlatformUserName = rsat.schema(0x80804257, {
    chars: rsat.nested(Unknown808041CC),
  });

  // 80801860 @0x8222044c, size 0x3c, headerChecksum 0x6b07c5fa
  // login_create_character request (nid 501)
  const LoginCreateCharacterRequest = rsat.schema(0x80801860, {
    appearanceEc: rsat.nested(Unknown808017FC),
    appearanceF0: rsat.nested(Unknown8080181A),
    name: rsat.nested(PlatformUserName),
  });

  // 8080185D @0x8236d3b0, size 0x10, headerChecksum 0xf0d0a0a9
  // login_create_character response (nid 501)
  const LoginCreateCharacterResponse = rsat.schema(0x8080185d, {
    unknown0: rsat.nested(Unknown80801796),
    characterSoid: rsat.u64(),
  });

  // 80801939 @0x8226d21c, size 0x8, headerChecksum 0xf461ff8b
  // login_delete_character request (nid 502)
  const LoginDeleteCharacterRequest = rsat.schema(0x80801939, {
    characterSoid: rsat.u64(),
  });

  // 808017F9 @0x82206fc8, size 0x8, headerChecksum 0x3d9c2db2
  // login_delete_character response (nid 502)
  const LoginDeleteCharacterResponse = rsat.schema(0x808017f9, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 808017CE @0x8224b1a0, size 0x8, headerChecksum 0xb3fed77d
  // login_character request (nid 504)
  const LoginCharacterRequest = rsat.schema(0x808017ce, {
    characterSoid: rsat.u64(),
  });

  // 80801845 @0x82264bbc, size 0x8, headerChecksum 0xe274a2a8
  // login_character response (nid 504)
  const LoginCharacterResponse = rsat.schema(0x80801845, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801886 @0x82210bc4, size 0x8, headerChecksum 0x5092e704
  // signout_character response (nid 505)
  const SignoutCharacterResponse = rsat.schema(0x80801886, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801757 @0x82342080, size 0x20, headerChecksum 0xcc653e6d
  // loot_pickup_item request (nid 601)
  const LootPickupItemRequest = rsat.schema(0x80801757, {
    state: rsat.i8({ size: 3, bias: 1 }),
    nonce: rsat.nested(Unknown808018FF),
  });

  // 808017AB @0x822aa328, size 0x20, headerChecksum 0x3a3d9763
  // loot_pickup_item response (nid 601)
  const LootPickupItemResponse = rsat.schema(0x808017ab, {
    unknown0: rsat.nested(Unknown80801796),
    nonce: rsat.nested(Unknown808018FF),
  });

  // 80801983 @0x8220f400, size 0x18
  // item reference: instance flag, soid, definition index
  const ItemReference = rsat.schema(0x80801983, {
    hasInstance: rsat.bool(),
    itemSoid: rsat.u64(),
    defIndex: rsat.i16(),
  });

  // 80801767 @0x822c021c, size 0x20, headerChecksum 0x52dbbb7b
  // inventory_perform_item_action request (nid 402)
  const InventoryPerformItemActionRequest = rsat.schema(0x80801767, {
    item: rsat.nested(ItemReference),
    unknown1: rsat.i32(),
  });

  // 80801953 @0x8223ffe8, size 0x8, headerChecksum 0x9f93cea6
  // inventory_perform_item_action response (nid 402)
  const InventoryPerformItemActionResponse = rsat.schema(0x80801953, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801942 @0x8221df64, size 0x8, headerChecksum 0x66ca13a5
  // inventory_equip_item request (nid 403)
  const InventoryEquipItemRequest = rsat.schema(0x80801942, {
    itemSoid: rsat.u64(),
  });

  // 80801834 @0x82208750, size 0x8, headerChecksum 0x40d24fbe
  // inventory_equip_item response (nid 403)
  const InventoryEquipItemResponse = rsat.schema(0x80801834, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080189A @0x82268c38, size 0x8, headerChecksum 0xeb72b74c
  // inventory_unequip_item request (nid 404)
  const InventoryUnequipItemRequest = rsat.schema(0x8080189a, {
    itemSoid: rsat.u64(),
  });

  // 808018AB @0x821f16a8, size 0x8, headerChecksum 0x186697ac
  // inventory_unequip_item response (nid 404)
  const InventoryUnequipItemResponse = rsat.schema(0x808018ab, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801777 @0x8225f810, size 0x10, headerChecksum 0xda28df6c
  // vendor_buy_item request (nid 901)
  const VendorBuyItemRequest = rsat.schema(0x80801777, {
    vendorIndex: rsat.i8(),
    purchaseIndex: rsat.i16(),
    unknown2: rsat.optional(rsat.u64()),
  });

  // 80801888 @0x8221e154, size 0x8, headerChecksum 0x6701f93e
  // vendor_buy_item response (nid 901)
  const VendorBuyItemResponse = rsat.schema(0x80801888, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 80801734 @0x822415e0, size 0x20, headerChecksum 0xa216123e
  // vendor_sell_item request (nid 903)
  const VendorSellItemRequest = rsat.schema(0x80801734, {
    item: rsat.nested(ItemReference),
    quantity: rsat.i32(),
    vendorIndex: rsat.i8(),
  });

  // 8080183A @0x821ffb68, size 0x8, headerChecksum 0x31ff7060
  // vendor_sell_item response (nid 903)
  const VendorSellItemResponse = rsat.schema(0x8080183a, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080171F @0x822920b4, size 0x10, headerChecksum 0x1c73dff6
  // talent_grid_activate_step request (nid 801)
  const TalentGridActivateStepRequest = rsat.schema(0x8080171f, {
    itemSoid: rsat.u64(),
    node: rsat.i8(),
  });

  // 80801720 @0x821e51f0, size 0x8, headerChecksum 0x0180034e
  // talent_grid_activate_step response (nid 801)
  const TalentGridActivateStepResponse = rsat.schema(0x80801720, {
    unknown0: rsat.nested(Unknown80801796),
  });

  // 8080174D @0x822c9ce4, size 0x10, headerChecksum 0x5d8a8f2f
  // talent_grid_binary_swap request (nid 802)
  const TalentGridBinarySwapRequest = rsat.schema(0x8080174d, {
    itemSoid: rsat.u64(),
    node: rsat.i8(),
  });

  // 8080183D @0x821f1b38, size 0x8, headerChecksum 0x18d85404
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
