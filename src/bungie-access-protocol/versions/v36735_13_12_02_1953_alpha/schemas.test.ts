import {
  decode,
  decodeServerMessage,
  encode,
  encodeServerMessage,
} from "@blamnetwork/rsat";
import { beforeAll, expect, it } from "vitest";
import { e_build } from "../../../builds";
import { describeBuild } from "../../../test-support/build";
import { e_server_message_network_id as nid } from "../../rsat/constants";
import type { AlphaBapBuild } from ".";

describeBuild(
  e_build.v36735_13_12_02_1953_alpha,
  "alpha message schemas",
  () => {
    let bap: AlphaBapBuild;
    beforeAll(async () => {
      const { alphaBap } = await import("./alpha-bap");
      bap = alphaBap();
    });

    it("round-trips vendor_buy_item request (80801ACB)", () => {
      const body = encodeServerMessage(
        nid._server_message_network_id_vendor_buy_item,
        bap.schemas.VendorBuyItemRequest,
        { vendorIndex: 9, purchaseIndex: 3 }
      );
      const { networkId, value } = decodeServerMessage(
        body,
        bap.schemas.VendorBuyItemRequest
      );
      expect(networkId).toBe(nid._server_message_network_id_vendor_buy_item);
      expect(value.vendorIndex).toBe(9);
      expect(value.purchaseIndex).toBe(3);
    });

    it("round-trips vendor_sell_item request (80801ACF)", () => {
      const body = encodeServerMessage(
        nid._server_message_network_id_vendor_sell_item,
        bap.schemas.VendorSellItemRequest,
        {
          item: {
            hasInstance: true,
            itemSoid: 0x3_00_00_00_42n,
            defIndex: 497,
          },
          quantity: 1,
          vendorIndex: 0,
        }
      );
      const { networkId, value } = decodeServerMessage(
        body,
        bap.schemas.VendorSellItemRequest
      );
      expect(networkId).toBe(nid._server_message_network_id_vendor_sell_item);
      expect(value.item).toEqual({
        hasInstance: true,
        itemSoid: 0x3_00_00_00_42n,
        defIndex: 497,
      });
      expect(value.quantity).toBe(1);
      expect(value.vendorIndex).toBe(0);
    });

    it("round-trips loot_pickup_item request and response (80801AB5 / 80801AB6)", () => {
      const nonce = {
        unknown0: { unknown0: 0x34_fd, unknown1: 0x2_00_00_00_01n },
        unknown1: 0,
      };
      const request = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_loot_pickup_item,
          bap.schemas.LootPickupItemRequest,
          { state: 3, nonce }
        ),
        bap.schemas.LootPickupItemRequest
      );
      expect(request.value.state).toBe(3);
      expect(request.value.nonce).toEqual(nonce);

      const response = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_loot_pickup_item,
          bap.schemas.LootPickupItemResponse,
          {
            unknown0: { unknown0: 0, unknown1: 0 },
            nonce: { ...nonce, unknown1: 2 },
          }
        ),
        bap.schemas.LootPickupItemResponse
      );
      expect(response.value.unknown0.unknown0).toBe(0);
      expect(response.value.nonce.unknown1).toBe(2);
    });

    // The client always sends step 0 and the trailing field 0 (memset); the
    // node carries a real bias-0x80 value.
    it("round-trips talent_grid_activate_step (80801AC5 / 80801AC6)", () => {
      const request = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_talent_grid_activate_step,
          bap.schemas.TalentGridActivateStepRequest,
          {
            itemSoid: 0x3_00_00_00_42n,
            node: { unknown0: 3, unknown1: 0 },
            unknown2: 0,
          }
        ),
        bap.schemas.TalentGridActivateStepRequest
      );
      expect(request.value.itemSoid).toBe(0x3_00_00_00_42n);
      expect(request.value.node).toEqual({ unknown0: 3, unknown1: 0 });

      // unknown1 is the family-4 version the client blocks on: a plain i32, so
      // it survives round-tripping past the 3-bit status field.
      const response = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_talent_grid_activate_step,
          bap.schemas.TalentGridActivateStepResponse,
          { unknown0: { unknown0: 0, unknown1: 7 } }
        ),
        bap.schemas.TalentGridActivateStepResponse
      );
      expect(response.value.unknown0).toEqual({ unknown0: 0, unknown1: 7 });
    });

    it("round-trips talent_grid_binary_swap (80801AC7 / 80801AC8)", () => {
      const request = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_talent_grid_binary_swap,
          bap.schemas.TalentGridBinarySwapRequest,
          { itemSoid: 0x3_00_00_00_99n, node: 5 }
        ),
        bap.schemas.TalentGridBinarySwapRequest
      );
      expect(request.value).toEqual({ itemSoid: 0x3_00_00_00_99n, node: 5 });

      const response = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_talent_grid_binary_swap,
          bap.schemas.TalentGridBinarySwapResponse,
          { unknown0: { unknown0: 4, unknown1: 12 } }
        ),
        bap.schemas.TalentGridBinarySwapResponse
      );
      expect(response.value.unknown0).toEqual({ unknown0: 4, unknown1: 12 });
    });

    it("round-trips inventory_destroy_item (80801AA1 / 80801AA2)", () => {
      const request = decodeServerMessage(
        encodeServerMessage(
          nid._server_message_network_id_inventory_destroy_item,
          bap.schemas.InventoryDestroyItemRequest,
          { itemSoid: 0x3_00_00_00_07n }
        ),
        bap.schemas.InventoryDestroyItemRequest
      );
      expect(request.networkId).toBe(401);
      expect(request.value.itemSoid).toBe(0x3_00_00_00_07n);
    });

    it("stands each schema in the registry under its client id", () => {
      expect(bap.schemas.LoginAccountResponse.hash).toBe(0x80_80_1a_b0);
      expect(bap.queuez.self.SelfPrimary.hash).toBe(0x80_80_17_d0);
      expect(bap.queuez.self.SelfInventory.hash).toBe(0x80_80_1a_01);
      expect(bap.queuez.self.InventoryItem.hash).toBe(0x80_80_1a_25);
      expect(bap.schemas.ServerObject.hash).toBe(0x80_80_18_d0);
    });

    it("states the checksums the client holds the login to", () => {
      expect(bap.checksums.SCHEMA_CHECKSUM).toBe(0x41_3b_96_57);
      expect(bap.checksums.CONTENT_CHECKSUM).toBe(0x7e_99_08_f6);
    });

    it("round-trips an empty server object and a minimal self primary", () => {
      const object = {
        soid: 7n,
        unknown1: 0n,
        unknown2: undefined,
        unknown3: undefined,
        unknown4: undefined,
      };
      expect(
        decode(
          bap.schemas.ServerObject,
          encode(bap.schemas.ServerObject, object)
        )
      ).toEqual(object);
    });
  }
);
