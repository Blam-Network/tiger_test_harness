import { event_message } from "@blamnetwork/datamine";
import type { CharacterRecord } from "../../investment/character-store";
import {
  buildLoginAccountResponseBodyFromOpts,
  buildLoginCharacterResponseBody,
  buildLoginCreateCharacterResponseBody,
  buildLoginDeleteCharacterResponseBody,
  buildSignoutCharacterResponseBody,
  parseCharacterSoidRequest,
  parseLoginAccountRequest,
  parseLoginCreateCharacterRequest,
} from "../rsat";
import { bapBuild } from "../versions";
import type { WorldServerHandler } from "./context";

export const loginAccount: WorldServerHandler = async (ctx, message) => {
  const req = parseLoginAccountRequest(message.body);
  const account = await ctx.store.accountForPlatformId(
    req?.platformId ?? 0n,
    "guardian"
  );
  ctx.signInAccount(account, req?.platformId ?? 0n);
  if (req) {
    // The account nest is undecoded; its bytes are logged so the account key
    // can be checked against the gamertag / XUID.
    event_message(
      "networking:bap:world: login_account account36=%s",
      req.account36.toString("hex")
    );
  }
  ctx.setCharacter(null);
  await ctx.refreshRoster();
  const body = buildLoginAccountResponseBodyFromOpts({
    accountSoid: account.soid,
    account36: req?.account36,
  });
  ctx.reply(
    message,
    body,
    `login_account rsp account=0x${account.soid.toString(16)} ` +
      `platform=0x${(req?.platformId ?? 0n).toString(16)}`
  );
};

export const loginCreateCharacter: WorldServerHandler = async (
  ctx,
  message
) => {
  const req = parseLoginCreateCharacterRequest(message.body);
  let created: CharacterRecord | null = null;
  const account = ctx.account();
  if (req && account) {
    created = await ctx.store.createCharacter(
      account.soid,
      req.name || account.name,
      req.appearance
    );
  }
  // A build whose create screen only moves on once the self family shows a
  // signed-in character, and whose client sends no login_character for a new
  // one, signs it in here. The select_character family goes back on the
  // fetch_family(3) the client sends right after.
  if (created && bapBuild().newCharacterSignsIn) {
    await ctx.refreshRoster();
    ctx.setCharacter(created);
    ctx.pushSelfUpdate("login_create_character");
  }
  ctx.reply(
    message,
    buildLoginCreateCharacterResponseBody(created?.soid ?? null),
    created
      ? `login_create_character ok soid=0x${created.soid.toString(16)} ` +
          `class=${created.appearance.classIndex} race=${created.appearance.race} ` +
          `gender=${created.appearance.gender} name=${created.name}`
      : `login_create_character FAILED (${req ? "no account" : "unparsed"}) ` +
          `body=${message.body.subarray(0, 96).toString("hex")}`
  );
};

export const loginCharacter: WorldServerHandler = async (
  ctx,
  message,
  networkId
) => {
  const soid = parseCharacterSoidRequest(message.body, networkId);
  const character = soid === null ? null : await ctx.store.character(soid);
  const ok = character !== null && character.accountSoid === ctx.accountSoid();
  ctx.reply(
    message,
    buildLoginCharacterResponseBody(ok),
    `login_character ${ok ? "ok" : "FAILED"} soid=0x${(soid ?? 0n).toString(16)}`
  );
  if (ok) {
    ctx.setCharacter(character);
    ctx.pushSelfUpdate("login_character");
  }
};

export const loginDeleteCharacter: WorldServerHandler = async (
  ctx,
  message,
  networkId
) => {
  const soid = parseCharacterSoidRequest(message.body, networkId);
  const owned =
    soid !== null &&
    (await ctx.store.character(soid))?.accountSoid === ctx.accountSoid();
  const ok = owned && (await ctx.store.deleteCharacter(soid));
  if (ok && ctx.character()?.soid === soid) {
    ctx.setCharacter(null);
  }
  // The select list walks the self primary roster and looks each soid up in
  // family 3, so the deleted soid has to leave the roster before the client
  // re-fetches family 3.
  if (ok && bapBuild().selfFamilyHasRoster) {
    await ctx.refreshRoster();
    ctx.pushSelfUpdate("login_delete_character");
  }
  ctx.reply(
    message,
    buildLoginDeleteCharacterResponseBody(ok),
    `login_delete_character ${ok ? "ok" : "FAILED"} soid=0x${(soid ?? 0n).toString(16)}`
  );
};

export const signoutCharacter: WorldServerHandler = (ctx, message) => {
  ctx.setCharacter(null);
  ctx.reply(
    message,
    buildSignoutCharacterResponseBody(),
    "signout_character ok"
  );
  ctx.pushSelfUpdate("signout_character");
};
