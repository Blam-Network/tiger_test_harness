import type {
  AccountRecord,
  CharacterRecord,
  CharacterStore,
} from "../../investment/character-store";
import type { RawBapMessage } from "../../lib/bap-wire/codec";
import type { BapMessageType } from "../../lib/bap-wire/constants";

// What the world-server request handlers use of the BAP session that owns
// the connection: its login state, the store, and the ways to answer and to
// push family updates.
export interface WorldServerContext {
  account(): AccountRecord | null;
  // The signed-in account's soid, else the local investment account's.
  accountSoid(): bigint;
  buildBaselineForFamily(
    familyType: number,
    rootSoid: bigint
  ): Promise<{ body: Buffer; label: string } | null>;
  character(): CharacterRecord | null;
  currentFamilyVersion(familyType: number): number;
  flushActivityComplete(after: string): void;
  nextFamilyVersion(familyType: number): number;
  pushFamily(body: Buffer, label: string): void;
  pushInventoryChange(
    changedItemSoids: readonly bigint[],
    removedItemSoids: readonly bigint[],
    label: string
  ): void;
  pushLoadoutChange(changedItemSoids: readonly bigint[], label: string): void;
  pushSelfUpdate(label: string): void;
  refreshRoster(): Promise<void>;
  // The world-server response for a request: sends the body and logs it.
  reply(message: RawBapMessage, body: Buffer, log: string): void;
  // An empty-body response of another type.
  replyStatusOnly(
    message: RawBapMessage,
    responseType: BapMessageType,
    label: string
  ): void;
  scheduleOrbitRefresh(): void;
  send(message: RawBapMessage): void;
  setCharacter(next: CharacterRecord | null): void;
  // login_account: this connection is now that account, and the player
  // registry knows it.
  signInAccount(account: AccountRecord, platformId: bigint): void;
  readonly store: CharacterStore;
}

export type WorldServerHandler = (
  ctx: WorldServerContext,
  message: RawBapMessage,
  networkId: number
) => Promise<void> | void;

export interface WorldServerRoute {
  // Set on the acks that must not take the connection down: a throw is
  // logged as `BAP <absorb> FAILED, absorbed ...` instead of reaching the
  // session queue's own absorb.
  absorb?: string;
  handler: WorldServerHandler;
}
