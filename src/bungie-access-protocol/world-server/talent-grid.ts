import {
  applyTalentPlan,
  planActivateStep,
  planBinarySwap,
  TALENT_STATUS_OK,
  TALENT_STATUS_PREREQUISITE,
  type TalentPlan,
  wireTalentStatus,
} from "../../investment/talent-grid";
import { e_queuez_family_type } from "../queuez";
import { buildSelfUpdateBody } from "../queuez/baselines";
import {
  buildTalentGridActivateStepResponseBody,
  buildTalentGridBinarySwapResponseBody,
  e_server_message_network_id,
  parseTalentGridActivateStepRequest,
  parseTalentGridBinarySwapRequest,
} from "../rsat";
import type { WorldServerHandler } from "./context";

const nid = e_server_message_network_id;

// talent_grid_activate_step (801) / talent_grid_binary_swap (802).
// 803 (talent_grid_bind_ability) is never sent by this client and has no
// handler.
export const talentGridRequest: WorldServerHandler = async (
  ctx,
  message,
  networkId
) => {
  const isSwap =
    networkId === nid._server_message_network_id_talent_grid_binary_swap;
  const req = isSwap
    ? parseTalentGridBinarySwapRequest(message.body)
    : parseTalentGridActivateStepRequest(message.body);
  const character = ctx.character();
  let plan: TalentPlan = { status: TALENT_STATUS_PREREQUISITE };
  if (req && character) {
    plan = isSwap
      ? planBinarySwap(character, req.itemSoid, req.node)
      : planActivateStep(character, req.itemSoid, req.node);
  }
  const familyType = e_queuez_family_type._queuez_family_type_self;
  // The client blocks the node UI (state 4) on the response's version field
  // until the applied family-4 version reaches it:
  // the version we're about to push on success, or the version already
  // applied on failure (nothing new is coming, so nothing to wait for).
  let version = ctx.currentFamilyVersion(familyType);
  if (plan.status === TALENT_STATUS_OK && character) {
    await applyTalentPlan(ctx.store, character, plan);
    version = ctx.nextFamilyVersion(familyType);
  }
  const label = isSwap
    ? "talent_grid_binary_swap"
    : "talent_grid_activate_step";
  const body = isSwap
    ? buildTalentGridBinarySwapResponseBody(
        wireTalentStatus(plan.status),
        version
      )
    : buildTalentGridActivateStepResponseBody(
        wireTalentStatus(plan.status),
        version
      );
  ctx.reply(
    message,
    body,
    `${label} soid=0x${(req?.itemSoid ?? 0n).toString(16)} node=${req?.node ?? -1} ` +
      `status=${plan.status} version=${version}`
  );
  if (plan.status === TALENT_STATUS_OK && character) {
    ctx.pushFamily(
      buildSelfUpdateBody(ctx.accountSoid(), version, character, [
        plan.itemSoid,
      ]),
      `self delta after ${label}`
    );
  }
};
