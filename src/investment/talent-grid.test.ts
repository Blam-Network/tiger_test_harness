import { describe, expect, it } from "vitest";
import { describeWithPackages } from "../test-support/build";
import {
  MemoryCharacterStore,
  SOID_TYPE_ITEM,
  soidFor,
} from "./character-store";
import { CharacterLoadout } from "./loadout";
import { starterCurrencyDef } from "./stubs/starting-currency";
import { STUB_APPEARANCE } from "./stubs/stub-account";
import {
  applyTalentPlan,
  gridIndexForDef,
  hasTalentGrid,
  planActivateStep,
  planBinarySwap,
  TALENT_STATUS_ALREADY_MAXED,
  TALENT_STATUS_ITEM_LEVEL,
  TALENT_STATUS_MATERIALS,
  TALENT_STATUS_OK,
  TALENT_STATUS_PREREQUISITE,
  TALENT_STATUS_TIER,
  TALENT_STATUS_UNLOCK_EXPRESSION,
  TALENT_STATUS_WRONG_BINARY_SIDE,
  type TalentPlanOk,
  talentGridProgression,
  wireTalentStatus,
} from "./talent-grid";

// def 774: a subclass on grid 130 (31 nodes). Node 1 (level 2) has no
// requirement; node 0 (level 3) needs a node of node 1's group; nodes 1, 15
// and 16 are one group of which only one can be active.
const SUBCLASS_DEF = 774;
const GROUP_NODES = [1, 15, 16];
// Progression 102's step table is 0, 900, 4000, 7000...: 4,900 XP is level 2.
const LEVEL_TWO_XP = 4900;
const MAX_XP = 1_000_000;

async function characterWithSubclass(talentXp = MAX_XP) {
  const store = new MemoryCharacterStore();
  const account = await store.accountForPlatformId(1n, "guardian");
  const character = await store.createCharacter(
    account.soid,
    "guardian",
    STUB_APPEARANCE
  );
  const itemSoid = soidFor(SOID_TYPE_ITEM, 1);
  character.loadout = CharacterLoadout.fromItems([
    {
      soid: itemSoid,
      defIndex: SUBCLASS_DEF,
      bucket: 6,
      equipSlot: 0,
      instanced: true,
      quantity: 1,
      artArrangement: -1,
      sandboxPattern: -1,
      power: 0,
      talentXp,
    },
  ]);
  return { store, character, itemSoid };
}

async function activate(
  store: MemoryCharacterStore,
  character: Awaited<ReturnType<typeof characterWithSubclass>>["character"],
  itemSoid: bigint,
  node: number
) {
  const plan = planActivateStep(character, itemSoid, node);
  if (plan.status !== TALENT_STATUS_OK) {
    throw new Error(`setup: node ${node} failed with status ${plan.status}`);
  }
  await applyTalentPlan(store, character, plan);
}

describeWithPackages("grid lookup", () => {
  it("resolves the subclass def's grid and rejects a def with none", () => {
    expect(gridIndexForDef(SUBCLASS_DEF)).toBe(130);
    expect(hasTalentGrid(SUBCLASS_DEF)).toBe(true);
    const glimmer = starterCurrencyDef() as number;
    expect(hasTalentGrid(glimmer)).toBe(false);
    expect(gridIndexForDef(glimmer)).toBe(0);
  });

  it("sends the grid's progression, 0xFF for none", () => {
    expect(talentGridProgression(SUBCLASS_DEF)).toBe(102);
    // A weapon grid with no progression, and an item with no grid at all.
    expect(talentGridProgression(3159)).toBe(0xff);
    expect(talentGridProgression(starterCurrencyDef() as number)).toBe(0xff);
  });
});

describeWithPackages("planActivateStep (801)", () => {
  it("activates a node with no requirements", async () => {
    const { character, itemSoid } = await characterWithSubclass();
    const plan = planActivateStep(character, itemSoid, 1);
    expect(plan.status).toBe(TALENT_STATUS_OK);
    expect((plan as TalentPlanOk).mutations).toEqual([{ node: 1, value: 1 }]);
  });

  it("blocks a node whose required node group has nothing active", async () => {
    const { character, itemSoid } = await characterWithSubclass();
    expect(planActivateStep(character, itemSoid, 0).status).toBe(
      TALENT_STATUS_PREREQUISITE
    );
  });

  it("allows it once a node of the required group is active", async () => {
    const { store, character, itemSoid } = await characterWithSubclass();
    await activate(store, character, itemSoid, 1);
    expect(planActivateStep(character, itemSoid, 0).status).toBe(
      TALENT_STATUS_OK
    );
  });

  it("gates a step on the item level its XP reaches", async () => {
    const fresh = await characterWithSubclass(0);
    expect(planActivateStep(fresh.character, fresh.itemSoid, 1).status).toBe(
      TALENT_STATUS_ITEM_LEVEL
    );
    const short = await characterWithSubclass(LEVEL_TWO_XP - 1);
    expect(planActivateStep(short.character, short.itemSoid, 1).status).toBe(
      TALENT_STATUS_ITEM_LEVEL
    );
    const enough = await characterWithSubclass(LEVEL_TWO_XP);
    expect(planActivateStep(enough.character, enough.itemSoid, 1).status).toBe(
      TALENT_STATUS_OK
    );
  });

  it("returns already-maxed once a single-step node is activated", async () => {
    const { store, character, itemSoid } = await characterWithSubclass();
    await activate(store, character, itemSoid, 1);
    expect(planActivateStep(character, itemSoid, 1).status).toBe(
      TALENT_STATUS_ALREADY_MAXED
    );
  });

  it("rejects an unresolvable item/grid/node", async () => {
    const { character } = await characterWithSubclass();
    expect(
      planActivateStep(character, soidFor(SOID_TYPE_ITEM, 999), 0).status
    ).toBe(TALENT_STATUS_PREREQUISITE);
    expect(
      planActivateStep(character, soidFor(SOID_TYPE_ITEM, 1), 99).status
    ).toBe(TALENT_STATUS_PREREQUISITE);
  });

  it("blocks a node once another of its group is active, via 801", async () => {
    const { store, character, itemSoid } = await characterWithSubclass();
    await activate(store, character, itemSoid, 1);
    for (const node of GROUP_NODES.filter((n) => n !== 1)) {
      expect(planActivateStep(character, itemSoid, node).status).toBe(
        TALENT_STATUS_WRONG_BINARY_SIDE
      );
    }
  });
});

describeWithPackages("planBinarySwap (802)", () => {
  it("rejects a node outside any group", async () => {
    const { character, itemSoid } = await characterWithSubclass();
    // Node 12 is auto-granted, with the empty pair hash.
    expect(planBinarySwap(character, itemSoid, 12).status).toBe(
      TALENT_STATUS_WRONG_BINARY_SIDE
    );
  });

  it("swaps from one member of a group to another", async () => {
    const { store, character, itemSoid } = await characterWithSubclass();
    await activate(store, character, itemSoid, 1);
    const item = character.loadout.item(itemSoid);
    expect(item?.talentNodes[1]).toBe(1);

    const swap = planBinarySwap(character, itemSoid, 16);
    expect(swap.status).toBe(TALENT_STATUS_OK);
    await applyTalentPlan(store, character, swap as TalentPlanOk);
    expect(item?.talentNodes[1]).toBe(0);
    expect(item?.talentNodes[16]).toBe(1);
  });

  it("refuses to swap into the member that's already active", async () => {
    const { store, character, itemSoid } = await characterWithSubclass();
    await activate(store, character, itemSoid, 1);
    expect(planBinarySwap(character, itemSoid, 1).status).toBe(
      TALENT_STATUS_ALREADY_MAXED
    );
  });
});

describe("wireTalentStatus", () => {
  it("passes ok and the directly-representable codes through", () => {
    expect(wireTalentStatus(TALENT_STATUS_OK)).toBe(0);
    expect(wireTalentStatus(TALENT_STATUS_TIER)).toBe(2);
    expect(wireTalentStatus(TALENT_STATUS_PREREQUISITE)).toBe(3);
    expect(wireTalentStatus(TALENT_STATUS_UNLOCK_EXPRESSION)).toBe(5);
  });

  it("never emits 0 or 6 for a real failure", () => {
    const failures = [
      TALENT_STATUS_TIER,
      TALENT_STATUS_PREREQUISITE,
      TALENT_STATUS_ALREADY_MAXED,
      TALENT_STATUS_UNLOCK_EXPRESSION,
      TALENT_STATUS_MATERIALS,
      TALENT_STATUS_ITEM_LEVEL,
      TALENT_STATUS_WRONG_BINARY_SIDE,
    ] as const;
    for (const status of failures) {
      const wire = wireTalentStatus(status);
      expect(wire).toBeGreaterThanOrEqual(1);
      expect(wire).toBeLessThanOrEqual(5);
    }
  });
});
