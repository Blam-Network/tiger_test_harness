import { event_message } from "@blamnetwork/datamine";
import type {
  CharacterRecord,
  CharacterStore,
} from "../../investment/character-store";
import type { RawBapMessage } from "../../lib/bap-wire/codec";
import { BapMessageType } from "../../lib/bap-wire/constants";
import { UNIVERSE_ROOT_SOID } from "../stubs/server-objects";
import type { SubscribeRequestValue } from "../subscribe";
import {
  buildInspectionBaselineBody,
  buildPeerBaselineBody,
  buildPeerUpdateBody,
  buildRosterBaselineBody,
  buildSelectCharacterBaselineBody,
  buildSelfBaselineBody,
  buildSelfUpdateBody,
  buildUniverseBaselineBody,
} from "./baselines";
import { e_queuez_family_type } from "./index";

interface FamilyBody {
  body: Buffer;
  label: string;
}

// What the pusher reads of the session that owns it: its login state, read
// when a body is built, and the way out to the client.
interface FamilyPushSource {
  accountSoid(): bigint;
  character(): CharacterRecord | null;
  rosterSoids(): readonly bigint[];
  send(message: RawBapMessage): void;
  readonly store: CharacterStore;
}

// The queuez family bodies one connection sends the client, and the versions
// and sequence numbers they carry.
export class FamilyPusher {
  // Sequence for server-pushed type-123 queuez updates.
  private pushSeq = 1;
  // Family versions climb per family for the life of the connection; the
  // inventory screen only re-renders when it sees a higher version.
  private readonly versions = new Map<number, number>();

  constructor(private readonly source: FamilyPushSource) {}

  nextSequence(): number {
    return this.pushSeq++ >>> 0;
  }

  nextFamilyVersion(familyType: number): number {
    const version = (this.versions.get(familyType) ?? 0) + 1;
    this.versions.set(familyType, version);
    return version;
  }

  // The last version actually pushed for a family: what the client already
  // has (or is about to have) applied, as opposed to nextFamilyVersion's "the
  // next one to push".
  currentFamilyVersion(familyType: number): number {
    return this.versions.get(familyType) ?? 0;
  }

  // Sends a family body as a type-123 update; returns its sequence.
  sendUpdate(body: Buffer): number {
    const seq = this.nextSequence();
    this.source.send({
      msgType: BapMessageType.QueuezToClientUpdateNotification,
      sequence: seq,
      body,
    });
    return seq;
  }

  pushFamily(body: Buffer, label: string): void {
    const seq = this.sendUpdate(body);
    event_message(
      "networking:bap: %s pushed (seq %x, %dB)",
      label,
      seq,
      body.length
    );
  }

  // Equip / unequip: delta updates. Family 4 carries the character (its
  // equipped soids) and the items whose equip state moved; family 0 carries
  // the peer character whose gear the guest builds weapons from.
  pushLoadoutChange(changedItemSoids: readonly bigint[], label: string): void {
    const character = this.source.character();
    if (!character) {
      return;
    }
    const accountSoid = this.source.accountSoid();
    this.pushFamily(
      buildSelfUpdateBody(
        accountSoid,
        this.nextFamilyVersion(e_queuez_family_type._queuez_family_type_self),
        character,
        changedItemSoids
      ),
      `self delta after ${label}`
    );
    this.pushFamily(
      buildPeerUpdateBody(
        accountSoid,
        this.nextFamilyVersion(e_queuez_family_type._queuez_family_type_peer),
        character
      ),
      `peer delta after ${label}`
    );
  }

  // Vendor buy / sell (901/903): only the self family changes (bag, plus an
  // item object for an instanced purchase or a removal for an instanced
  // sale). Items aren't equipped by buying or selling, so unlike
  // pushLoadoutChange no peer-family update is needed.
  pushInventoryChange(
    changedItemSoids: readonly bigint[],
    removedItemSoids: readonly bigint[],
    label: string
  ): void {
    const character = this.source.character();
    if (!character) {
      return;
    }
    this.pushFamily(
      buildSelfUpdateBody(
        this.source.accountSoid(),
        this.nextFamilyVersion(e_queuez_family_type._queuez_family_type_self),
        character,
        changedItemSoids,
        removedItemSoids
      ),
      `self delta after ${label}`
    );
  }

  // Push the self family again so the client picks up a character sign-in
  // or sign-out; it never re-fetches family 4 itself.
  pushSelfUpdate(label: string): void {
    const accountSoid = this.source.accountSoid();
    const character = this.source.character();
    const seq = this.nextSequence();
    const body = buildSelfBaselineBody(
      accountSoid,
      accountSoid,
      this.nextFamilyVersion(e_queuez_family_type._queuez_family_type_self),
      undefined,
      character,
      this.source.rosterSoids()
    );
    this.source.send({
      msgType: BapMessageType.QueuezToClientUpdateNotification,
      sequence: seq,
      body,
    });
    event_message(
      "networking:bap: self update pushed after %s (seq %x, character=%s, %dB)",
      label,
      seq,
      character ? `0x${character.soid.toString(16)}` : "none",
      body.length
    );
  }

  // The baselines a subscription is answered with: the self family brings
  // the character select list along, any other family its own baseline.
  async subscriptionBaselines(
    sub: SubscribeRequestValue | null
  ): Promise<FamilyBody[]> {
    const accountSoid = this.source.accountSoid();
    if (sub?.familyType === e_queuez_family_type._queuez_family_type_self) {
      return [
        {
          body: buildSelfBaselineBody(
            accountSoid,
            accountSoid,
            this.nextFamilyVersion(
              e_queuez_family_type._queuez_family_type_self
            ),
            undefined,
            this.source.character(),
            this.source.rosterSoids()
          ),
          label: "self",
        },
        {
          body: buildSelectCharacterBaselineBody(
            accountSoid,
            accountSoid,
            this.nextFamilyVersion(
              e_queuez_family_type._queuez_family_type_select_character
            ),
            undefined,
            await this.source.store.listCharacters(accountSoid)
          ),
          label: "select_character",
        },
      ];
    }
    if (!sub) {
      return [];
    }
    const root =
      sub.familyType === e_queuez_family_type._queuez_family_type_universe
        ? sub.rootSoid || UNIVERSE_ROOT_SOID
        : sub.rootSoid || accountSoid;
    const baseline = await this.buildBaselineForFamily(sub.familyType, root);
    return baseline ? [baseline] : [];
  }

  async buildBaselineForFamily(
    familyType: number,
    rootSoid: bigint
  ): Promise<FamilyBody | null> {
    const version = this.nextFamilyVersion(familyType);
    const character = this.source.character();
    switch (familyType) {
      case e_queuez_family_type._queuez_family_type_self:
        return {
          body: buildSelfBaselineBody(
            rootSoid,
            rootSoid,
            version,
            undefined,
            character,
            this.source.rosterSoids()
          ),
          label: "self",
        };
      case e_queuez_family_type._queuez_family_type_select_character:
        return {
          body: buildSelectCharacterBaselineBody(
            rootSoid,
            rootSoid,
            version,
            undefined,
            await this.source.store.listCharacters(this.source.accountSoid())
          ),
          label: "select_character",
        };
      case e_queuez_family_type._queuez_family_type_inspection:
        return {
          body: buildInspectionBaselineBody(
            rootSoid,
            rootSoid,
            version,
            undefined,
            character
          ),
          label: "inspection",
        };
      case e_queuez_family_type._queuez_family_type_peer:
        return {
          body: buildPeerBaselineBody(
            rootSoid,
            rootSoid,
            version,
            undefined,
            character
          ),
          label: "peer",
        };
      case e_queuez_family_type._queuez_family_type_roster:
        return {
          body: buildRosterBaselineBody(
            rootSoid,
            rootSoid,
            version,
            undefined,
            character
          ),
          label: "roster",
        };
      case e_queuez_family_type._queuez_family_type_universe:
        return {
          body: buildUniverseBaselineBody(rootSoid, rootSoid),
          label: "universe",
        };
      default:
        return null;
    }
  }
}
