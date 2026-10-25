import { event_message } from "@blamnetwork/datamine";
import { BapMessageType } from "../../lib/bap-wire/constants";
import { e_queuez_family_type } from "../queuez";
import { buildSelfUpdateBody } from "../queuez/baselines";
import {
  buildProfileSetAccountProfileResponseBody,
  buildProfileSetCharacterProfileResponseBody,
  characterProfileOrbitKey,
} from "../rsat";
import { bapBuild } from "../versions";
import type { WorldServerHandler } from "./context";

export const profileSetAccountProfile: WorldServerHandler = (ctx, message) => {
  const body = buildProfileSetAccountProfileResponseBody();
  ctx.send({
    msgType: BapMessageType.ClientToWorldServerResponse,
    sequence: message.sequence,
    body,
  });
  event_message(
    "networking:bap:world: profile_set_account_profile ack (seq %x, body %dB)",
    message.sequence,
    body.length
  );
};

export const profileSetCharacterProfile: WorldServerHandler = async (
  ctx,
  message
) => {
  const character = ctx.character();
  if (character) {
    // Kept verbatim (network id included) and echoed back in the self family
    // on the next sign-in.
    character.profile = Buffer.from(message.body);
    await ctx.store.setCharacterProfile(character.soid, character.profile);
  }
  const body = buildProfileSetCharacterProfileResponseBody();
  ctx.send({
    msgType: BapMessageType.ClientToWorldServerResponse,
    sequence: message.sequence,
    body,
  });
  const profile = ctx.character()?.profile;
  const orbitKey = profile && characterProfileOrbitKey(profile);
  event_message(
    "networking:bap:world: profile_set_character_profile ack (seq %x, body %dB, orbit key %s)",
    message.sequence,
    body.length,
    orbitKey === undefined || orbitKey === null
      ? "absent"
      : `0x${(orbitKey >>> 0).toString(16)}`
  );
  // The real server answers every 702 with a self delta (2.3.1 capture).
  // The director only redraws its node statuses when the self family
  // version moves, so keep it moving.
  const current = ctx.character();
  if (current && bapBuild().selfDeltaAfterProfileUpload) {
    ctx.pushFamily(
      buildSelfUpdateBody(
        ctx.accountSoid(),
        ctx.nextFamilyVersion(e_queuez_family_type._queuez_family_type_self),
        current,
        []
      ),
      "self delta after profile_set_character_profile"
    );
  }
};
